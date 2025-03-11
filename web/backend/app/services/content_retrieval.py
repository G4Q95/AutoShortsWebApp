import asyncio
import json
import logging
import random
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

# Custom user agents to avoid bot detection
DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
REDDIT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0"


async def extract_media_from_reddit_post(post_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract media content (images, videos) from a Reddit post data structure.

    Args:
        post_data: The post data dictionary from Reddit's JSON API

    Returns:
        Dictionary containing media data (type, url, preview, etc.)
    """
    media_data = {
        "has_media": False,
        "media_type": None,
        "media_url": None,
        "thumbnail_url": None,
        "preview_images": [],
    }

    # Set thumbnail if available
    if post_data.get("thumbnail") and post_data["thumbnail"].startswith("http"):
        media_data["thumbnail_url"] = post_data["thumbnail"]

    # Extract preview images if available
    if "preview" in post_data and "images" in post_data["preview"]:
        for image in post_data["preview"]["images"]:
            if "source" in image and "url" in image["source"]:
                # Unescape URLs (Reddit escapes them in JSON)
                image_url = image["source"]["url"].replace("&amp;", "&")
                media_data["preview_images"].append(
                    {
                        "url": image_url,
                        "width": image["source"].get("width"),
                        "height": image["source"].get("height"),
                    }
                )

                # Set first preview as thumbnail if none exists
                if not media_data["thumbnail_url"] and media_data["preview_images"]:
                    media_data["thumbnail_url"] = media_data["preview_images"][0]["url"]

    # Check for image posts
    if post_data.get("is_video") == False and post_data.get("post_hint") == "image":
        media_data["has_media"] = True
        media_data["media_type"] = "image"
        media_data["media_url"] = post_data.get("url")

    # Check for gallery posts
    elif "gallery_data" in post_data and "media_metadata" in post_data:
        media_data["has_media"] = True
        media_data["media_type"] = "gallery"
        gallery_items = []

        for item_id in post_data.get("gallery_data", {}).get("items", []):
            item_id = item_id.get("media_id")
            if item_id in post_data.get("media_metadata", {}):
                metadata = post_data["media_metadata"][item_id]
                if metadata.get("status") == "valid" and "s" in metadata:
                    image_url = metadata["s"]["u"].replace("&amp;", "&")
                    gallery_items.append(image_url)

        media_data["gallery_items"] = gallery_items

    # Check for video posts
    elif post_data.get("is_video") == True and post_data.get("media"):
        media_data["has_media"] = True
        media_data["media_type"] = "video"

        # Reddit videos
        if "reddit_video" in post_data["media"]:
            video_data = post_data["media"]["reddit_video"]
            media_data["media_url"] = video_data.get("fallback_url", "").replace("&amp;", "&")
            media_data["width"] = video_data.get("width")
            media_data["height"] = video_data.get("height")
            media_data["duration"] = video_data.get("duration")

        # External videos (YouTube, etc.)
        elif "oembed" in post_data["media"]:
            media_data["media_type"] = "external_video"
            media_data["media_url"] = post_data["url"]
            media_data["oembed_html"] = post_data["media"]["oembed"].get("html")
            media_data["provider"] = post_data["media"]["oembed"].get("provider_name")

    # Check for direct link to image or video
    elif post_data.get("url") and any(
        post_data["url"].lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif"]
    ):
        media_data["has_media"] = True
        media_data["media_type"] = "image"
        media_data["media_url"] = post_data["url"]

    elif post_data.get("url") and any(
        post_data["url"].lower().endswith(ext) for ext in [".mp4", ".webm", ".mov"]
    ):
        media_data["has_media"] = True
        media_data["media_type"] = "video"
        media_data["media_url"] = post_data["url"]

    return media_data


# Domain-specific handlers
async def handle_reddit_url(url: str, client: httpx.AsyncClient) -> Optional[Dict[str, Any]]:
    """
    Handle Reddit URLs specifically to deal with their redirect issues and extract content.
    """
    # Normalize Reddit URL formats
    url = normalize_reddit_url(url)

    try:
        # Define comprehensive headers to mimic a real browser
        headers = {
            "User-Agent": REDDIT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Chromium";v="123", "Microsoft Edge";v="123", "Not:A-Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
        }

        # Add .json to the URL to get JSON data
        json_url = url
        if not json_url.endswith(".json"):
            json_url = url + ".json"

        # First, try to get the HTML page to establish cookies
        await client.get(url, headers=headers, follow_redirects=True)

        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)

        # Now attempt to get the JSON data
        json_response = await client.get(json_url, headers=headers, follow_redirects=True)

        if json_response.status_code == 200:
            data = json_response.json()
            post_data = None

            # Extract post data from Reddit JSON structure
            if isinstance(data, list) and len(data) > 0:
                # Standard Reddit post
                post_data = data[0]["data"]["children"][0]["data"]
            elif isinstance(data, dict) and "data" in data:
                # Some Reddit formats
                if "children" in data["data"] and len(data["data"]["children"]) > 0:
                    post_data = data["data"]["children"][0]["data"]

            if post_data:
                title = post_data.get("title", "")
                selftext = post_data.get("selftext", "")
                author = post_data.get("author", "unknown")
                subreddit = post_data.get("subreddit", "")
                created_utc = post_data.get("created_utc", 0)

                # Extract media content
                media_data = await extract_media_from_reddit_post(post_data)

                # Combine all extracted data
                return {
                    "url": url,
                    "domain": "reddit.com",
                    "status_code": 200,
                    "content_type": "application/json",
                    "title": title,
                    "text": selftext or f"Post by u/{author}: {title}",
                    "author": author,
                    "subreddit": subreddit,
                    "created_utc": created_utc,
                    "up_votes": post_data.get("ups", 0),
                    "down_votes": post_data.get("downs", 0),
                    "score": post_data.get("score", 0),
                    **media_data,  # Include all media data
                }

        # If JSON approach fails, try HTML approach
        logger.warning(
            f"Failed to extract content from Reddit JSON API for {url}, falling back to HTML"
        )
        html_response = await client.get(url, headers=headers, follow_redirects=True)
        html_response.raise_for_status()

        # For now, just return basic info
        # In a real implementation, you would use BeautifulSoup or similar to extract content
        return {
            "url": url,
            "domain": "reddit.com",
            "status_code": html_response.status_code,
            "content_type": html_response.headers.get("content-type", ""),
            "title": "Content from Reddit",
            "text": "Reddit content extracted from HTML (placeholder). This would be replaced with actual content in production.",
            "has_media": False,
        }
    except Exception as e:
        logger.error(f"Error handling Reddit URL {url}: {str(e)}")
        return None


def normalize_reddit_url(url: str) -> str:
    """Normalize different Reddit URL formats to a standard form."""
    # Convert mobile URLs to desktop
    url = url.replace("://m.reddit.com", "://www.reddit.com")
    url = url.replace("://reddit.com", "://www.reddit.com")

    # Remove tracking parameters
    if "?" in url:
        base_url = url.split("?")[0]
        return base_url

    return url


async def extract_url_content(url: str) -> Optional[Dict[str, Any]]:
    """
    Extract content from a URL.
    Supports different content sources with domain-specific handlers.

    Args:
        url: The URL to extract content from

    Returns:
        A dictionary containing the extracted content or None if extraction failed
    """
    try:
        # Parse the URL to determine the source
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()

        # Set up common headers
        headers = {
            "User-Agent": DEFAULT_USER_AGENT,
        }

        # Increase timeout to handle slow responses
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use domain-specific handlers
            if "reddit.com" in domain:
                return await handle_reddit_url(url, client)

            # Generic handler for other URLs
            try:
                response = await client.get(url, headers=headers, follow_redirects=True)
                response.raise_for_status()

                # For now, just return basic info
                # This will be expanded to extract actual content based on the source
                return {
                    "url": url,
                    "domain": domain,
                    "status_code": response.status_code,
                    "content_type": response.headers.get("content-type", ""),
                    # Placeholder for actual content extraction
                    "title": f"Content from {domain}",
                    "text": "Placeholder text content. This will be replaced with actual content extraction.",
                    "has_media": False,
                }
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error: {e.response.status_code} for URL {url}")
                return None
            except httpx.RequestError as e:
                logger.error(f"Request error for URL {url}: {str(e)}")
                return None

    except Exception as e:
        logger.error(f"Error extracting content from {url}: {str(e)}")
        return None
