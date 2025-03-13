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

logger = logging.getLogger(__name__)

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