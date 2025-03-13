import requests
import sys
import os
from urllib.parse import quote

# Try getting the key from environment
API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_266ffc8644c2ffc280fb476a4b061d425c166ce09a47a9dc")
API_URL = "https://api.elevenlabs.io/v1"

def test_elevenlabs_api():
    """Test if the ElevenLabs API key is valid by making a simple request."""
    
    # Display key details for debugging
    print(f"API Key: {API_KEY}")
    print(f"API Key length: {len(API_KEY)}")
    print(f"API Key characters: {' '.join(c for c in API_KEY)}")
    
    # URL encode the key for testing
    encoded_key = quote(API_KEY)
    print(f"URL-encoded key: {encoded_key}")
    print(f"URL-encoded key length: {len(encoded_key)}")
    
    # Format inspection
    if API_KEY.startswith("sk_"):
        print("Key uses newer 'sk_' format")
    elif API_KEY.startswith("elg"):
        print("Key uses traditional 'elg' format")
    else:
        print(f"Key has unusual prefix: {API_KEY[:3]}")
    
    # Set up headers with API key
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    # Try to get voices instead of user info (often more reliable)
    voice_url = f"{API_URL}/voices"
    print(f"\nTesting ElevenLabs API with URL: {voice_url}")
    
    try:
        response = requests.get(voice_url, headers=headers)
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            print("API key is valid! Here's a sample of voices:")
            data = response.json()
            for idx, voice in enumerate(data.get("voices", [])[:3]):
                print(f"Voice {idx + 1}: {voice.get('name')} (ID: {voice.get('voice_id')})")
            return True
        else:
            print("API key appears to be invalid. Error response:")
            print(response.text)
            
            # Try an alternative method for API key
            print("\nTrying alternative API key header format...")
            alt_headers = {
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            }
            alt_response = requests.get(voice_url, headers=alt_headers)
            print(f"Alternative method status code: {alt_response.status_code}")
            if alt_response.status_code == 200:
                print("Alternative method worked! API key should be used with Authorization: Bearer header")
                return True
            else:
                print("Alternative method also failed.")
                return False
            
    except Exception as e:
        print(f"Error testing API key: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_elevenlabs_api()
    sys.exit(0 if success else 1) 