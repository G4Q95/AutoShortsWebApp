#!/usr/bin/env python3
"""
Script to delete remaining test files from Cloudflare R2 bucket.
"""
import subprocess
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_wrangler_command(command):
    """Run a Wrangler command and return the result"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=True,
            text=True
        )
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        logger.error(f"Command failed: {e.stderr}")
        return False, e.stderr

def main():
    bucket_name = "autoshorts-media"
    
    # Remaining test files with exact names
    files_to_delete = [
        "proj_proj_test_1743152771_scene2_media_1743152776.txt--",
        "proj_proj_test_1743152830_scene2_media_1743152834.txt--",
        "proj_proj_test_1743152936_scene2_media_1743152940.txt--",
        "proj_proj_test_1743153399_scene2_media_1743153403.tx--"
    ]
    
    # Delete each file
    deleted_count = 0
    failed_count = 0
    
    for file_key in files_to_delete:
        # Try deleting with and without the trailing dashes
        logger.info(f"Trying to delete {file_key}")
        
        # First try with exact name
        success, _ = run_wrangler_command(
            f"wrangler r2 object delete {bucket_name}/{file_key} --remote"
        )
        
        if not success:
            # Try with just one dash
            file_key_alt = file_key.rstrip('-')
            logger.info(f"Retrying with alternate name: {file_key_alt}")
            success, _ = run_wrangler_command(
                f"wrangler r2 object delete {bucket_name}/{file_key_alt} --remote"
            )

        if success:
            logger.info(f"Successfully deleted test file")
            deleted_count += 1
        else:
            logger.error(f"Failed to delete test file")
            failed_count += 1
    
    # Log summary
    logger.info(f"Deletion complete. Deleted {deleted_count} files, failed to delete {failed_count} files.")

if __name__ == "__main__":
    main()
