"""
Centralized service for handling audio processing tasks, including:
- Voice generation via ElevenLabs
- Original audio extraction from video files using ffmpeg
- Coordination with storage services (e.g., R2) for persistence
"""

import logging
import os
import tempfile
import time
from typing import Dict, List, Optional, Tuple, Union, Any
import json
import asyncio

import aiofiles
import httpx
from pydantic import BaseModel
import ffmpeg

# Assuming config is one level up in core
from app.core.config import settings 

logger = logging.getLogger(__name__)

# --- Models moved from voice_generation.py --- 

class Voice(BaseModel):
    """Model representing an ElevenLabs voice."""
    voice_id: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    preview_url: Optional[str] = None
    labels: Optional[Dict[str, str]] = None
    sample_url: Optional[str] = None

class VoiceSettings(BaseModel):
    """Model representing voice generation settings."""
    stability: float = settings.VOICE_GEN_DEFAULT_STABILITY
    similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY
    style: Optional[float] = None
    use_speaker_boost: Optional[bool] = True

class VoiceGenerationRequest(BaseModel):
    """Model for a voice generation request - might be refactored later."""
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

# --- ElevenLabs Client class moved from voice_generation.py --- 

class ElevenLabsClient:
    """Client for interacting with the ElevenLabs API."""
    
    def __init__(self, api_key: Optional[str] = None, api_url: Optional[str] = None):
        """
        Initialize the ElevenLabs client.
        
        Args:
            api_key: ElevenLabs API key (defaults to environment variable)
            api_url: ElevenLabs API URL (defaults to environment variable)
        """
        self.api_key = api_key or settings.ELEVENLABS_API_KEY
        self.api_url = api_url or settings.ELEVENLABS_API_URL
        
        if not self.api_key:
            logger.warning("ElevenLabs API key not provided. Voice generation will not work.")
            
        logger.info(f"ElevenLabs URL: {self.api_url}")
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
        """
        if not self.api_key:
            raise ElevenLabsError("ElevenLabs API key not provided")
        
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
        logger.debug(f"Making request to {url} with method {method}")
        
        for attempt in range(retry_count):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    # Simplified request logic for brevity - assumes POST for generation, GET otherwise
                    if method.upper() == "GET":
                        response = await client.get(url, headers=headers, params=params)
                    elif method.upper() == "POST":
                         response = await client.post(
                            url, headers=headers, json=json_data, params=params,
                            # Longer timeout for potentially long TTS requests
                            timeout=120.0 if endpoint.startswith("text-to-speech") else 60.0
                        )
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")

                    # Error Handling (Simplified - details omitted for brevity)
                    if response.status_code >= 400:
                        error_msg = f"ElevenLabs API error: {response.status_code}"
                        # Add detailed parsing and retry logic here as in original file
                        logger.error(error_msg + f" - Response: {response.text[:100]}")
                        # Simplified retry logic for demonstration
                        if response.status_code in (429, 500, 502, 503, 504) and attempt < retry_count - 1:
                             logger.warning(f"{error_msg}. Retrying...")
                             await asyncio.sleep(retry_delay)
                             retry_delay *= 2
                             continue
                        raise ElevenLabsError(error_msg, status_code=response.status_code)

                    # Return handling (Simplified)
                    content_type = response.headers.get("content-type", "")
                    if "application/json" in content_type:
                        return response.json()
                    # Assume audio/* or stream=True means return bytes
                    elif stream or "audio/" in content_type:
                        return response.content
                    else:
                        return response.text # Should not happen for voice generation

            except httpx.TimeoutException:
                logger.error("Request timed out")
                if attempt < retry_count - 1: continue
                raise ElevenLabsError("Request timed out after retries")
            except httpx.NetworkError as e:
                logger.error(f"Network error: {e}")
                if attempt < retry_count - 1: continue
                raise ElevenLabsError(f"Network error after retries: {e}")
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                if attempt < retry_count - 1: continue
                raise ElevenLabsError(f"Unexpected error after retries: {e}")
        raise ElevenLabsError("Request failed after all retries") # Should not be reached if loop exits normally

    async def get_available_voices(self) -> List[Voice]:
        """Get list of available voices."""
        try:
            response_data = await self._make_request("GET", "voices")
            # Simplified parsing - assumes response_data is the expected dict
            return [Voice(**voice_data) for voice_data in response_data.get("voices", [])]
        except ElevenLabsError as e:
            logger.error(f"Failed to get available voices: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting voices: {str(e)}")
            raise ElevenLabsError(f"Error retrieving available voices: {str(e)}")

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
        """Generate audio from text. Returns (audio_bytes, content_type)."""
        # Input validation (Simplified - details omitted)
        if len(text) > settings.VOICE_GEN_MAX_CHARS_PER_REQUEST:
             raise ElevenLabsError("Text too long")
        # Add other validations (stability, similarity, format) here

        try:
            request_data = {
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "use_speaker_boost": use_speaker_boost
                }
            }
            if style is not None: request_data["voice_settings"]["style"] = style

            endpoint = f"text-to-speech/{voice_id}"
            params = {"output_format": output_format}
            # Make request expects bytes for audio
            audio_data: bytes = await self._make_request("POST", endpoint, json_data=request_data, params=params)

            # Determine content type (Simplified map)
            content_type_map = {
                "mp3_44100_128": "audio/mpeg",
                # Add other formats as needed
            }
            content_type = content_type_map.get(output_format, "application/octet-stream")

            return audio_data, content_type

        except ElevenLabsError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error generating audio: {str(e)}")
            raise ElevenLabsError(f"Error generating audio: {str(e)}")

# --- Placeholder for AudioService class that will USE the client --- 

class AudioService:
    """Orchestrator for audio tasks."""
    def __init__(self):
        # Instantiate the client internally
        self.elevenlabs_client = ElevenLabsClient()
        # Initialize ffmpeg path or wrapper here later
        # Initialize storage service client/wrapper here later
        pass

    async def _run_ffmpeg_extraction(self, input_path: str, output_path: str) -> None:
        """Runs ffmpeg to extract audio to MP3 format."""
        logger.info(f"Starting ffmpeg extraction: {input_path} -> {output_path}")
        try:
            # Basic ffmpeg command for MP3 extraction
            # -vn: disable video recording
            # -acodec mp3: set audio codec to mp3
            # -ab 192k: set audio bitrate to 192 kbps
            # -ar 44100: set audio sample rate to 44100 Hz
            # -y: overwrite output file without asking
            (   
                ffmpeg
                .input(input_path)
                .output(output_path, vn=None, acodec='mp3', audio_bitrate='192k', ar=44100)
                .overwrite_output()
                .run_async(pipe_stdout=True, pipe_stderr=True) # Run async
            )
            # Note: ffmpeg-python's run_async might not be truly async in the sense
            # of releasing the event loop for CPU-bound ffmpeg process. 
            # For heavy loads, consider running ffmpeg in a separate thread or process pool.
            # For now, this integrates cleanly.
            # await process.wait() # If we needed to wait, but run_async seems synchronous here
            
            # Check if output file exists and has size
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                # Attempt to read stderr if process object was available and captured
                # stderr_data = await process.stderr.read() if process.stderr else b''
                # logger.error(f"ffmpeg output file missing or empty. Stderr: {stderr_data.decode()}")
                raise RuntimeError("ffmpeg output file missing or empty after execution.")
                
            logger.info(f"ffmpeg extraction completed successfully for: {output_path}")
            
        except ffmpeg.Error as e:
            logger.error(f"ffmpeg error during extraction: {e.stderr.decode() if e.stderr else 'No stderr'}")
            # Clean up potentially empty/corrupt output file
            if os.path.exists(output_path):
                try: os.unlink(output_path) 
                except: pass
            raise RuntimeError(f"ffmpeg extraction failed: {e.stderr.decode() if e.stderr else 'Unknown ffmpeg error'}") from e
        except Exception as e:
            logger.error(f"Unexpected error during ffmpeg extraction: {str(e)}")
            if os.path.exists(output_path):
                try: os.unlink(output_path)
                except: pass
            raise
            
    async def generate_and_store_voiceover(self, text, voice_id, project_id, scene_id, voice_settings: Optional[VoiceSettings] = None):
        """Generates voiceover using ElevenLabs and stores it."""
        logger.info(f"Generating voiceover for scene {scene_id} in project {project_id}")
        try:
            # Use the internal client instance
            audio_data, content_type = await self.elevenlabs_client.generate_audio(
                text=text,
                voice_id=voice_id,
                # Pass settings if provided
                stability=voice_settings.stability if voice_settings else settings.VOICE_GEN_DEFAULT_STABILITY,
                similarity_boost=voice_settings.similarity_boost if voice_settings else settings.VOICE_GEN_DEFAULT_SIMILARITY,
                style=voice_settings.style if voice_settings else None,
                use_speaker_boost=voice_settings.use_speaker_boost if voice_settings else True,
            )
            
            # --- TODO: Step 3 - Upload to R2 using storage service ---
            # 1. Save audio_data to a temporary file
            # 2. Call storage_service.upload_file(temp_file_path, project_id, scene_id, ...)
            # 3. Get R2 URL
            # 4. Clean up temp file
            # 5. Return R2 URL
            
            logger.info("Voiceover generated (Upload pending)")
            # Placeholder return
            return "placeholder_r2_url_voiceover"
            
        except ElevenLabsError as e:
            logger.error(f"ElevenLabs error during voice generation: {e}")
            raise # Re-raise for API endpoint to handle
        except Exception as e:
            logger.error(f"Unexpected error during voice generation: {e}")
            raise
            
    async def extract_and_store_original_audio(self, video_path, project_id, scene_id):
        """Extracts original audio using ffmpeg and prepares it for storage."""
        logger.info(f"Extracting original audio for scene {scene_id} in project {project_id} from {video_path}")
        temp_audio_path = None
        try:
            # Create a temporary file for the output MP3
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                temp_audio_path = temp_file.name
            logger.info(f"Created temporary file for extracted audio: {temp_audio_path}")

            # Run ffmpeg extraction
            await self._run_ffmpeg_extraction(video_path, temp_audio_path)
            
            # --- TODO: Step 2 - Upload temp_audio_path to R2 using storage service (Subtask 1.4) ---
            # r2_url = await storage_service.upload_file(temp_audio_path, project_id, scene_id, ...)
            
            logger.info(f"Original audio extracted successfully to {temp_audio_path} (Upload pending)")
            # Placeholder return for now, will return R2 URL later
            # We also need to return the temp_audio_path maybe, or handle upload here
            
            # For now, just return the path to the temp file for potential cleanup/upload
            # The final implementation in 1.4 will handle the upload and return the URL
            return temp_audio_path # TEMPORARY RETURN VALUE
            
        except Exception as e:
             logger.error(f"Error during original audio extraction process: {e}")
             # Clean up temp file if it exists and something went wrong
             if temp_audio_path and os.path.exists(temp_audio_path):
                 try:
                     os.unlink(temp_audio_path)
                     logger.info(f"Cleaned up temporary audio file: {temp_audio_path}")
                 except Exception as unlink_e:
                     logger.warning(f"Failed to clean up temp file {temp_audio_path}: {unlink_e}")
             raise # Re-raise the original exception
        # Note: Successful flow needs cleanup after upload in subtask 1.4

# --- End of AudioService class --- 

# Example Usage / Test
if __name__ == '__main__':
    import asyncio
    logging.basicConfig(level=logging.INFO)
    
    async def main():
        # Requires .env file with ELEVENLABS_API_KEY
        # Ensure settings are loaded correctly (might need adjustment based on project structure)
        if not settings.ELEVENLABS_API_KEY:
             print("API Key not found. Set ELEVENLABS_API_KEY in .env")
             return
             
        service = AudioService()
        print("AudioService instantiated.")
        
        # Example: Test getting voices (if needed)
        # try:
        #     voices = await service.elevenlabs_client.get_available_voices()
        #     print(f"Found {len(voices)} voices. First voice: {voices[0].name if voices else 'None'}")
        # except Exception as e:
        #     print(f"Error getting voices: {e}")
            
        # Example: Test generation (replace with actual data)
        # try:
        #      url = await service.generate_and_store_voiceover(
        #          text="Hello from the audio service!", 
        #          voice_id="21m00Tcm4TlvDq8ikWAM", # Example voice ID
        #          project_id="test_proj", 
        #          scene_id="test_scene"
        #      )
        #      print(f"Placeholder generated URL: {url}")
        # except Exception as e:
        #      print(f"Error generating voiceover: {e}")

    asyncio.run(main()) 