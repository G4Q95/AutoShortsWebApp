"""
Utility functions related to storage operations.
"""

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

def generate_storage_key(
    project_id: str,
    scene_id: Optional[str] = None,
    file_type: Optional[str] = None,
    extension: Optional[str] = None, # Changed from filename to extension
    user_id: Optional[str] = None, # Keep user_id for potential future use
) -> str:
    """
    Generate a structured storage key (object name) using the simplified flat structure.

    Args:
        project_id: Project ID the file belongs to
        scene_id: Optional scene ID
        file_type: Optional file type (e.g., 'video', 'audio', 'image')
        extension: Optional file extension (including the dot, e.g., '.mp4')
        user_id: User ID (currently unused in simplified structure but kept for signature consistency)

    Returns:
        Structured storage key string.

    Raises:
        ValueError: If project_id is missing.
    """
    logger.debug(f"[generate_storage_key] Called with: project_id={project_id}, scene_id={scene_id}, file_type={file_type}, extension={extension}")

    if not project_id:
        logger.error("[generate_storage_key] Missing required project_id")
        raise ValueError("Project ID is required to generate a storage key")

    # Check if project_id already starts with "proj_" to avoid double prefix
    prefix = ""
    if not project_id.startswith("proj_"):
        prefix = "proj_"
        logger.debug("[generate_storage_key] Adding 'proj_' prefix to project_id")
    else:
        logger.debug("[generate_storage_key] Project ID already has 'proj_' prefix, not adding again")

    # Build simplified path components
    path_components = [f"{prefix}{project_id}"]

    # Add scene component if available
    path_components.append(scene_id if scene_id else "general")

    # Add file type component if available
    path_components.append(file_type if file_type else "media")

    # Ensure the extension starts with a dot if provided
    final_extension = ''
    if extension:
        final_extension = extension if extension.startswith('.') else f".{extension}"

    # Combine all components with the extension
    storage_key = f"{'_'.join(path_components)}{final_extension}"

    logger.info(f"[generate_storage_key] Generated key: {storage_key}")
    return storage_key 