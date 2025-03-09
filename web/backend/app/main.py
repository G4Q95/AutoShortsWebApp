from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import db
from app.api import users, videos, content, ai, video_creation

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

@app.on_event("startup")
async def startup_db_client():
    await db.connect()

@app.on_event("shutdown")
async def shutdown_db_client():
    await db.close()

@app.get("/")
async def root():
    return {"message": "Welcome to Auto Shorts API"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/v1/health")
async def health_check():
    """
    Health check endpoint for API status monitoring
    """
    return {"status": "available", "version": "1.0"}

# Include API routers
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)
app.include_router(content.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)
app.include_router(video_creation.router, prefix=settings.API_V1_STR) 