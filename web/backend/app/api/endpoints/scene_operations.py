import logging
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter

# Configure logger
logger = logging.getLogger(__name__)

# Create router
scene_router = APIRouter()

# Feature flag
ENABLE_NEW_SCENE_IMPLEMENTATION = False

@scene_router.get("/diagnostic")
async def scene_diagnostic():
    """
    A simple diagnostic endpoint to verify scene_router is connected.
    """
    logger.info("[SCENE-DIAG] Diagnostic endpoint called")
    return {
        "status": "active",
        "timestamp": datetime.utcnow().isoformat()
    }

# We'll develop more endpoints with the ultra-incremental approach
# after we have verified this basic setup works 