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
from app.services.audio_service import (
    Voice,
    VoiceSettings,
    ElevenLabsError
)
from app.services.storage import get_storage
from app.services.audio_service import AudioService

logger = logging.getLogger(__name__)

# Update router prefix to include API version
router = APIRouter(prefix="/voice", tags=["voice"])

# Assuming a dependency injection setup for the service, or create instance
# This depends on how services are managed in the app
# Simple approach: instantiate here (can be refined later)
# TODO: Consider proper dependency injection for AudioService
audio_service = AudioService()

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


@router.get("/voices", response_model=List[Voice])
async def get_voices():
    """Get available voices from ElevenLabs."""
    try:
        voices = await audio_service.get_voices()
        return voices
    except ElevenLabsError as e:
        logger.error(f"Error getting voices: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_list_error"}
        )
    except Exception as e:
        logger.error(f"Error getting voices: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Error getting voices: {str(e)}", "code": "internal_server_error"}
        )


@router.get("/voices/{voice_id}", response_model=VoiceResponse)
async def get_voice(voice_id: str):
    """Get details of a specific voice."""
    try:
        voice = await audio_service.get_voice_by_id(voice_id)
        
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
                }
            )
        
        # Start timing
        start_time = datetime.now()
        
        # Generate audio
        audio_data, content_type = await audio_service.generate_audio(
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
    text: str
    voice_id: str
    project_id: str
    scene_id: str
    stability: float = Field(settings.VOICE_GEN_DEFAULT_STABILITY, ge=0.0, le=1.0, description="Voice stability (0.0-1.0)")
    similarity_boost: float = Field(settings.VOICE_GEN_DEFAULT_SIMILARITY, ge=0.0, le=1.0, description="Voice similarity boost (0.0-1.0)")
    style: Optional[float] = Field(None, ge=0.0, le=1.0, description="Optional style value (0.0-1.0)")
    use_speaker_boost: Optional[bool] = Field(True, description="Whether to enhance vocal clarity")

    @validator("text")
    def validate_text_length(cls, v):
        if len(v) > settings.VOICE_GEN_MAX_CHARS_PER_SCENE:
            raise ValueError(f"Text exceeds maximum character limit of {settings.VOICE_GEN_MAX_CHARS_PER_SCENE} for saving")
        return v

class SaveAudioResponse(BaseModel):
    """Response model for audio saved to R2 storage."""
    success: bool
    url: str

class GetAudioResponse(BaseModel):
    """Response model for retrieving audio from storage."""
    success: bool
    url: Optional[str] = None
    storage_key: Optional[str] = None
    exists: bool = False

@router.get("/audio/{project_id}/{scene_id}", response_model=GetAudioResponse)
async def get_voice_audio(
    project_id: str, 
    scene_id: str, 
    audio_type: str = Query("voiceover", description="Type of audio to retrieve: 'voiceover' or 'original'")
):
    """Retrieve the URL of the latest voice audio from storage by project ID, scene ID, and type."""
    # Removed direct storage interaction
    
    if audio_type not in ["voiceover", "original"]:
        raise HTTPException(status_code=400, detail="Invalid audio_type. Must be 'voiceover' or 'original'.")
        
    try:
        logger.info(f"Attempting to retrieve latest '{audio_type}' audio for project {project_id}, scene {scene_id}")
        
        # Use the audio service to get the URL
        url = await audio_service.get_latest_audio_url(
            project_id=project_id, 
            scene_id=scene_id,
            audio_type=audio_type
        )
        
        if url:
            logger.info(f"Found latest '{audio_type}' audio URL: {url[:50]}...")
            # Assuming storage_key is not needed by the client if URL is present
            return GetAudioResponse(success=True, url=url, exists=True)
        else:
            logger.info(f"No '{audio_type}' audio found for project {project_id}, scene {scene_id}")
            return GetAudioResponse(success=True, exists=False)
            
    except Exception as e:
        # Catch potential exceptions from the service layer or unforeseen issues
        logger.error(f"Error retrieving audio URL via service: {str(e)}\n{traceback.format_exc()}")
        # Return a generic failure response
        # Consider more specific error handling based on potential service exceptions if needed
        raise HTTPException(
            status_code=500,
            detail={"message": f"Failed to retrieve audio information: {str(e)}", "code": "audio_retrieval_error"}
        )

@router.post("/save", response_model=SaveAudioResponse)
async def persist_voice_audio(request: SaveAudioRequest):
    """Generate voice audio and save directly to persistent storage."""
    try:
        # Generate and store voiceover using the service
        # Pass parameters directly from the validated request model
        url = await audio_service.generate_and_store_voiceover(
            text=request.text,
            voice_id=request.voice_id,
            project_id=request.project_id,
            scene_id=request.scene_id,
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            use_speaker_boost=request.use_speaker_boost
            # Using default model_id and output_format from AudioService
        )
        
        return SaveAudioResponse(success=True, url=url)

    except ElevenLabsError as e:
        logger.error(f"Error generating/saving voice: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_generation_storage_error"}
        )
    except ValueError as ve: # Catch validation errors
        logger.warning(f"Validation error in /save endpoint: {str(ve)}")
        raise HTTPException(
            status_code=400, # Bad Request
            detail={"message": str(ve), "code": "validation_error"}
        )
    except HTTPException: # Re-raise existing HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error saving audio: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail={"message": f"Unexpected error saving audio: {str(e)}", "code": "internal_server_error"}
        )


@router.post("/generate-file")
async def generate_voice_audio_file(request: GenerateVoiceRequest, background_tasks: BackgroundTasks):
    """Generate voice audio from text and return as file."""
    # Apply rate limiting
    if not rate_limiter.allow_request():
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded. Please try again later.", "code": "rate_limit_exceeded"}
        )
    
    temp_file_path = None
    try:
        # Check character limit (using validator on request model is sufficient)
        
        # Generate audio using the audio_service
        audio_data, content_type = await audio_service.generate_audio(
            text=request.text,
            voice_id=request.voice_id,
            stability=request.stability,
            similarity_boost=request.similarity_boost,
            style=request.style,
            output_format=request.output_format,
            use_speaker_boost=request.use_speaker_boost
            # Using default model_id from AudioService
        )
        
        # Create a temporary file to store the audio
        # Infer suffix from content_type or default to .mp3
        suffix = ".mp3" if "mpeg" in content_type else f".{request.output_format.split('_')[0]}"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_file_path = temp_file.name
        
        # Add cleanup task to run after response is sent
        background_tasks.add_task(os.unlink, temp_file_path)
        
        # Set up response headers
        filename = f"voice-{request.voice_id[:8]}-{datetime.now().strftime('%Y%m%d%H%M%S')}{suffix}"
        headers = {
            "Content-Disposition": f"attachment; filename={filename}"
        }
        
        # Return file
        return FileResponse(
            temp_file_path, 
            headers=headers,
            media_type=content_type # Use actual content_type from generation
        )

    except ElevenLabsError as e:
        logger.error(f"Error generating voice file: {str(e)}")
        # Clean up temp file if created before error
        if temp_file_path and os.path.exists(temp_file_path):
            try: os.unlink(temp_file_path)
            except Exception: pass
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "voice_generation_error"}
        )
    except ValueError as ve: # Catch validation errors
        logger.warning(f"Validation error in /generate-file endpoint: {str(ve)}")
        raise HTTPException(
            status_code=400, # Bad Request
            detail={"message": str(ve), "code": "validation_error"}
        )
    except HTTPException:
        # Clean up temp file if created before error
        if temp_file_path and os.path.exists(temp_file_path):
            try: os.unlink(temp_file_path)
            except Exception: pass
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating voice file: {str(e)}\n{traceback.format_exc()}")
        # Clean up temp file if created before error
        if temp_file_path and os.path.exists(temp_file_path):
            try: os.unlink(temp_file_path)
            except Exception: pass
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