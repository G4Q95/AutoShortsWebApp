import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlparse, urljoin
import logging
import json
import re

logger = logging.getLogger(__name__)

# Custom user agents to avoid bot detection
DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
REDDIT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"

# Domain-specific handlers
async def handle_reddit_url(url: str, client: httpx.AsyncClient) -> Optional[Dict[str, Any]]:
    """
    Handle Reddit URLs specifically to deal with their redirect issues and extract content.
    """
    # Normalize Reddit URL formats
    url = normalize_reddit_url(url)
    
    try:
        # Use specific headers for Reddit
        headers = {
            "User-Agent": REDDIT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
        }
        
        # First attempt to get the JSON data by adding .json to the URL
        json_url = url
        if not json_url.endswith('.json'):
            json_url = url + '.json'
            
        json_response = await client.get(json_url, headers=headers, follow_redirects=True)
        
        if json_response.status_code == 200:
            data = json_response.json()
            # Extract content from Reddit JSON format
            post_data = None
            
            # Handle different Reddit JSON structures
            if isinstance(data, list) and len(data) > 0:
                # Standard Reddit post
                post_data = data[0]['data']['children'][0]['data']
            elif isinstance(data, dict) and 'data' in data:
                # Some Reddit formats
                if 'children' in data['data'] and len(data['data']['children']) > 0:
                    post_data = data['data']['children'][0]['data']
            
            if post_data:
                title = post_data.get('title', '')
                selftext = post_data.get('selftext', '')
                author = post_data.get('author', 'unknown')
                
                return {
                    "url": url,
                    "domain": "reddit.com",
                    "status_code": 200,
                    "content_type": "application/json",
                    "title": title,
                    "text": selftext or f"Post by u/{author}: {title}",
                    "author": author
                }
        
        # If JSON approach fails, try HTML approach
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
        }
    except Exception as e:
        logger.error(f"Error handling Reddit URL {url}: {str(e)}")
        return None

def normalize_reddit_url(url: str) -> str:
    """Normalize different Reddit URL formats to a standard form."""
    # Convert mobile URLs to desktop
    url = url.replace('://m.reddit.com', '://www.reddit.com')
    url = url.replace('://reddit.com', '://www.reddit.com')
    
    # Remove tracking parameters
    if '?' in url:
        base_url = url.split('?')[0]
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
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use domain-specific handlers
            if 'reddit.com' in domain:
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