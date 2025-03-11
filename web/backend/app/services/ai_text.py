import logging
from typing import Optional

import openai

from app.core.config import settings

logger = logging.getLogger(__name__)

# Set up OpenAI API key
openai.api_key = settings.OPENAI_API_KEY


async def rewrite_text(
    text: str, style: str = "engaging", max_length: Optional[int] = None
) -> Optional[str]:
    """
    Rewrite text using OpenAI's GPT model to make it more engaging for short videos.

    Args:
        text: The original text to rewrite
        style: Style for the rewritten text (e.g., engaging, humorous, professional)
        max_length: Maximum character length for the rewritten text

    Returns:
        The rewritten text or None if rewriting failed
    """
    if not text or not text.strip():
        return None

    try:
        # Construct prompt based on style and length constraints
        prompt = f"Rewrite the following text in an {style} style"
        if max_length:
            prompt += f" with a maximum of {max_length} characters"
        prompt += (
            " for a short-form video. Keep the essential information but make it more engaging:\n\n"
        )

        # Create completion with OpenAI
        response = await openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a content writer specializing in short-form videos.",
                },
                {"role": "user", "content": prompt + text},
            ],
            max_tokens=1000,
            temperature=0.7,
        )

        # Extract and return the rewritten text
        rewritten_text = response.choices[0].message.content.strip()
        return rewritten_text

    except Exception as e:
        logger.error(f"Error rewriting text with OpenAI: {str(e)}")
        return None
