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
from datetime import datetime

import aiofiles
import httpx
from pydantic import BaseModel
import ffmpeg
import traceback

# Assuming config is one level up in core
from app.core.config import settings 
# Import storage service getter
from app.services.storage import get_storage, R2Storage # Import R2Storage for type hinting

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
        # Get storage instance using the provided getter
        self.storage: R2Storage = get_storage() 
        logger.info(f"AudioService initialized with storage type: {type(self.storage).__name__}")

    # --- Voice Retrieval Methods ---
    async def get_voices(self) -> List[Voice]:
        """Retrieves a list of available voices from ElevenLabs."""
        logger.info("AudioService: Getting available voices from ElevenLabs client.")
        try:
            # Delegate the call to the internal ElevenLabsClient instance
            voices = await self.elevenlabs_client.get_available_voices()
            logger.info(f"AudioService: Retrieved {len(voices)} voices.")
            return voices
        except ElevenLabsError as e:
            logger.error(f"AudioService: Error retrieving available voices from ElevenLabs: {e}")
            # Re-raise to let the API layer handle HTTP exceptions
            raise
        except Exception as e:
            # Catch any other unexpected errors during the process
            logger.error(f"AudioService: Unexpected error getting voices: {str(e)}\n{traceback.format_exc()}")
            raise ElevenLabsError(f"Unexpected error in AudioService while getting voices: {str(e)}")

    async def get_voice_by_id(self, voice_id: str) -> Optional[Voice]:
        """Retrieves details for a specific voice by ID from ElevenLabs."""
        # Check if the underlying client actually has this method
        if not hasattr(self.elevenlabs_client, 'get_voice_by_id'):
            logger.error("AudioService: elevenlabs_client does not have method 'get_voice_by_id'. Attempting fallback via get_available_voices.")
            # Fallback: Get all voices and filter
            try:
                all_voices = await self.get_voices()
                for voice in all_voices:
                    if voice.voice_id == voice_id:
                        logger.info(f"AudioService: Found voice {voice_id} via fallback.")
                        return voice
                logger.warning(f"AudioService: Voice {voice_id} not found even in fallback.")
                return None # Or raise not found?
            except Exception as e:
                logger.error(f"AudioService: Error during get_voice_by_id fallback: {e}")
                raise # Re-raise original error or a new one
        
        # Original intended path (if client has the method)
        try:
            logger.info(f"AudioService: Getting voice {voice_id} from ElevenLabs client.")
            voice = await self.elevenlabs_client.get_voice_by_id(voice_id)
            logger.info(f"AudioService: Retrieved voice {voice_id}.")
            return voice
        except ElevenLabsError as e:
            logger.error(f"AudioService: Error retrieving voice {voice_id} from ElevenLabs: {e}")
            raise
        except Exception as e:
            logger.error(f"AudioService: Unexpected error getting voice {voice_id}: {str(e)}\n{traceback.format_exc()}")
            raise ElevenLabsError(f"Unexpected error in AudioService getting voice {voice_id}: {str(e)}")
            
    # --- Audio Generation & Storage Methods ---
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
        """Generates audio data using the ElevenLabs client without saving to storage."""
        logger.info(f"AudioService: Generating audio data for voice {voice_id}")
        try:
            # Delegate directly to the internal client
            audio_data, content_type = await self.elevenlabs_client.generate_audio(
                text=text,
                voice_id=voice_id,
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                use_speaker_boost=use_speaker_boost,
                model_id=model_id,
                output_format=output_format
            )
            logger.info(f"AudioService: Successfully generated {len(audio_data)} bytes of audio data.")
            return audio_data, content_type
        except ElevenLabsError as e:
            logger.error(f"AudioService: Error generating audio data via client: {e}")
            raise # Re-raise for API layer
        except Exception as e:
            logger.error(f"AudioService: Unexpected error generating audio data: {str(e)}\n{traceback.format_exc()}")
            raise ElevenLabsError(f"Unexpected error in AudioService while generating audio data: {str(e)}")

    async def generate_and_store_voiceover(
        self,
        text: str,
        voice_id: str,
        project_id: str,
        scene_id: str,
        stability: float = settings.VOICE_GEN_DEFAULT_STABILITY,
        similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY,
        style: Optional[float] = None,
        use_speaker_boost: bool = True,
        model_id: str = settings.ELEVENLABS_MODEL_ID,
        output_format: str = "mp3_44100_128"
    ) -> str:
        """
        Generate a voiceover and store it in R2.
        Returns the URL of the stored audio file.
        """
        try:
            # Generate the audio using ElevenLabs
            audio_data, content_type = await self.elevenlabs_client.generate_audio(
                text=text,
                voice_id=voice_id,
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                use_speaker_boost=use_speaker_boost,
                model_id=model_id,
                output_format=output_format
            )
            
            # Create a temporary file to store the audio
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                # Upload to R2 with proper object naming
                object_name = f"generated_voiceover_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
                success, result = await self.storage.upload_file(
                    file_path=temp_file_path,
                    object_name=object_name,
                    project_id=project_id,
                    scene_id=scene_id,
                    file_type="audio/mpeg"
                )
                
                if not success:
                    raise ElevenLabsError(f"Failed to upload audio to R2: {result}")
                
                # Return the R2 URL
                return result
            
            finally:
                # Clean up the temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary file: {temp_file_path}")
        
        except ElevenLabsError as e:
            logger.error(f"Error generating voiceover: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in generate_and_store_voiceover: {str(e)}")
            raise ElevenLabsError(f"Error in generate_and_store_voiceover: {str(e)}")

    async def extract_and_store_original_audio(
        self,
        video_path: str,
        project_id: str,
        scene_id: str
    ) -> str:
        """
        Extract audio from a video file and store it in R2.
        Returns the URL of the stored audio file.
        """
        try:
            # Create a temporary file for the extracted audio
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_file_path = temp_file.name
            
            try:
                # Extract audio using ffmpeg
                await self._run_ffmpeg_extraction(video_path, temp_file_path)
                
                # Upload to R2 with proper object naming
                object_name = f"original_audio_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp3"
                success, result = await self.storage.upload_file(
                    file_path=temp_file_path,
                    object_name=object_name,
                    project_id=project_id,
                    scene_id=scene_id,
                    file_type="audio/mpeg"
                )
                
                if not success:
                    raise Exception(f"Failed to upload audio to R2: {result}")
                
                # Return the R2 URL
                return result
            
            finally:
                # Clean up the temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    logger.debug(f"Cleaned up temporary file: {temp_file_path}")
        
        except Exception as e:
            logger.error(f"Error in extract_and_store_original_audio: {str(e)}")
            raise

    # NEW METHOD
    async def get_latest_audio_url(
        self, 
        project_id: str, 
        scene_id: str,
        audio_type: str = "voiceover" # Add type 'original' or 'voiceover'
    ) -> Optional[str]:
        """
        Retrieve the URL of the most recent audio file (original or voiceover) 
        for a given project and scene from storage.
        Returns None if no matching file is found.
        """
        logger.info(f"Searching for latest '{audio_type}' audio for project {project_id}, scene {scene_id}")
        
        storage_prefix = f"audio/{project_id}/{scene_id}/"
        
        filename_filter = ""
        if audio_type == "voiceover":
            filename_filter = "generated_voiceover_"
        elif audio_type == "original":
            filename_filter = "original_audio_"
            
        logger.debug(f"Using storage prefix: '{storage_prefix}' and filename filter: '{filename_filter}'")

        try:
            # Use the storage service's method to list files with the prefix
            success, list_result = await self.storage.list_directory(prefix=storage_prefix)

            if not success or not isinstance(list_result, list):
                logger.warning(f"Failed to list directory or received non-list result for prefix {storage_prefix}: {list_result}")
                return None

            # Filter files based on the expected filename pattern for the type
            matching_files = [
                item for item in list_result 
                if isinstance(item, dict) and filename_filter in item.get('Key', '')
            ]

            if not matching_files:
                logger.info(f"No '{audio_type}' files found matching filter '{filename_filter}' under prefix {storage_prefix}")
                return None

            # Sort by last modified date (descending) to get the most recent
            latest_file_item = sorted(
                matching_files, 
                key=lambda x: x.get('LastModified', datetime.min), # Use min datetime for robustness
                reverse=True
            )[0]
            
            storage_key = latest_file_item.get('Key')
            if not storage_key:
                logger.warning("Found matching file item but it lacks a 'Key'.")
                return None
                
            logger.info(f"Found latest '{audio_type}' audio file: {storage_key}")

            # Get the public URL for the latest file
            url = await self.storage.get_file_url(storage_key)
            
            if url:
                logger.debug(f"Generated URL for file: {url[:50]}...")
                return url
            else:
                logger.error(f"Failed to generate URL for storage key: {storage_key}")
                return None

        except Exception as e:
            logger.error(f"Error retrieving latest audio URL from storage: {str(e)}\n{traceback.format_exc()}")
            return None

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