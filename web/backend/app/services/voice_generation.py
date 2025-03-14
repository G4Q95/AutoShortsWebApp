"""
ElevenLabs voice generation service.

This module provides functionality to generate audio from text using the ElevenLabs API.
It handles authentication, voice selection, text-to-speech conversion, and error handling.
"""

import logging
import os
import tempfile
import time
from typing import Dict, List, Optional, Tuple, Union, Any
import json

import aiofiles
import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

# Models for voice data
class Voice(BaseModel):
    """Model representing an ElevenLabs voice."""
    voice_id: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    preview_url: Optional[str] = None
    # Additional fields
    labels: Optional[Dict[str, str]] = None
    sample_url: Optional[str] = None

class VoiceSettings(BaseModel):
    """Model representing voice generation settings."""
    stability: float = settings.VOICE_GEN_DEFAULT_STABILITY
    similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY
    style: Optional[float] = None
    use_speaker_boost: Optional[bool] = True

class VoiceGenerationRequest(BaseModel):
    """Model for a voice generation request."""
    text: str
    voice_id: str
    model_id: str = settings.ELEVENLABS_MODEL_ID
    voice_settings: Optional[VoiceSettings] = None
    output_format: str = "mp3_44100_128"

class ElevenLabsError(Exception):
    """Exception raised for ElevenLabs API errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(self.message)

# ElevenLabs API client
class ElevenLabsClient:
    """Client for interacting with the ElevenLabs API."""
    
    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        """
        Initialize the ElevenLabs client.
        
        Args:
            api_key: ElevenLabs API key (defaults to environment variable)
            api_url: ElevenLabs API URL (defaults to environment variable)
        """
        # Use the provided API key or get from environment
        self.api_key = api_key or settings.ELEVENLABS_API_KEY
        self.api_url = api_url or settings.ELEVENLABS_API_URL
        
        if not self.api_key:
            logger.warning("ElevenLabs API key not provided. Voice generation will not work.")
            
        # Log API settings for debugging
        logger.info(f"ElevenLabs URL: {self.api_url}")
        # Don't log the full API key, just a portion to verify
        if self.api_key:
            masked_key = f"{self.api_key[:5]}...{self.api_key[-5:]}"
            logger.info(f"ElevenLabs API key (masked): {masked_key}")
            logger.info(f"API key length: {len(self.api_key)}")
        
    async def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        stream: bool = False,
        retry_count: int = 3,
        retry_delay: float = 1.0
    ) -> Union[Dict[str, Any], bytes]:
        """
        Make a request to the ElevenLabs API with retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint (without base URL)
            json_data: JSON data to send (for POST requests)
            params: Query parameters
            stream: Whether to stream the response
            retry_count: Number of retries on failure
            retry_delay: Delay between retries in seconds
            
        Returns:
            Response data as JSON dict or bytes for audio
            
        Raises:
            ElevenLabsError: If the request fails after retries
        """
        if not self.api_key:
            raise ElevenLabsError("ElevenLabs API key not provided")
        
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        
        # Use the correct header format for ElevenLabs API
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        # Log the request for debugging (masking the API key)
        logger.debug(f"Making request to {url} with method {method}")
        
        # Initialize retry loop
        for attempt in range(retry_count):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    if method.upper() == "GET":
                        response = await client.get(url, headers=headers, params=params)
                    elif method.upper() == "POST":
                        if stream:
                            response = await client.post(
                                url, 
                                headers=headers, 
                                json=json_data,
                                params=params,
                                timeout=120.0
                            )
                        else:
                            response = await client.post(
                                url, 
                                headers=headers, 
                                json=json_data,
                                params=params
                            )
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")
                    
                    # Check for errors
                    if response.status_code >= 400:
                        error_msg = f"ElevenLabs API error: {response.status_code}"
                        try:
                            error_data = response.json()
                            error_detail = error_data.get("detail", {})
                            if isinstance(error_detail, dict) and "message" in error_detail:
                                error_msg = f"{error_msg} - {error_detail['message']}"
                            elif "message" in error_data:
                                error_msg = f"{error_msg} - {error_data['message']}"
                        except Exception:
                            # If we can't parse the JSON, use the text
                            error_msg = f"{error_msg} - {response.text[:100]}"
                        
                        # Determine if we should retry based on status code
                        if response.status_code in (429, 500, 502, 503, 504) and attempt < retry_count - 1:
                            logger.warning(f"{error_msg}. Retrying in {retry_delay} seconds... (attempt {attempt + 1}/{retry_count})")
                            time.sleep(retry_delay)
                            # Increase delay for next retry (exponential backoff)
                            retry_delay *= 2
                            continue
                        
                        # If we shouldn't retry or we're out of retries, raise an error
                        raise ElevenLabsError(
                            error_msg,
                            status_code=response.status_code,
                            response_data=response.json() if response.headers.get("content-type") == "application/json" else None
                        )
                    
                    # Return appropriate data based on content type
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return response.json()
                    elif stream or "audio/" in content_type:
                        return response.content
                    else:
                        return response.text
                        
            except httpx.TimeoutException:
                if attempt < retry_count - 1:
                    logger.warning(f"Request timed out. Retrying in {retry_delay} seconds... (attempt {attempt + 1}/{retry_count})")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                raise ElevenLabsError("Request timed out after multiple retries")
                
            except httpx.NetworkError as e:
                if attempt < retry_count - 1:
                    logger.warning(f"Network error: {str(e)}. Retrying in {retry_delay} seconds... (attempt {attempt + 1}/{retry_count})")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                raise ElevenLabsError(f"Network error after multiple retries: {str(e)}")
                
            except Exception as e:
                if attempt < retry_count - 1:
                    logger.warning(f"Unexpected error: {str(e)}. Retrying in {retry_delay} seconds... (attempt {attempt + 1}/{retry_count})")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                raise ElevenLabsError(f"Unexpected error after multiple retries: {str(e)}")
    
    async def get_available_voices(self) -> List[Voice]:
        """
        Get list of available voices from ElevenLabs.
        
        Returns:
            List of Voice objects
            
        Raises:
            ElevenLabsError: If the request fails
        """
        try:
            response_data = await self._make_request("GET", "voices")
            voices = []
            
            for voice_data in response_data.get("voices", []):
                voice = Voice(
                    voice_id=voice_data.get("voice_id"),
                    name=voice_data.get("name"),
                    description=voice_data.get("description", ""),
                    preview_url=voice_data.get("preview_url", ""),
                    category=voice_data.get("category", ""),
                    labels=voice_data.get("labels", {}),
                    sample_url=voice_data.get("samples", [{}])[0].get("sample_url") if voice_data.get("samples") else None
                )
                voices.append(voice)
                
            return voices
            
        except ElevenLabsError as e:
            logger.error(f"Failed to get available voices: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error when getting voices: {str(e)}")
            raise ElevenLabsError(f"Error retrieving available voices: {str(e)}")
    
    async def get_voice_by_id(self, voice_id: str) -> Optional[Voice]:
        """
        Get a specific voice by ID.
        
        Args:
            voice_id: ID of the voice to retrieve
            
        Returns:
            Voice object if found, None otherwise
            
        Raises:
            ElevenLabsError: If the request fails
        """
        try:
            response_data = await self._make_request("GET", f"voices/{voice_id}")
            
            voice = Voice(
                voice_id=response_data.get("voice_id"),
                name=response_data.get("name"),
                description=response_data.get("description", ""),
                preview_url=response_data.get("preview_url", ""),
                category=response_data.get("category", ""),
                labels=response_data.get("labels", {}),
                sample_url=response_data.get("samples", [{}])[0].get("sample_url") if response_data.get("samples") else None
            )
            
            return voice
            
        except ElevenLabsError as e:
            if e.status_code == 404:
                logger.warning(f"Voice with ID {voice_id} not found")
                return None
            logger.error(f"Failed to get voice {voice_id}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error when getting voice {voice_id}: {str(e)}")
            raise ElevenLabsError(f"Error retrieving voice {voice_id}: {str(e)}")
    
    async def generate_audio(
        self,
        text: str,
        voice_id: str,
        stability: float = settings.VOICE_GEN_DEFAULT_STABILITY,
        similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY,
        style: Optional[float] = None,
        use_speaker_boost: bool = True,
        model_id: str = settings.ELEVENLABS_MODEL_ID,
        output_format: str = "mp3_44100_128"
    ) -> Tuple[bytes, str]:
        """
        Generate audio from text.
        
        Args:
            text: Text to convert to speech
            voice_id: ID of the voice to use
            stability: Voice stability (0.0-1.0)
            similarity_boost: Voice similarity boost (0.0-1.0)
            style: Optional style value (0.0-1.0)
            use_speaker_boost: Whether to use speaker boost
            model_id: Model ID to use
            output_format: Output format (mp3_22050_32, mp3_44100_32, mp3_44100_64, mp3_44100_96, mp3_44100_128, mp3_44100_192, pcm_8000, pcm_16000, pcm_22050, pcm_24000, pcm_44100, ulaw_8000)
            
        Returns:
            Tuple containing:
            - Audio data as bytes
            - Content type (e.g., "audio/mpeg")
            
        Raises:
            ElevenLabsError: If the request fails
        """
        # Validate character limit
        if len(text) > settings.VOICE_GEN_MAX_CHARS_PER_REQUEST:
            raise ElevenLabsError(
                f"Text too long: {len(text)} characters. Maximum is {settings.VOICE_GEN_MAX_CHARS_PER_REQUEST} characters."
            )
        
        # Validate voice parameters
        if not (0 <= stability <= 1):
            raise ElevenLabsError(f"Stability must be between 0 and 1, got {stability}")
        if not (0 <= similarity_boost <= 1):
            raise ElevenLabsError(f"Similarity boost must be between 0 and 1, got {similarity_boost}")
        if style is not None and not (0 <= style <= 1):
            raise ElevenLabsError(f"Style must be between 0 and 1, got {style}")
        
        # Validate output format
        valid_formats = [
            "mp3_22050_32", "mp3_44100_32", "mp3_44100_64", "mp3_44100_96",
            "mp3_44100_128", "mp3_44100_192", "pcm_8000", "pcm_16000",
            "pcm_22050", "pcm_24000", "pcm_44100", "ulaw_8000"
        ]
        if output_format not in valid_formats:
            raise ElevenLabsError(f"Invalid output format: {output_format}. Valid formats: {', '.join(valid_formats)}")
        
        try:
            # Prepare request data
            request_data = {
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "use_speaker_boost": use_speaker_boost
                }
            }
            
            if style is not None:
                request_data["voice_settings"]["style"] = style
            
            # Make request
            endpoint = f"text-to-speech/{voice_id}"
            params = {"output_format": output_format}
            audio_data = await self._make_request("POST", endpoint, json_data=request_data, params=params)
            
            # Determine content type based on output format
            content_type_map = {
                "mp3_22050_32": "audio/mpeg",
                "mp3_44100_32": "audio/mpeg",
                "mp3_44100_64": "audio/mpeg",
                "mp3_44100_96": "audio/mpeg",
                "mp3_44100_128": "audio/mpeg",
                "mp3_44100_192": "audio/mpeg",
                "pcm_8000": "audio/pcm",
                "pcm_16000": "audio/pcm",
                "pcm_22050": "audio/pcm",
                "pcm_24000": "audio/pcm",
                "pcm_44100": "audio/pcm",
                "ulaw_8000": "audio/ulaw"
            }
            
            content_type = content_type_map.get(output_format, "application/octet-stream")
            
            return audio_data, content_type
            
        except ElevenLabsError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error generating audio: {str(e)}")
            raise ElevenLabsError(f"Error generating audio: {str(e)}")
    
    async def save_audio_to_file(
        self,
        text: str,
        voice_id: str,
        stability: float = settings.VOICE_GEN_DEFAULT_STABILITY,
        similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY,
        style: Optional[float] = None,
        use_speaker_boost: bool = True,
        model_id: str = settings.ELEVENLABS_MODEL_ID,
        output_format: str = "mp3_44100_128"
    ) -> str:
        """
        Generate audio and save to a temporary file.
        
        Args:
            text: Text to convert to speech
            voice_id: ID of the voice to use
            stability: Voice stability (0.0-1.0)
            similarity_boost: Voice similarity boost (0.0-1.0)
            style: Optional style value (0.0-1.0)
            use_speaker_boost: Whether to use speaker boost
            model_id: Model ID to use
            output_format: Output format (mp3_22050_32, mp3_44100_32, mp3_44100_64, mp3_44100_96, mp3_44100_128, mp3_44100_192, pcm_8000, pcm_16000, pcm_22050, pcm_24000, pcm_44100, ulaw_8000)
            
        Returns:
            Path to the temporary audio file
            
        Raises:
            ElevenLabsError: If the request fails
        """
        try:
            # Generate audio
            audio_data, _ = await self.generate_audio(
                text=text,
                voice_id=voice_id,
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                use_speaker_boost=use_speaker_boost,
                model_id=model_id,
                output_format=output_format
            )
            
            # Create a temporary file for the audio
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=f".{output_format}"
            )
            temp_file.close()
            
            # Write audio data to file
            async with aiofiles.open(temp_file.name, "wb") as f:
                await f.write(audio_data)
            
            return temp_file.name
            
        except ElevenLabsError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error saving audio to file: {str(e)}")
            raise ElevenLabsError(f"Error saving audio to file: {str(e)}")


# Create a singleton client instance
_client: Optional[ElevenLabsClient] = None

def get_elevenlabs_client() -> ElevenLabsClient:
    """
    Get a singleton instance of the ElevenLabs client.
    
    Returns:
        ElevenLabs client instance
    """
    global _client
    if _client is None:
        _client = ElevenLabsClient()
    return _client


# Legacy interface for backward compatibility
async def generate_voice(
    text: str,
    voice_id: str = "default",
    output_format: str = "mp3_44100_128",
    stability: float = settings.VOICE_GEN_DEFAULT_STABILITY,
    similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY
) -> Optional[str]:
    """
    Generate voice audio from text using ElevenLabs API.

    Args:
        text: Text to convert to speech
        voice_id: ID of the voice to use
        output_format: Audio format (mp3_22050_32, mp3_44100_32, mp3_44100_64, mp3_44100_96, mp3_44100_128, mp3_44100_192, pcm_8000, pcm_16000, pcm_22050, pcm_24000, pcm_44100, ulaw_8000)
        stability: Voice stability (0.0-1.0)
        similarity_boost: Voice similarity boost (0.0-1.0)

    Returns:
        Path to the temporary audio file or None if generation failed
    """
    client = get_elevenlabs_client()
    
    if not client.api_key:
        logger.warning("ElevenLabs API key not provided, using mock voice generation")
        # Create a temporary file for the audio
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=f".{output_format}"
        )
        temp_file.close()
        return temp_file.name

    try:
        return await client.save_audio_to_file(
            text=text,
            voice_id=voice_id,
            stability=stability,
            similarity_boost=similarity_boost,
            output_format=output_format
        )
    except Exception as e:
        logger.error(f"Error generating voice: {str(e)}")
        return None
