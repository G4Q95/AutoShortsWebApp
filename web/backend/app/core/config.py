import os

from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()


class Settings(BaseModel):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Auto Shorts"

    # MongoDB
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")

    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    # ElevenLabs
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # Cloudflare R2
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "auto-shorts")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Frontend URL (for CORS)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Free tier limitations
    FREE_TIER_MONTHLY_VIDEOS: int = 5
    FREE_TIER_MAX_VIDEO_LENGTH_SECONDS: int = 45
    FREE_TIER_MAX_CHARS: int = 1000
    FREE_TIER_STORAGE_DAYS: int = 14


settings = Settings()
