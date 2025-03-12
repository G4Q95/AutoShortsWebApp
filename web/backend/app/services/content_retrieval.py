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
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)
REDDIT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0"
)

# Rate limiting constants
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0
MAX_BACKOFF = 8.0

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
    if post_data.get("is_video") is False and post_data.get("post_hint") == "image":
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
    elif post_data.get("is_video") is True and post_data.get("media"):
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
    logger = logging.getLogger(__name__)
    logger.info(f"Handling Reddit URL: {url}")
    
    # Normalize Reddit URL formats
    original_url = url
    url = normalize_reddit_url(url)
    if original_url != url:
        logger.info(f"Normalized URL from '{original_url}' to '{url}'")
    
    try:
        # Define comprehensive headers to mimic a real browser
        headers = {
            "User-Agent": REDDIT_USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }
        logger.info(f"Using Reddit user agent: {REDDIT_USER_AGENT}")

        # Add .json to the URL to get JSON data
        json_url = url
        if not json_url.endswith(".json"):
            json_url = url + ".json"
            logger.info(f"Added .json extension: {json_url}")

        # Simple delay to avoid rate limiting
        logger.info("Adding 0.5s delay to avoid rate limiting")
        await asyncio.sleep(0.5)

        # Get the JSON data
        logger.info(f"Making HTTP request to: {json_url}")
        json_response = await client.get(json_url, headers=headers, follow_redirects=True)
        logger.info(f"Response status code: {json_response.status_code}")
        
        if json_response.status_code != 200:
            logger.error(f"Non-200 status code: {json_response.status_code}")
            logger.debug(f"Response headers: {dict(json_response.headers)}")
            try:
                logger.debug(f"Response content preview: {json_response.content[:200]}")
            except Exception:
                logger.debug("Could not log response content")
                
        json_response.raise_for_status()

        if json_response.status_code == 200:
            logger.info("Successfully got JSON response")
            try:
                data = json_response.json()
                logger.info(f"Parsed JSON data, type: {type(data)}")
                
                if isinstance(data, list):
                    logger.info(f"JSON data is a list of length {len(data)}")
                elif isinstance(data, dict):
                    logger.info(f"JSON data is a dict with keys: {list(data.keys())}")
                
                post_data = None

                # Extract post data from Reddit JSON structure
                if isinstance(data, list) and len(data) > 0:
                    # Standard Reddit post
                    logger.info("Extracting data from standard Reddit post format")
                    try:
                        post_data = data[0]["data"]["children"][0]["data"]
                        logger.info("Successfully extracted post data from list format")
                    except (KeyError, IndexError) as e:
                        logger.error(f"Error extracting post data from list: {str(e)}")
                        logger.debug(f"Data structure: {data}")
                elif isinstance(data, dict) and "data" in data:
                    # Some Reddit formats
                    logger.info("Extracting data from dictionary Reddit format")
                    try:
                        if "children" in data["data"] and len(data["data"]["children"]) > 0:
                            post_data = data["data"]["children"][0]["data"]
                            logger.info("Successfully extracted post data from dict format")
                    except (KeyError, IndexError) as e:
                        logger.error(f"Error extracting post data from dict: {str(e)}")
                        logger.debug(f"Data structure: {data}")

                if post_data:
                    logger.info("Post data extraction successful")
                    # Process and extract data...
                    
                    # Extract media content
                    logger.info("Extracting media content")
                    media_data = await extract_media_from_reddit_post(post_data)
                    
                    logger.info(f"Media extraction result: has_media={media_data.get('has_media')}, type={media_data.get('media_type')}")
                    if media_data.get('media_url'):
                        logger.info(f"Media URL found: {media_data.get('media_url')}")
                    
                    # Combine all extracted data
                    result = {
                        "url": url,
                        "domain": "reddit.com",
                        "status_code": 200,
                        "content_type": "application/json",
                        "title": post_data.get("title", ""),
                        "text": post_data.get("selftext", "") or f"Post by u/{post_data.get('author', 'unknown')}: {post_data.get('title', '')}",
                        "author": post_data.get("author", "unknown"),
                        "subreddit": post_data.get("subreddit", ""),
                        "created_utc": post_data.get("created_utc", 0),
                        "up_votes": post_data.get("ups", 0),
                        "down_votes": post_data.get("downs", 0),
                        "score": post_data.get("score", 0),
                        **media_data,  # Include all media data
                    }
                    logger.info("Successfully created result dictionary")
                    return result
                else:
                    logger.error("No post data found in Reddit response")
            except Exception as e:
                logger.exception(f"Error processing Reddit JSON: {str(e)}")
                return None

    except Exception as e:
        logger.exception(f"Error handling Reddit URL {url}: {str(e)}")
        return None

    logger.error("No data could be extracted from Reddit URL")
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
    logger = logging.getLogger(__name__)
    logger.info(f"Starting content extraction for URL: {url}")
    
    try:
        # Parse the URL to determine the source
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()
        logger.info(f"Parsed domain: {domain}")

        # Set up common headers
        headers = {
            "User-Agent": DEFAULT_USER_AGENT,
        }
        logger.info(f"Using user agent: {DEFAULT_USER_AGENT}")

        # Increase timeout to handle slow responses
        logger.info("Creating HTTP client with 30s timeout")
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use domain-specific handlers
            if "reddit.com" in domain:
                logger.info("Detected Reddit URL, using Reddit handler")
                result = await handle_reddit_url(url, client)
                if result:
                    logger.info(f"Reddit content extraction successful, found media: {bool(result.get('media_url'))}")
                    logger.info(f"Media type: {result.get('media_type')}")
                    logger.info(f"Media URL: {result.get('media_url')}")
                else:
                    logger.error("Reddit content extraction failed, no data returned")
                return result
            else:
                logger.warning(f"No specific handler for domain: {domain}")
                # Generic handler code...
    except Exception as e:
        logger.exception(f"Error in content extraction: {str(e)}")
        return None
