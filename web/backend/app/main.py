from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import db, MongoJSONEncoder
from app.api import users, videos, content, ai, video_creation, projects
import logging
import json
from bson import ObjectId
import traceback
from pydantic import ValidationError

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Auto Shorts API",
    description="API for converting social media content to short-form videos",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom JSON encoder for ObjectId (needed for FastAPI responses)
class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            cls=MongoJSONEncoder,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_detail = str(exc)
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    
    if isinstance(exc, ValidationError):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        error_detail = str(exc)
    
    logger.error(f"Global exception handler caught: {error_detail}")
    logger.error(traceback.format_exc())
    
    return CustomJSONResponse(
        status_code=status_code,
        content={"detail": error_detail}
    )

@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Auto Shorts API...")
    logger.debug("Starting up database connection...")
    await db.connect()
    logger.debug(f"Database connected. Mock mode: {db.is_mock}")
    logger.debug(f"Using database: {db.db_name}")

@app.on_event("shutdown")
async def shutdown_db_client():
    logger.debug("Shutting down database connection...")
    await db.close()
    logger.debug("Database connection closed")

@app.get("/", response_class=CustomJSONResponse)
async def root():
    return {"message": "Welcome to Auto Shorts API"}

@app.get("/health", response_class=CustomJSONResponse)
async def health_check():
    return {"status": "ok"}

@app.get("/api/v1/health", response_class=CustomJSONResponse)
async def health_check():
    """
    Health check endpoint for API status monitoring
    """
    db_status = "available" if not db.is_mock else "mock"
    return {
        "status": "available", 
        "version": "1.0",
        "database": db_status
    }

# Include API routers
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)
app.include_router(content.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(video_creation.router, prefix=settings.API_V1_STR)
app.include_router(projects.router, prefix=settings.API_V1_STR) 