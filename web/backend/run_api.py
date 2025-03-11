import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    print("\n=== Starting Auto Shorts API Server ===\n")
    print("API will be available at http://127.0.0.1:8001\n")
    print("Press CTRL+C to stop the server\n")

    # Run the FastAPI application
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True, log_level="debug")
