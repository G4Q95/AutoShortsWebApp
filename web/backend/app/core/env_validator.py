"""
Environment variable validation module.

This module provides functions to validate environment variables
and ensure all required variables are present with valid formats.
"""

import os
import sys
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Define required environment variables with their descriptions
REQUIRED_VARS = {
    "MONGODB_URI": "MongoDB connection string",
}

# Define optional but recommended variables
RECOMMENDED_VARS = {
    "OPENAI_API_KEY": "OpenAI API key for text rewriting",
    "ELEVENLABS_API_KEY": "ElevenLabs API key for voice generation",
    "ELEVENLABS_MODEL_ID": "ElevenLabs model ID (default: eleven_monolingual_v1)",
    "ELEVENLABS_API_URL": "ElevenLabs API URL (default: https://api.elevenlabs.io/v1)",
    "CLOUDFLARE_R2_ENDPOINT": "Cloudflare R2 endpoint for storage",
    "CLOUDFLARE_R2_ACCESS_KEY_ID": "Cloudflare R2 access key ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY": "Cloudflare R2 secret access key",
}


def validate_environment_variables(exit_on_failure: bool = True) -> Tuple[bool, List[str]]:
    """
    Validate that all required environment variables are set.
    
    Args:
        exit_on_failure: Whether to exit the application if validation fails
        
    Returns:
        Tuple containing:
        - Boolean indicating if validation passed
        - List of missing variable names
    """
    missing_vars = []
    
    # Check required variables
    for var_name, description in REQUIRED_VARS.items():
        if not os.getenv(var_name):
            missing_vars.append(var_name)
            logger.error(f"Missing required environment variable: {var_name} - {description}")
    
    # Check recommended variables and log warnings
    for var_name, description in RECOMMENDED_VARS.items():
        if not os.getenv(var_name):
            logger.warning(f"Missing recommended environment variable: {var_name} - {description}")
    
    # Special validation for the ElevenLabs API key
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
    if elevenlabs_key and len(elevenlabs_key) < 32:
        logger.warning("ElevenLabs API key appears to be invalid (too short)")
    
    # If any required variables are missing, either exit or return failure
    if missing_vars and exit_on_failure:
        logger.critical("Application startup failed due to missing required environment variables")
        print("\n===== ENVIRONMENT VALIDATION FAILED =====")
        print("The following required environment variables are missing:")
        for var_name in missing_vars:
            print(f"  - {var_name}: {REQUIRED_VARS[var_name]}")
        print("\nPlease add these variables to your .env file or environment.")
        print("See .env.example for reference.")
        print("==========================================\n")
        sys.exit(1)
    
    return len(missing_vars) == 0, missing_vars


def validate_mongodb_uri(uri: Optional[str]) -> bool:
    """
    Validate MongoDB URI format.
    
    Args:
        uri: MongoDB URI string to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not uri:
        return False
    
    # Basic format validation - should start with mongodb:// or mongodb+srv://
    if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        logger.error("Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://")
        return False
    
    return True


def print_env_status() -> None:
    """
    Print the status of environment variables for debugging.
    Hides sensitive information.
    """
    print("\n===== ENVIRONMENT VARIABLE STATUS =====")
    
    all_vars = {**REQUIRED_VARS, **RECOMMENDED_VARS}
    for var_name, description in all_vars.items():
        value = os.getenv(var_name)
        if value:
            # Mask sensitive values
            if any(sensitive_term in var_name.lower() for sensitive_term in ["key", "secret", "password", "token"]):
                display_value = f"{value[:3]}...{value[-3:]}" if len(value) > 10 else "***"
            else:
                display_value = value
            
            status = "✅ SET"
        else:
            display_value = "NOT SET"
            status = "❌ MISSING" if var_name in REQUIRED_VARS else "⚠️ RECOMMENDED"
        
        print(f"{status}: {var_name} - {display_value}")
    
    print("=======================================\n") 