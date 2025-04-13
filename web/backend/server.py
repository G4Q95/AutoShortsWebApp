# web/backend/server.py
import os
import subprocess
from flask import Flask, request, jsonify
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Basic health check endpoint."""
    logging.info("Health check requested")
    # Check if ffmpeg command is accessible
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, capture_output=True)
        logging.info("FFmpeg found.")
        return jsonify({"status": "ok", "ffmpeg_status": "available"}), 200
    except FileNotFoundError:
        logging.error("FFmpeg command not found.")
        return jsonify({"status": "error", "ffmpeg_status": "not_found"}), 500
    except subprocess.CalledProcessError as e:
        logging.error(f"FFmpeg version check failed: {e}")
        return jsonify({"status": "error", "ffmpeg_status": "error", "details": str(e)}), 500
    except Exception as e:
        logging.error(f"Unexpected error during health check: {e}")
        return jsonify({"status": "error", "message": "Unexpected health check error"}), 500


@app.route('/extract-audio', methods=['POST'])
def extract_audio():
    """
    Endpoint to extract audio from a video file (details TBD).
    Expects data like video R2 key, output format, etc.
    """
    logging.info("Received request for /extract-audio")
    # TODO:
    # 1. Get parameters from request (e.g., video_r2_key)
    # 2. Download video from R2 (will need R2 credentials/client)
    # 3. Define input and output paths for ffmpeg
    # 4. Construct and run ffmpeg command using subprocess
    # 5. Handle ffmpeg errors (no audio stream, etc.)
    # 6. Upload extracted audio to R2 (optional, TBD)
    # 7. Return result (e.g., audio R2 key or status)

    # Placeholder response
    return jsonify({"message": "Audio extraction endpoint called, implementation pending"}), 202 # Accepted


if __name__ == '__main__':
    # Run the Flask app
    # Host 0.0.0.0 makes it accessible within the Docker network
    app.run(host='0.0.0.0', port=5000) 