#!/usr/bin/env python3
"""
Diagnostic script to validate path and authentication issues
"""

import os
import sys
import logging
from pathlib import Path
import subprocess

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("diagnose")

# Log the current directory and Python path
logger.info(f"Current directory: {os.getcwd()}")
logger.info(f"Script location: {Path(__file__).resolve()}")
logger.info(f"Parent directory: {Path(__file__).resolve().parent.parent}")

# Add parent to path as the test script does
parent_dir = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, parent_dir)
logger.info(f"Python path after insert: {sys.path}")

# Try importing modules
try:
    logger.info("Attempting to import app.config...")
    import app.config
    logger.info("✅ Successfully imported app.config")
except ImportError as e:
    logger.error(f"❌ Failed to import app.config: {e}")
    # List files in potential module locations to debug
    app_dir = os.path.join(parent_dir, 'app')
    if os.path.exists(app_dir):
        logger.info(f"Content of {app_dir}:")
        for item in os.listdir(app_dir):
            logger.info(f"  - {item}")
        
        config_dir = os.path.join(app_dir, 'config')
        if os.path.exists(config_dir):
            logger.info(f"Content of {config_dir}:")
            for item in os.listdir(config_dir):
                logger.info(f"  - {item}")
        elif os.path.exists(os.path.join(app_dir, 'config.py')):
            logger.info("Found app/config.py instead of app/config/")
    else:
        logger.error(f"❌ Directory doesn't exist: {app_dir}")

# Try importing storage service
try:
    logger.info("Attempting to import app.services.storage...")
    from app.services import storage
    logger.info("✅ Successfully imported storage")
    
    # Test R2 connection
    logger.info("Testing R2 connection...")
    bucket_name = "autoshorts-media"
    async def test_connection():
        client = await storage.get_s3_client()
        try:
            logger.info(f"Attempting to list objects in bucket: {bucket_name}")
            response = await client.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
            logger.info(f"✅ Successfully listed objects: {response}")
            return True
        except Exception as e:
            logger.error(f"❌ Error listing objects: {e}")
            return False
    
    # Run the async test
    import asyncio
    asyncio.run(test_connection())
    
except ImportError as e:
    logger.error(f"❌ Failed to import storage service: {e}")

# Check if wrangler is installed
try:
    logger.info("Checking Wrangler installation...")
    result = subprocess.run(["wrangler", "--version"], capture_output=True, text=True)
    if result.returncode == 0:
        logger.info(f"✅ Wrangler is installed: {result.stdout.strip()}")
    else:
        logger.error(f"❌ Wrangler error: {result.stderr.strip()}")
except Exception as e:
    logger.error(f"❌ Wrangler check failed: {e}")

# Check the wrangler_r2 module
try:
    logger.info("Checking for app.services.wrangler_r2 module...")
    services_path = os.path.join(parent_dir, 'app', 'services')
    if os.path.exists(services_path):
        logger.info(f"Content of {services_path}:")
        for item in os.listdir(services_path):
            logger.info(f"  - {item}")
        
        wrangler_path = os.path.join(services_path, 'wrangler_r2.py')
        if os.path.exists(wrangler_path):
            logger.info(f"✅ wrangler_r2.py exists")
            with open(wrangler_path, 'r') as f:
                first_few_lines = "".join(f.readlines()[:10])
                logger.info(f"First few lines of wrangler_r2.py:\n{first_few_lines}")
        else:
            logger.error(f"❌ wrangler_r2.py doesn't exist")
    else:
        logger.error(f"❌ services directory doesn't exist: {services_path}")
except Exception as e:
    logger.error(f"❌ Error checking for wrangler_r2 module: {e}")

logger.info("Diagnostic complete") 