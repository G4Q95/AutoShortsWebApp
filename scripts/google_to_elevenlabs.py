import os
import requests
from dotenv import load_dotenv
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

# Load environment variables
from dotenv import load_dotenv

def load_settings():
    # Use a path for the .env file in the configs directory
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", "configs", ".env")
    
    # Check if the file exists
    if not os.path.exists(dotenv_path):
        print(f"Warning: Could not find .env file at {dotenv_path}")
        # Check if there's an .env in the current directory
        current_dir_env = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(current_dir_env):
            print(f"Using .env file in current directory: {current_dir_env}")
            dotenv_path = current_dir_env
        else:
            print("Warning: No .env file found. Using default settings.")
    
    load_dotenv(dotenv_path=dotenv_path, override=True)  # Force reload every time

    print("\n[DEBUG] Loaded settings from .env:")
    for k, v in os.environ.items():
        if "ELEVENLABS" in k or "STABILITY" in k or "SIMILARITY" in k or "STYLE" in k or "SPEAKER_BOOST" in k or "MODEL_ID" in k:
            print(f"{k}: {v}")

    return {
        "ELEVENLABS_API_KEY": os.getenv("ELEVENLABS_API_KEY"),
        "ELEVENLABS_VOICE_ID": os.getenv("ELEVENLABS_VOICE_ID", "default_voice_id"),
        "STABILITY_LEVEL": int(os.getenv("STABILITY_LEVEL", 44)),
        "SIMILARITY_LEVEL": int(os.getenv("SIMILARITY_LEVEL", 73)),
        "STYLE_EXAGGERATION_LEVEL": int(os.getenv("STYLE_EXAGGERATION_LEVEL", 0)),  # Default to 0
        "MODEL_ID": os.getenv("MODEL_ID", "eleven_multilingual_v2"),
        "SPEAKER_BOOST": os.getenv("SPEAKER_BOOST", "1"),  # Default to "1" (Off)
    }

# Save settings to .env file
def save_setting(key, value):
    # Use a path for the .env file in the configs directory
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", "configs", ".env")
    
    # Check if the file exists
    if not os.path.exists(dotenv_path):
        # Check if there's an .env in the current directory
        current_dir_env = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(current_dir_env):
            dotenv_path = current_dir_env
        else:
            configs_dir = os.path.join(os.path.dirname(__file__), "..", "configs")
            if not os.path.exists(configs_dir):
                os.makedirs(configs_dir)
            print(f"Warning: No .env file found. Creating one in the configs directory: {dotenv_path}")
    
    settings = {}

    # Read existing settings
    if os.path.exists(dotenv_path):
        with open(dotenv_path, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    settings[k] = v

    # Update or add the new setting
    settings[key] = str(value)

    # Debugging: Print settings being written
    print("\n[DEBUG] Writing the following settings to .env:")
    for k, v in settings.items():
        print(f"{k}={v}")

    # Write all settings back to the .env file
    with open(dotenv_path, "w") as f:
        for k, v in settings.items():
            f.write(f"{k}={v}\n")

    load_dotenv(dotenv_path=dotenv_path, override=True)  # Reload environment variables

# Fetch available voices
def fetch_voices(api_key):
    url = "https://api.elevenlabs.io/v1/voices"
    headers = {"xi-api-key": api_key}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json().get("voices", [])
    else:
        print(f"Failed to fetch voices: {response.status_code}, {response.text}")
        return []

# Update voice
def update_voice(api_key):
    voices = fetch_voices(api_key)
    if not voices:
        print("No voices available.")
        return

    print("Available voices:")
    for i, voice in enumerate(voices):
        print(f"{i + 1}. {voice['name']} (ID: {voice['voice_id']})")

    choice = input("Enter the number of the voice you'd like to use: ").strip()
    if choice.isdigit() and 1 <= int(choice) <= len(voices):
        new_voice_id = voices[int(choice) - 1]["voice_id"]
        save_setting("ELEVENLABS_VOICE_ID", new_voice_id)
        print(f"Updated voice ID to: {new_voice_id}")
    else:
        print("Invalid selection. No changes made.")

# Authenticate with Google Docs API
def authenticate_google_docs():
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), "..", "configs", "token_11labs.json")  # Unique token file for 11 Labs
    client_secret_path = os.path.join(os.path.dirname(__file__), "..", "configs", "client_secrets.json")

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, ["https://www.googleapis.com/auth/documents"])
    if not creds or not creds.valid:
        from google_auth_oauthlib.flow import InstalledAppFlow
        flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, ["https://www.googleapis.com/auth/documents"])
        creds = flow.run_local_server(port=0)
        with open(token_path, "w") as token_file:
            token_file.write(creds.to_json())

    return build("docs", "v1", credentials=creds)

# Extract Google Doc ID from URL
def extract_doc_id(google_doc_url):
    try:
        return google_doc_url.split("/d/")[1].split("/")[0]
    except IndexError:
        print("Invalid Google Doc URL.")
        return None

# Fetch content from Google Docs
def get_doc_content(doc_service, doc_id):
    doc = doc_service.documents().get(documentId=doc_id).execute()
    content = []
    for element in doc.get("body", {}).get("content", []):
        if "paragraph" in element:
            for text_run in element["paragraph"].get("elements", []):
                if "textRun" in text_run:
                    content.append(text_run["textRun"]["content"].strip())
    return content

# Split content into clumps
def split_clumps(content):
    print("\n[DEBUG] Original Content Lines:")  # Debugging: Display raw content
    for line in content:
        print(f"Line: {repr(line)}")

    clumps = []
    current_clump = []
    for line in content:
        if line.strip():  # Non-empty line
            current_clump.append(line.strip())
        else:  # Blank line indicates the end of a clump
            if current_clump:
                clumps.append(" ".join(current_clump))
                current_clump = []
    if current_clump:  # Add the last clump if there's no trailing blank line
        clumps.append(" ".join(current_clump))

    print("\n[DEBUG] Parsed Clumps:")  # Debugging: Display parsed clumps
    for i, clump in enumerate(clumps):
        print(f"Clump {i + 1}: {repr(clump)}")
    return clumps
    
# Generate audio files
# Generate audio files
# Generate audio files
def generate_audio(api_key, voice_id, text, filename, settings, output_folder_path):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": settings["MODEL_ID"],  # Ensure model_id is explicitly set
        "voice_settings": {
            "stability": settings["STABILITY_LEVEL"] / 100,
            "similarity_boost": settings["SIMILARITY_LEVEL"] / 100,
            "style": settings["STYLE_EXAGGERATION_LEVEL"] / 100,  # Corrected key name
            "use_speaker_boost": True if settings["SPEAKER_BOOST"] == "2" else False  # Corrected speaker boost format
        }
    }

    # Debugging: Print the settings used for each audio generation
    print("\n[DEBUG] Sending the following settings to ElevenLabs:")
    print(f"Stability Level: {settings['STABILITY_LEVEL']}")
    print(f"Similarity Level: {settings['SIMILARITY_LEVEL']}")
    print(f"Style Exaggeration Level: {settings['STYLE_EXAGGERATION_LEVEL']}")
    print(f"Speaker Boost: {'On' if settings['SPEAKER_BOOST'] == '2' else 'Off'}")
    print(f"Model: {settings['MODEL_ID']}")
    print(f"Voice ID: {voice_id}")
    print(f"Text: {text}")

    # Truncate and sanitize filename
    truncated_filename = filename[:50].strip()
    file_path = os.path.join(output_folder_path, f"{truncated_filename}.mp3")

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 200:
        with open(file_path, "wb") as f:
            f.write(response.content)  # Save the binary content directly
        print(f"Saved audio: {file_path}")
    else:
        print(f"Failed to generate audio for {filename}. Status: {response.status_code}")
        print("Response Content:", response.content.decode("utf-8", errors="ignore"))

# Process Google Docs
def process_google_docs():
    doc_service = authenticate_google_docs()
    settings = load_settings()

    text_doc_url = input("Enter Google Doc URL for ElevenLabs text lines: ").strip()
    filename_doc_url = input("Enter Google Doc URL for filenames: ").strip()

    text_doc_id = extract_doc_id(text_doc_url)
    filename_doc_id = extract_doc_id(filename_doc_url)

    if not text_doc_id or not filename_doc_id:
        print("Invalid Google Doc URL(s). Please try again.")
        return

    # Get Google Doc title for filenames folder
    filename_doc = doc_service.documents().get(documentId=filename_doc_id).execute()
    filename_doc_title = filename_doc.get("title", "Untitled Document")

    # Create a folder on the desktop (original behavior)
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    output_folder_name = f"{filename_doc_title} 11"
    output_folder_path = os.path.join(desktop_path, output_folder_name)
    os.makedirs(output_folder_path, exist_ok=True)

    print(f"Saving audio files to: {output_folder_path}")

    # Fetch content from Google Docs
    text_content = get_doc_content(doc_service, text_doc_id)
    filename_content = get_doc_content(doc_service, filename_doc_id)

    print("\n[DEBUG] Raw Text Content:")  # Debugging: Display text content
    for line in text_content:
        print(f"Text Line: {repr(line)}")

    print("\n[DEBUG] Raw Filename Content:")  # Debugging: Display filename content
    for line in filename_content:
        print(f"Filename Line: {repr(line)}")

    text_clumps = split_clumps(text_content)
    filename_clumps = split_clumps(filename_content)

    print(f"\n[DEBUG] Number of Text Clumps: {len(text_clumps)}")
    print(f"[DEBUG] Number of Filename Clumps: {len(filename_clumps)}")

    if len(text_clumps) != len(filename_clumps):
        print(f"Mismatch: {len(text_clumps)} text clumps vs {len(filename_clumps)} filename clumps.")
        print("[DEBUG] Ensure that both documents have matching clumps.")
        return

    for i, (text, filename) in enumerate(zip(text_clumps, filename_clumps)):
        print(f"\n[DEBUG] Processing Clump Pair {i + 1}:")
        print(f"Text Clump: {repr(text)}")
        print(f"Filename Clump: {repr(filename)}")
        generate_audio(
            settings["ELEVENLABS_API_KEY"],
            settings["ELEVENLABS_VOICE_ID"],
            text,
            filename,
            settings,
            output_folder_path
        )

# Update settings function (fully restored with additional logic)
def update_settings():
    settings = load_settings()
    voice_id = settings["ELEVENLABS_VOICE_ID"]
    if voice_id == "default_voice_id":
        print("No voice is currently loaded. Please use the 'new' command to select a voice first.")
        return

    # Stability Level
    print(f"Current Stability Level: {settings['STABILITY_LEVEL']}")
    stability = input("Enter new Stability Level (1-100) or press Enter to keep current: ").strip()
    if stability:
        if stability.isdigit() and 1 <= int(stability) <= 100:
            save_setting("STABILITY_LEVEL", stability)
        else:
            print("Invalid input. Keeping current Stability Level.")

    # Similarity Level
    print(f"Current Similarity Level: {settings['SIMILARITY_LEVEL']}")
    similarity = input("Enter new Similarity Level (1-100) or press Enter to keep current: ").strip()
    if similarity:
        if similarity.isdigit() and 1 <= int(similarity) <= 100:
            save_setting("SIMILARITY_LEVEL", similarity)
        else:
            print("Invalid input. Keeping current Similarity Level.")

    # Style Exaggeration Level
    print(f"Current Style Exaggeration Level: {settings['STYLE_EXAGGERATION_LEVEL']}")
    style = input("Enter new Style Exaggeration Level (1-100) or press Enter to keep current: ").strip()
    if style:
        if style.isdigit() and 1 <= int(style) <= 100:
            print(f"Saving Style Exaggeration Level: {style}")  # Debug line
            save_setting("STYLE_EXAGGERATION_LEVEL", style)
        else:
            print("Invalid input. Keeping current Style Exaggeration Level.")

    # Speaker Boost
    speaker_boost = input("Enable Speaker Boost? Enter '1' for Off or '2' for On: ").strip()
    if speaker_boost in ["1", "2"]:
        save_setting("SPEAKER_BOOST", speaker_boost)
        print(f"Speaker Boost updated to: {'Off' if speaker_boost == '1' else 'On'}")
    else:
        print("Invalid input. Keeping current Speaker Boost setting.")

    # Model Selection
    print("Available Models:")
    models = ["eleven_multilingual_v2", "v2", "default"]
    for i, model in enumerate(models):
        print(f"{i + 1}. {model}")

    model_choice = input("Select a model by number or press Enter to keep current: ").strip()
    if model_choice:
        if model_choice.isdigit() and 1 <= int(model_choice) <= len(models):
            save_setting("MODEL_ID", models[int(model_choice) - 1])
            print(f"Updated Model to: {models[int(model_choice) - 1]}")
        else:
            print("Invalid input. Keeping current Model.")

    print("\nSettings updated successfully!")

# Main script flow
def main():
    # Check for command-line arguments
    import sys
    
    if len(sys.argv) == 3:
        # Command line mode with text_doc_url and filename_doc_url as arguments
        print("\nRunning in command-line mode with provided Google Doc URLs")
        settings = load_settings()
        
        text_doc_url = sys.argv[1]
        filename_doc_url = sys.argv[2]
        
        print(f"Text Document URL: {text_doc_url}")
        print(f"Filename Document URL: {filename_doc_url}")
        
        # Validate voice ID
        voice_id = settings["ELEVENLABS_VOICE_ID"]
        if voice_id == "default_voice_id":
            print("No voice is currently loaded. Please run the script in interactive mode to select a voice first.")
            return
            
        # Process the documents
        doc_service = authenticate_google_docs()
        
        text_doc_id = extract_doc_id(text_doc_url)
        filename_doc_id = extract_doc_id(filename_doc_url)
        
        if not text_doc_id or not filename_doc_id:
            print("Invalid Google Doc URL(s). Please check the URLs and try again.")
            return
            
        # Get Google Doc title for filenames folder
        filename_doc = doc_service.documents().get(documentId=filename_doc_id).execute()
        filename_doc_title = filename_doc.get("title", "Untitled Document")
        
        # Create a folder on the desktop (original behavior)
        desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
        output_folder_name = f"{filename_doc_title} 11"
        output_folder_path = os.path.join(desktop_path, output_folder_name)
        os.makedirs(output_folder_path, exist_ok=True)
        
        print(f"Saving audio files to: {output_folder_path}")
        
        # Fetch content from Google Docs
        text_content = get_doc_content(doc_service, text_doc_id)
        filename_content = get_doc_content(doc_service, filename_doc_id)
        
        text_clumps = split_clumps(text_content)
        filename_clumps = split_clumps(filename_content)
        
        if len(text_clumps) != len(filename_clumps):
            print(f"Mismatch: {len(text_clumps)} text clumps vs {len(filename_clumps)} filename clumps.")
            return
            
        for i, (text, filename) in enumerate(zip(text_clumps, filename_clumps)):
            generate_audio(
                settings["ELEVENLABS_API_KEY"],
                settings["ELEVENLABS_VOICE_ID"],
                text,
                filename,
                settings,
                output_folder_path
            )
        return
    
    # Interactive mode
    while True:
        # Load current settings
        settings = load_settings()

        # Display current settings before prompting user
        print("\n=== Current Settings ===")
        print(f"Stability Level: {settings['STABILITY_LEVEL']}")
        print(f"Similarity Level: {settings['SIMILARITY_LEVEL']}")
        print(f"Style Exaggeration Level: {settings['STYLE_EXAGGERATION_LEVEL']}")
        print(f"Speaker Boost: {'On' if settings['SPEAKER_BOOST'] == '2' else 'Off'}")
        print(f"Model: {settings['MODEL_ID']}")
        print("========================\n")

        print("Type 'new' to update voice, 'SET' to change settings, or press Enter to proceed to Google Doc URLs.")
        command = input("Enter command: ").strip().lower()

        if command == "new":
            update_voice(settings["ELEVENLABS_API_KEY"])
        elif command == "set":
            update_settings()
        elif command == "":
            process_google_docs()
        else:
            print("Invalid command. Try again.")

if __name__ == "__main__":
    main()
