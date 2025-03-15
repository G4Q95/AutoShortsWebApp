import os
import logging

from dotenv import load_dotenv
from pydantic import BaseModel, Field, validator

from app.core.env_validator import validate_environment_variables, validate_mongodb_uri, print_env_status

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Validate environment variables
validate_environment_variables()


class Settings(BaseModel):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Auto Shorts"

    # MongoDB
    MONGODB_URI: str = Field(default_factory=lambda: os.getenv("MONGODB_URI", ""))

    # OpenAI
    OPENAI_API_KEY: str = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))

    # ElevenLabs
    ELEVENLABS_API_KEY: str = Field(default_factory=lambda: os.getenv("ELEVENLABS_API_KEY", ""))
    ELEVENLABS_MODEL_ID: str = Field(default_factory=lambda: os.getenv("ELEVENLABS_MODEL_ID", "eleven_monolingual_v1"))
    ELEVENLABS_API_URL: str = Field(default_factory=lambda: os.getenv("ELEVENLABS_API_URL", "https://api.elevenlabs.io/v1"))
    # Voice generation limits for free tier (characters per scene)
    VOICE_GEN_MAX_CHARS_PER_SCENE: int = 1000
    VOICE_GEN_MAX_CHARS_PER_REQUEST: int = 5000
    # Default voice settings
    VOICE_GEN_DEFAULT_STABILITY: float = 0.5
    VOICE_GEN_DEFAULT_SIMILARITY: float = 0.75

    # Cloudflare R2
    R2_ACCOUNT_ID: str = Field(default_factory=lambda: os.getenv("R2_ACCOUNT_ID", ""))
    R2_ACCESS_KEY_ID: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", ""))
    R2_SECRET_ACCESS_KEY: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""))
    R2_ENDPOINT: str = Field(default_factory=lambda: os.getenv("CLOUDFLARE_R2_ENDPOINT", ""))
    R2_BUCKET_NAME: str = Field(default_factory=lambda: os.getenv("R2_BUCKET_NAME", "auto-shorts"))
    # URL expires in 7 days by default for public URLs
    R2_URL_EXPIRATION: int = 3600 * 24 * 7

    # Storage Configuration
    USE_MOCK_STORAGE: bool = Field(default_factory=lambda: os.getenv("USE_MOCK_STORAGE", "true").lower() in ["true", "1", "t", "yes", "y"])

    # Google OAuth
    GOOGLE_CLIENT_ID: str = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", ""))
    GOOGLE_CLIENT_SECRET: str = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", ""))

    # Frontend URL (for CORS)
    FRONTEND_URL: str = Field(default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:3000"))

    # Free tier limitations
    FREE_TIER_MONTHLY_VIDEOS: int = 5
    FREE_TIER_MAX_VIDEO_LENGTH_SECONDS: int = 45
    FREE_TIER_MAX_CHARS: int = 1000
    FREE_TIER_STORAGE_DAYS: int = 14

    # Additional validators
    @validator("MONGODB_URI")
    def validate_mongodb_uri(cls, v):
        """Additional validation for MongoDB URI format"""
        if v and not validate_mongodb_uri(v):
            logger.warning("Invalid MongoDB URI format detected")
        return v


# Create settings instance
settings = Settings()

# Print environment status in development mode
if os.getenv("ENV", "development") == "development":
    print_env_status()
