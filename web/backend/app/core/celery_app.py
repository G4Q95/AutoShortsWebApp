# web/backend/app/core/celery_app.py
import os
import asyncio
from celery import Celery
from celery.signals import worker_process_init
from kombu import Queue
from dotenv import load_dotenv

from app.core.config import settings
# Import the global db instance
from app.core.database import db 

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

# Initialize Celery
celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.audio_tasks", # Existing task module
        "app.tasks.media_tasks"  # Add our new task module
        # Add other task modules here if created
    ]
)

# Celery Configuration
# Use lowercase settings for Celery 5.x
celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=settings.CELERY_WORKER_CONCURRENCY, # Set concurrency from settings
    worker_prefetch_multiplier=settings.CELERY_PREFETCH_MULTIPLIER, # Set prefetch from settings
    task_queues=(
        Queue('default'),
        # Add other queues if needed
    ),
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    # Add visibility timeout if needed, e.g., for long tasks
    # broker_transport_options = {'visibility_timeout': 3600} # 1 hour example
)

# Optional: If you want to automatically discover tasks in modules listed in 'include'
# celery_app.autodiscover_tasks() # This might be needed depending on structure

# --- Database Initialization for Worker ---

async def init_worker_db():
    """Async function to initialize the database connection."""
    print("Worker process initializing database connection...") # Use print for visibility in worker logs
    await db.connect()
    if db.client and not db.is_mock:
        print("Worker process database connection successful.")
    elif db.is_mock:
        print("Worker process using mock database.")
    else:
        print("Worker process failed to establish database connection.")

@worker_process_init.connect(weak=False)
def worker_init_handler(**kwargs):
    """Signal handler to initialize DB when a worker process starts."""
    print("Received worker_process_init signal.")
    # Run the async function in a synchronous context
    asyncio.run(init_worker_db())
    print("Finished worker_process_init handler.")

# --- End Database Initialization ---

if __name__ == "__main__":
    # This allows running the worker directly using `python -m app.core.celery_app worker ...`
    # but we'll typically run via the CMD in Dockerfile
    celery_app.start() 