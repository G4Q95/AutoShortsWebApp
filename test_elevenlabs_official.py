import sys
import os
from elevenlabs import ElevenLabs

# Get API key from environment or default value
API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_266ffc8644c2ffc280fb476a4b061d425c166ce09a47a9dc")

print(f"Testing API key: {API_KEY[:5]}...{API_KEY[-5:]}")
print(f"API key length: {len(API_KEY)}")

try:
    # Create client with API key
    client = ElevenLabs(api_key=API_KEY)
    
    # Get list of voices to verify the API key works
    print("Attempting to get list of voices...")
    all_voices = client.voices.get_all()
    
    # If successful, print the voices
    if all_voices and hasattr(all_voices, 'voices'):
        print("Success! Found these voices:")
        for idx, voice in enumerate(all_voices.voices[:3]):
            print(f"Voice {idx+1}: {voice.name} (ID: {voice.voice_id})")
        
        print(f"Total voices available: {len(all_voices.voices)}")
        sys.exit(0)
except Exception as e:
    print(f"Error: {str(e)}")
    
    # Check if it's an authentication error
    if "401" in str(e) or "Unauthorized" in str(e) or "Invalid API key" in str(e):
        print("\nThis appears to be an authentication issue with your API key.")
        print("Please check that you've copied the correct key from ElevenLabs.")
        print("Make sure there are no extra spaces or characters in the key.")
    
    # If it's another kind of API error
    elif "400" in str(e) or "404" in str(e):
        print("\nThis appears to be an API error, not necessarily related to authentication.")
        print("The server rejected the request but your API key might still be valid.")
    
    # Network or other errors
    else:
        print("\nThis appears to be a general error, possibly related to network connectivity.")
        print("Try again or check your internet connection.")
    
    sys.exit(1) 