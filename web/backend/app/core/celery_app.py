# web/backend/app/core/celery_app.py
import os
from celery import Celery
from dotenv import load_dotenv

# Load .env variables, especially important if running worker outside docker-compose context sometimes
load_dotenv()

# Get Redis connection details from environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "redis") # Default to service name 'redis'
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
# Add password handling if you set one for Redis
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

redis_url = f"redis://"
if REDIS_PASSWORD:
    redis_url += f":{REDIS_PASSWORD}@"
redis_url += f"{REDIS_HOST}:{REDIS_PORT}/0" # Use database 0

# Define the Celery app instance
# The first argument is typically the name of the current module
# Ensure broker and backend URLs are set correctly
celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url,
    include=[
        # Add paths to modules containing your Celery tasks here
        # e.g., 'app.tasks.audio_tasks'
        'app.tasks' # Assuming tasks will be in files within app/tasks/ directory
    ],
)

# Optional Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],  # Ignore other content
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,
    # Add other Celery settings if needed
    # Example: task_track_started=True
)

# Optional: If you want to automatically discover tasks in modules listed in 'include'
# celery_app.autodiscover_tasks() # This might be needed depending on structure

if __name__ == "__main__":
    # This allows running the worker directly using `python -m app.core.celery_app worker ...`
    # but we'll typically run via the CMD in Dockerfile
    celery_app.start() 