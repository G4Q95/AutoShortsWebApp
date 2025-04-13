import asyncio
import os
import tempfile
import sys
import logging

# Add '/app' to sys.path to allow imports from app package
sys.path.insert(0, '/app')

# Set up basic logging to see output from services
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from app.services.audio_service import AudioService, FfmpegError
    from app.services.storage import R2Storage # Import R2Storage for type hinting
except ImportError as e:
    logger.error(f"Failed to import necessary modules: {e}")
    logger.error("Make sure this script is run inside the backend container with '/app' in sys.path")
    sys.exit(1)

# --- Configuration ---
# Use the storage key reconstructed from the successful video upload log
# Format: proj_{project_id}_{scene_id}_{file_type}{ext}
R2_VIDEO_OBJECT_KEY = "proj_m9eut001_7dcxof2j93mm568csqe428_video.tmp"
# --- End Configuration ---

async def run_test():
    logger.info("--- Starting Audio Extraction Test ---")
    temp_video_path = None
    temp_audio_path = None
    audio_service = None # Define here for finally block

    try:
        # 1. Instantiate AudioService (this also initializes storage)
        logger.info("Instantiating AudioService...")
        # Pass None to use the singleton storage instance
        audio_service = AudioService(storage=None)
        storage: R2Storage = audio_service.storage # Get storage instance
        logger.info("AudioService instantiated.")

        # 2. Create temporary file paths
        # Use /tmp directory inside the container
        video_suffix = os.path.splitext(R2_VIDEO_OBJECT_KEY)[1] or '.mp4'
        temp_video_file = tempfile.NamedTemporaryFile(dir="/tmp", suffix=video_suffix, delete=False)
        temp_video_path = temp_video_file.name
        temp_video_file.close() # Close the file handle immediately

        temp_audio_file = tempfile.NamedTemporaryFile(dir="/tmp", suffix=".mp3", delete=False)
        temp_audio_path = temp_audio_file.name
        temp_audio_file.close() # Close the file handle immediately

        logger.info(f"Temporary video download path: {temp_video_path}")
        logger.info(f"Temporary audio output path: {temp_audio_path}")

        # 3. Download the video from R2
        logger.info(f"Downloading video '{R2_VIDEO_OBJECT_KEY}' from R2 to '{temp_video_path}'...")
        download_success, download_msg = await storage.download_file(
            object_name=R2_VIDEO_OBJECT_KEY,
            file_path=temp_video_path
        )

        if not download_success:
            logger.error(f"Failed to download video from R2: {download_msg}")
            return # Stop the test

        if not os.path.exists(temp_video_path) or os.path.getsize(temp_video_path) == 0:
             logger.error(f"Video file was not downloaded correctly or is empty: {temp_video_path}")
             return # Stop the test

        logger.info("Video downloaded successfully.")

        # 4. Run the ffmpeg extraction method
        logger.info("Calling _run_ffmpeg_extraction...")
        await audio_service._run_ffmpeg_extraction(temp_video_path, temp_audio_path)
        logger.info("_run_ffmpeg_extraction call completed.") # Log completion regardless of internal success

        # 5. Check if the output audio file exists
        if os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
            logger.info("--- TEST SUCCEEDED ---")
            logger.info(f"Output audio file created successfully: {temp_audio_path}")
            logger.info(f"File size: {os.path.getsize(temp_audio_path)} bytes")
        else:
            logger.error("--- TEST FAILED ---")
            logger.error(f"Output audio file was NOT created or is empty: {temp_audio_path}")
            logger.error("Check previous logs for ffmpeg errors (especially stderr).")

    except FfmpegError as e:
         logger.error("--- TEST FAILED (FfmpegError) ---")
         logger.error(f"FFmpeg specific error during extraction: {e}")
    except Exception as e:
        logger.error("--- TEST FAILED (Unexpected Error) ---")
        logger.exception(f"An unexpected error occurred: {e}") # Logs traceback
    finally:
        # 6. Clean up temporary files
        logger.info("Cleaning up temporary files...")
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
                logger.info(f"Removed temp video: {temp_video_path}")
            except OSError as e:
                logger.error(f"Error removing temp video {temp_video_path}: {e}")
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
                logger.info(f"Removed temp audio: {temp_audio_path}")
            except OSError as e:
                logger.error(f"Error removing temp audio {temp_audio_path}: {e}")
        logger.info("--- Test Script Finished ---")

if __name__ == "__main__":
    asyncio.run(run_test()) 