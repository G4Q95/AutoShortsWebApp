"""
FastAPI Dependency Injection providers.
"""

from fastapi import Depends

from app.services.audio_service import AudioService
from app.services.storage import R2Storage, get_storage

# Keep track of instantiated services to potentially reuse them (basic singleton pattern)
_audio_service_instance: AudioService | None = None
_storage_instance: R2Storage | None = None


def get_storage_service() -> R2Storage:
    """Dependency injector for the storage service."""
    global _storage_instance
    if _storage_instance is None:
        # Use the existing factory function
        _storage_instance = get_storage()  
    return _storage_instance


def get_audio_service(storage: R2Storage = Depends(get_storage_service)) -> AudioService:
    """Dependency injector for the AudioService."""
    global _audio_service_instance
    if _audio_service_instance is None:
        # Pass the storage instance to the AudioService constructor
        _audio_service_instance = AudioService(storage=storage) 
    return _audio_service_instance

# Add other service dependencies here as needed 