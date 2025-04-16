"""
Main FastAPI application module.
"""

import json
import logging
import traceback
from contextlib import asynccontextmanager

from bson import ObjectId
from fastapi import FastAPI, Request, status, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from typing import Dict, Any, List, Union

from app.api import ai, content, projects, users, video_creation, videos, voice, media
from app.api.endpoints.project_operations import project_router
from app.api.endpoints.scene_operations import scene_router
from app.api.endpoints.generation_operations import generation_router
from app.core.config import settings
from app.core.database import init_db, close_db, db, MongoJSONResponse
from app.core.errors import create_error_response, ErrorCodes
from app.core.json_encoder import MongoJSONEncoder
from app.core.middleware import ApiResponseMiddleware

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Context manager for FastAPI app lifespan.
    Handle startup and shutdown events.
    """
    # Startup
    await init_db()
    logger.info("Starting Auto Shorts API...")
    logger.debug("Starting up database connection...")
    
    if not db.is_mock:
        logger.debug(f"Using MongoDB URI: {settings.MONGODB_URI}")
        logger.debug(f"Using database: {db.db_name}")
    else:
        logger.debug("Using mock database")
    
    yield
    
    # Shutdown
    logger.debug("Shutting down database connection...")
    await close_db()
    logger.info("Auto Shorts API shut down complete.")

app = FastAPI(
    title="Auto Shorts API",
    description="API for converting social media content to short-form videos",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
origins = [
    "http://localhost",
    "http://localhost:3000",  # Frontend on same machine
    "http://frontend:3000",   # Frontend from Docker
    settings.FRONTEND_URL,    # Configured frontend URL (for production)
    "https://*.r2.dev",       # Cloudflare R2 development URLs
    "https://*.r2.cloudflarestorage.com",  # Cloudflare R2 storage URLs
]

# Add environment-specific origins if configured
if settings.FRONTEND_URL and settings.FRONTEND_URL not in origins:
    origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]  # Needed for file downloads
)

# Add API standardization middleware
app.add_middleware(ApiResponseMiddleware)

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
    error_message = str(exc)
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code = ErrorCodes.INTERNAL_SERVER_ERROR

    if isinstance(exc, PydanticValidationError):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        error_code = ErrorCodes.VALIDATION_ERROR
        
        # Extract validation error details
        details = []
        for error in exc.errors():
            details.append({
                "loc": error.get("loc", []),
                "msg": error.get("msg", "Validation error"),
                "type": error.get("type", "validation_error")
            })
    else:
        # For all other exceptions, create a generic error response
        details = [{
            "loc": ["server"],
            "msg": error_message,
            "type": "server_error"
        }]

    logger.error(f"Global exception handler caught: {error_message}")
    logger.error(traceback.format_exc())

    error_response = create_error_response(
        status_code=status_code,
        message=f"An error occurred: {error_message}",
        details=details,
        error_code=error_code
    )

    return CustomJSONResponse(status_code=status_code, content=error_response)


@app.get("/", response_class=CustomJSONResponse)
async def root():
    return {"message": "Welcome to Auto Shorts API"}


@app.get("/health", response_class=CustomJSONResponse)
async def health_check():
    return {"status": "ok"}


@app.get("/api/v1/health", response_class=CustomJSONResponse)
async def api_health_check():
    """
    Health check endpoint for API status monitoring
    """
    db_status = "available" if not db.is_mock else "mock"
    return {"status": "available", "version": "1.0", "database": db_status}


@app.get("/api/v1/test/standard-response")
async def test_standard_response():
    """
    Test endpoint to verify response standardization.
    This should automatically be wrapped in the standardized format.
    """
    return {"test": "success", "message": "This should be standardized"}


@app.get("/api/v1/test/error-response")
async def test_error_response():
    """
    Test endpoint to verify error response standardization.
    """
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Test error response"
    )


# Add custom exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Custom handler for HTTP exceptions.
    Ensures all exceptions follow the standardized error format.
    """
    if isinstance(exc.detail, dict) and "status_code" in exc.detail and "message" in exc.detail:
        # This is already a standardized error response
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail
        )
    
    # Create a standardized error response
    error_response = create_error_response(
        status_code=exc.status_code,
        message=str(exc.detail),
        error_code=getattr(exc, "error_code", None)
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Custom handler for unhandled exceptions.
    Ensures all exceptions follow the standardized error format.
    """
    logger.exception("Unhandled exception:")
    
    # Create a standardized error response
    error_response = create_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        message="An unexpected error occurred",
        error_code=ErrorCodes.INTERNAL_SERVER_ERROR
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response
    )


# Include API routers
# app.include_router(users.router, prefix=settings.API_V1_STR) # Assuming handled elsewhere or not needed now
# app.include_router(videos.router, prefix=settings.API_V1_STR)
# app.include_router(video_creation.router, prefix=settings.API_V1_STR)

# --- Endpoint Routers ---
# Use specific prefixes for clarity
app.include_router(content.router, prefix="/api/v1")
app.include_router(project_router, prefix="/api/v1/projects")
app.include_router(scene_router, prefix="/api/v1/projects")
app.include_router(generation_router, prefix="/api/v1/generate")
app.include_router(voice.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1/ai")

# Include Debug/Test routers if needed in development
# Make sure prefixes are consistent
from app.api.test import router as test_router
from app.api.debug import router as debug_router
app.include_router(test_router, prefix="/api/v1")
app.include_router(debug_router, prefix="/api/v1/debug")

# --- Remove Legacy/Deprecated Router Includes ---
# These should be removed to avoid conflicts
# app.include_router(test_router, prefix="/api/test")
# app.include_router(content_router, prefix="/api/content")
# app.include_router(projects_router, prefix="/api/projects")
# app.include_router(videos.router, prefix="/api/videos")
# app.include_router(voice_router, prefix="/api/voice")
# app.include_router(media.router, prefix="/api")

# Remove commented-out lines related to old structure
# app.include_router(projects_router, prefix="/api/v1/projects")
# from app.api.content import router as content_router # Redundant import
