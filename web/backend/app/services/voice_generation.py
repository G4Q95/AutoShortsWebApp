"""
ElevenLabs voice generation service.

This module provides functionality to generate audio from text using the ElevenLabs API.
It handles authentication, voice selection, text-to-speech conversion, and error handling.

NOTE: The core client logic has been moved to audio_service.py.
This file may contain legacy functions or helpers.
"""

import logging
import os
import tempfile
import time
from typing import Dict, List, Optional, Tuple, Union, Any
import json

import aiofiles
import httpx

# Models and client are now in audio_service.py
# from pydantic import BaseModel # No longer needed directly here?
# from app.core.config import settings # Still needed for legacy function defaults?
from app.core.config import settings # Keep for legacy function
from .audio_service import ElevenLabsClient # Import client if needed by legacy funcs?


logger = logging.getLogger(__name__)

# Models (Voice, VoiceSettings, VoiceGenerationRequest) - REMOVED (Now in audio_service.py)

# Exception (ElevenLabsError) - REMOVED (Now in audio_service.py)

# Client Class (ElevenLabsClient) - REMOVED (Now in audio_service.py)


# --- Keep helper/legacy functions for now --- 

# Potential Singleton/DI helper - Keep for now
def get_elevenlabs_client() -> ElevenLabsClient:
    """Returns an instance of the ElevenLabs client (now potentially defined elsewhere)."""
    # This function might need modification if instantiation changes,
    # or if it's no longer needed after full refactor (Subtask 1.5)
    # For now, assume it might still be used by legacy consumers
    # It should likely instantiate the client from audio_service if kept.
    # Let's make it return a new instance for simplicity during refactor.
    # TODO: Re-evaluate this function in Subtask 1.5
    from .audio_service import ElevenLabsClient # Local import to avoid circular dependency issues maybe
    return ElevenLabsClient()


# Legacy interface for backward compatibility - Keep for now
async def generate_voice(
    text: str,
    voice_id: str = "default",
    output_format: str = "mp3_44100_128",
    stability: float = settings.VOICE_GEN_DEFAULT_STABILITY,
    similarity_boost: float = settings.VOICE_GEN_DEFAULT_SIMILARITY
) -> Optional[str]:
    """
    Generate voice audio from text using ElevenLabs API (Legacy Interface).

    Args:
        text: Text to convert to speech
        voice_id: ID of the voice to use
        output_format: Audio format
        stability: Voice stability
        similarity_boost: Voice similarity boost

    Returns:
        Path to the temporary audio file or None if generation failed
    """
    # This function now calls the client potentially via get_elevenlabs_client
    # or directly from audio_service. Needs review in Subtask 1.5
    # TODO: Re-evaluate this function in Subtask 1.5
    client = get_elevenlabs_client()
    
    if not client.api_key:
        logger.warning("Legacy generate_voice: ElevenLabs API key not provided, using mock generation")
        # Mock logic remains unchanged for now
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_format.split('_')[0]}") # Safer suffix extraction
        temp_file.close()
        return temp_file.name

    try:
        # NOTE: The original client had save_audio_to_file method. 
        # This logic needs to be adapted to the new AudioService flow.
        # For now, just log that it would generate.
        # Proper fix belongs in Subtask 1.5 when dependents are refactored.
        logger.info(f"Legacy generate_voice called for text: {text[:30]}... (Actual generation/saving skipped)")
        # Simulating the old behavior of returning a temp file path for mock cases
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{output_format.split('_')[0]}") 
        temp_file.close()
        # This is NOT generating real audio now, just placeholder.
        return temp_file.name 
        
        # Original logic (now needs refactoring):
        # return await client.save_audio_to_file(
        #     text=text,
        #     voice_id=voice_id,
        #     stability=stability,
        #     similarity_boost=similarity_boost,
        #     output_format=output_format
        # )
    except Exception as e:
        # Use the correct error type if available
        logger.error(f"Legacy generate_voice error: {str(e)}")
        return None
