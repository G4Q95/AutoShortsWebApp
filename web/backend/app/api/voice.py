"""
Voice generation API endpoints.

This module provides API endpoints for voice-related operations,
including voice listing, generation, and management.
"""

import logging
import os
import tempfile
from typing import List, Optional, Dict, Any
import base64
from datetime import datetime
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from fastapi.responses import JSONResponse, FileResponse, Response
from pydantic import BaseModel, Field, validator

from app.core.config import settings
from app.services.voice_generation import (
    get_elevenlabs_client, 
    Voice,
    VoiceSettings,
    ElevenLabsError
)
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

# Update router prefix to include API version
router = APIRouter(prefix="/voice", tags=["voice"])


# API Models
class VoiceResponse(BaseModel):
    """Response model for voice information."""
    voice_id: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    preview_url: Optional[str] = None
    labels: Optional[Dict[str, str]] = None

class VoiceListResponse(BaseModel):
    """Response model for list of voices."""
    voices: List[VoiceResponse]
    count: int

class GenerateVoiceRequest(BaseModel):
    """Request model for voice generation."""
    text: str
    voice_id: str
    stability: float = Field(0.5, ge=0.0, le=1.0, description="Voice stability (0.0-1.0)")
    similarity_boost: float = Field(0.75, ge=0.0, le=1.0, description="Voice similarity boost (0.0-1.0)")
    style: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional style value (0.0-1.0)")
    use_speaker_boost: Optional[bool] = Field(True, description="Whether to enhance vocal clarity")
    output_format: str = Field(
        "mp3_44100_128",
        description="Audio output format (mp3_22050_32, mp3_44100_32, mp3_44100_64, mp3_44100_96, mp3_44100_128, mp3_44100_192, pcm_8000, pcm_16000, pcm_22050, pcm_24000, pcm_44100, ulaw_8000)"
    )
    
    @validator("text")
    def validate_text_length(cls, v):
        if len(v) > settings.VOICE_GEN_MAX_CHARS_PER_REQUEST:
            raise ValueError(f"Text exceeds maximum character limit of {settings.VOICE_GEN_MAX_CHARS_PER_REQUEST}")
        return v

class GenerateVoiceResponse(BaseModel):
    """Response model for voice generation."""
    audio_base64: str
    content_type: str
    character_count: int
    processing_time: float

class ErrorResponse(BaseModel):
    """Error response model."""
    detail: str
    error_code: str
    status_code: int


# Define rate limiter (simple in-memory implementation)
class RateLimiter:
    """Simple in-memory rate limiter for voice generation."""
    def __init__(self, max_requests_per_minute: int = 10):
        self.max_requests = max_requests_per_minute
        self.request_times = []
    
    def allow_request(self) -> bool:
        """Check if a request is allowed based on rate limiting."""
        now = datetime.now()
        # Remove requests older than 1 minute
        self.request_times = [t for t in self.request_times if (now - t).total_seconds() < 60]
        
        # If under the limit, allow request
        if len(self.request_times) < self.max_requests:
            self.request_times.append(now)
            return True
        
        return False

# Create rate limiter instance
rate_limiter = RateLimiter(max_requests_per_minute=10)


@router.get("/voices", response_model=VoiceListResponse)
async def list_voices():
    """Get available voices from ElevenLabs."""
    try:
        client = get_elevenlabs_client()
        voices = await client.get_available_voices()
        
        return {
            "voices": [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category,
                    "description": voice.description,
                    "preview_url": voice.preview_url,
                    "labels": voice.labels
                }
                for voice in voices
            ],
            "count": len(voices)
        }
    except ElevenLabsError as e:
        logger.error(f"Error getting voices: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_retrieval_error"}
        )
    except Exception as e:
        logger.error(f"Unexpected error getting voices: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Error getting voices: {str(e)}", "code": "internal_server_error"}
        )


@router.get("/voices/{voice_id}", response_model=VoiceResponse)
async def get_voice(voice_id: str):
    """Get details of a specific voice."""
    try:
        client = get_elevenlabs_client()
        voice = await client.get_voice_by_id(voice_id)
        
        if not voice:
            raise HTTPException(
                status_code=404,
                detail={"message": f"Voice with ID {voice_id} not found", "code": "voice_not_found"}
            )
        
        return {
            "voice_id": voice.voice_id,
            "name": voice.name,
            "category": voice.category,
            "description": voice.description,
            "preview_url": voice.preview_url,
            "labels": voice.labels
        }
    except ElevenLabsError as e:
        logger.error(f"Error getting voice {voice_id}: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_retrieval_error"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting voice {voice_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Error getting voice: {str(e)}", "code": "internal_server_error"}
        )


@router.post("/generate", response_model=GenerateVoiceResponse)
async def generate_voice_audio(request: GenerateVoiceRequest):
    """Generate voice audio from text."""
    # Apply rate limiting
    if not rate_limiter.allow_request():
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded. Please try again later.", "code": "rate_limit_exceeded"}
        )
    
    try:
        # Check character limit
        if len(request.text) > settings.VOICE_GEN_MAX_CHARS_PER_SCENE:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": f"Text exceeds maximum character limit of {settings.VOICE_GEN_MAX_CHARS_PER_SCENE}",
                    "code": "character_limit_exceeded"
                }
            )
        
        # Start timing
        start_time = datetime.now()
        
        # Generate audio
        client = get_elevenlabs_client()
        audio_data, content_type = await client.generate_audio(
            text=request.text,
            voice_id=request.voice_id,
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            output_format=request.output_format,
            use_speaker_boost=request.use_speaker_boost
        )
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Encode audio to base64
        audio_base64 = base64.b64encode(audio_data).decode("utf-8")
        
        return {
            "audio_base64": audio_base64,
            "content_type": content_type,
            "character_count": len(request.text),
            "processing_time": processing_time
        }
    except ElevenLabsError as e:
        logger.error(f"Error generating voice: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_generation_error"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating voice: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Error generating voice: {str(e)}", "code": "internal_server_error"}
        )


# New endpoint for persisting audio to R2 storage
class SaveAudioRequest(BaseModel):
    """Request model for saving audio to R2 storage."""
    audio_base64: str
    content_type: str = "audio/mp3"
    project_id: str
    scene_id: str
    voice_id: str

class SaveAudioResponse(BaseModel):
    """Response model for audio saved to R2 storage."""
    success: bool
    url: str
    storage_key: str

class GetAudioResponse(BaseModel):
    """Response model for retrieving audio from storage."""
    success: bool
    url: Optional[str] = None
    storage_key: Optional[str] = None
    exists: bool = False

@router.get("/audio/{project_id}/{scene_id}", response_model=GetAudioResponse)
async def get_voice_audio(project_id: str, scene_id: str):
    """Retrieve voice audio from storage by project ID and scene ID."""
    from app.services.storage import get_storage
    
    storage = get_storage()
    
    try:
        logger.info(f"Retrieving audio for project {project_id}, scene {scene_id}")
        
        # For mock storage, we need to list files with the pattern
        if hasattr(storage, 'storage_dir'):  # It's MockStorage
            logger.info("Using MockStorage to retrieve audio")
            
            # Try different patterns based on naming conventions
            patterns = [
                f"audio/{project_id}/{scene_id}/",
                f"audio/{project_id}_{scene_id}/",
                f"audio/{project_id}/{scene_id}_"
            ]
            
            for pattern in patterns:
                logger.info(f"Checking pattern: {pattern}")
                matching_files = await storage.check_files_exist(pattern)
                
                if matching_files and hasattr(matching_files, 'contents') and matching_files.contents:
                    # Get most recent file
                    latest_file = sorted(matching_files.contents, key=lambda x: x.last_modified, reverse=True)[0]
                    file_key = latest_file.key
                    logger.info(f"Found audio file: {file_key}")
                    
                    # Get URL
                    url = await storage.get_file_url(file_key)
                    if url:
                        return {
                            "success": True,
                            "url": url,
                            "storage_key": file_key,
                            "exists": True
                        }
            
            logger.info("No audio files found in mock storage")
            return {
                "success": True,
                "exists": False
            }
        
        # For R2 storage (not mock), we need a different approach
        else:
            logger.info("Using R2Storage to retrieve audio")
            
            # Check if any files exist with the base pattern
            storage_prefix = f"audio/{project_id}/{scene_id}/"
            logger.info(f"Checking for files with prefix: {storage_prefix}")
            
            has_files = await storage.check_files_exist(storage_prefix)
            
            # Debug logging for R2 response
            logger.info(f"R2 response type: {type(has_files)}")
            if has_files:
                logger.info(f"R2 response keys: {list(has_files.keys()) if hasattr(has_files, 'keys') else 'No keys method'}")
                
                if 'Contents' in has_files and has_files['Contents']:
                    logger.info(f"Found {len(has_files['Contents'])} files with prefix {storage_prefix}")
                    
                    # Sort by last modified date and get the most recent
                    contents = sorted(has_files['Contents'], key=lambda x: x.get('LastModified', 0), reverse=True)
                    storage_key = contents[0].get('Key')
                    
                    logger.info(f"Selected most recent file: {storage_key}")
                    
                    # Get URL for the file
                    url = await storage.get_file_url(storage_key)
                    
                    if url:
                        logger.info(f"Generated URL for file: {url[:50]}...")
                        return {
                            "success": True,
                            "url": url,
                            "storage_key": storage_key,
                            "exists": True
                        }
                    else:
                        logger.error("Failed to generate URL for file")
                else:
                    logger.info(f"No files found with prefix {storage_prefix}")
            
            logger.info("No audio files found in R2 storage")
            return {
                "success": True,
                "exists": False
            }
    
    except Exception as e:
        logger.error(f"Error retrieving audio from storage: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "exists": False
        }

@router.post("/persist", response_model=SaveAudioResponse)
async def persist_voice_audio(request: SaveAudioRequest):
    """Save generated voice audio to persistent R2 storage."""
    import tempfile
    import base64
    import os
    import aiofiles
    
    try:
        # Decode base64 audio
        try:
            audio_data = base64.b64decode(request.audio_base64)
            logger.info(f"Decoded audio data, size: {len(audio_data)} bytes")
        except Exception as e:
            logger.error(f"Error decoding base64 audio: {str(e)}")
            raise HTTPException(
                status_code=400,
                detail={"message": "Invalid base64 audio data", "code": "invalid_audio_data"}
            )
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_path = temp_file.name
        
        logger.info(f"Created temporary file at: {temp_path}")
        
        # Write audio data to temp file
        try:
            async with aiofiles.open(temp_path, "wb") as f:
                await f.write(audio_data)
                
            # Verify the file was written correctly
            file_size = os.path.getsize(temp_path)
            logger.info(f"Written {file_size} bytes to temporary file")
            
            if file_size == 0:
                raise ValueError("Written file is empty")
                
        except Exception as e:
            logger.error(f"Error writing audio data to file: {str(e)}")
            try:
                os.unlink(temp_path)
            except:
                pass
            raise HTTPException(
                status_code=500,
                detail={"message": f"Failed to write audio data to file: {str(e)}", "code": "file_write_error"}
            )
        
        # Generate a unique storage key for the audio
        filename_timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        storage_key = f"audio/{request.project_id}/{request.scene_id}/{filename_timestamp}_{request.voice_id}.mp3"
        logger.info(f"Generated storage key: {storage_key}")
        
        # Get storage service
        from app.services.storage import get_storage
        storage = get_storage()
        
        # Upload to R2
        logger.info(f"Uploading audio to storage with key: {storage_key}")
        success, url = await storage.upload_file(temp_path, storage_key)
        
        # Clean up temporary file
        try:
            os.unlink(temp_path)
            logger.info(f"Removed temporary file: {temp_path}")
        except Exception as e:
            logger.warning(f"Error removing temporary file {temp_path}: {str(e)}")
        
        if not success:
            logger.error(f"Failed to upload audio to storage: {url}")
            raise HTTPException(
                status_code=500,
                detail={"message": f"Failed to upload audio to storage: {url}", "code": "storage_upload_failed"}
            )
        
        logger.info(f"Successfully saved audio to storage with URL: {url[:50]}...")
        return {
            "success": True,
            "url": url,
            "storage_key": storage_key
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error persisting audio to storage: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail={"message": f"Error saving audio: {str(e)}", "code": "audio_persistence_error"}
        )


@router.post("/generate-file")
async def generate_voice_audio_file(request: GenerateVoiceRequest):
    """Generate voice audio from text and return as file."""
    # Apply rate limiting
    if not rate_limiter.allow_request():
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded. Please try again later.", "code": "rate_limit_exceeded"}
        )
    
    try:
        # Check character limit
        if len(request.text) > settings.VOICE_GEN_MAX_CHARS_PER_SCENE:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": f"Text exceeds maximum character limit of {settings.VOICE_GEN_MAX_CHARS_PER_SCENE}",
                    "code": "character_limit_exceeded"
                }
            )
        
        # Generate audio and save to file
        client = get_elevenlabs_client()
        file_path = await client.save_audio_to_file(
            text=request.text,
            voice_id=request.voice_id,
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            output_format=request.output_format,
            use_speaker_boost=request.use_speaker_boost
        )
        
        # Set up response headers
        headers = {
            "Content-Disposition": f"attachment; filename=voice-{request.voice_id[:8]}.{request.output_format}"
        }
        
        # Return file
        return FileResponse(
            file_path, 
            headers=headers,
            media_type=f"audio/{request.output_format}"
        )
    except ElevenLabsError as e:
        logger.error(f"Error generating voice file: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_generation_error"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating voice file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Error generating voice file: {str(e)}", "code": "internal_server_error"}
        )

# Add a test endpoint for R2 connectivity
@router.get("/test-r2-connection", response_model=dict)
async def test_r2_connection():
    """Test connection to R2 storage and return diagnostic information."""
    from app.services.storage import get_storage
    
    try:
        storage = get_storage()
        
        # Check if using mock storage
        is_mock = hasattr(storage, 'storage_dir')
        
        # Create response dictionary
        response = {
            "success": True,
            "using_mock_storage": is_mock,
            "storage_type": "MockStorage" if is_mock else "R2Storage",
        }
        
        # If using R2, add R2-specific info
        if not is_mock:
            response.update({
                "endpoint_url": storage.endpoint_url,
                "bucket_name": storage.bucket_name,
            })
            
            # Test bucket connection
            try:
                # Try to list some objects
                test_response = await storage.check_files_exist("test-")
                response["bucket_accessible"] = test_response is not None
                
                if test_response and 'Contents' in test_response:
                    response["objects_count"] = len(test_response['Contents'])
                
                # Try to create a test file and upload it
                import tempfile
                import os
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
                    temp_path = temp_file.name
                    temp_file.write(b"Test file for R2 connection")
                
                test_key = "test-connection.txt"
                success, url = await storage.upload_file(temp_path, test_key)
                
                # Clean up temp file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                
                response["test_upload_success"] = success
                if success:
                    response["test_url"] = url
                    
                    # Try to generate another URL for the same file
                    new_url = await storage.get_file_url(test_key)
                    response["url_generation_works"] = new_url is not None
                    
                    if new_url:
                        response["new_url"] = new_url
            except Exception as e:
                logger.error(f"Error during R2 connection test: {str(e)}")
                response["error"] = str(e)
                response["success"] = False
        
        return response
        
    except Exception as e:
        logger.error(f"Error testing R2 connection: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        } 