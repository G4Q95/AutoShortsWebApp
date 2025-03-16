import os
import time
import requests
from pathlib import Path

def create_test_file():
    """Create a small test file for upload testing"""
    test_file_path = "test_upload.txt"
    with open(test_file_path, "w") as f:
        f.write("This is a test file for upload testing.")
    return test_file_path

def test_file_upload():
    """Test file upload to the backend server"""
    print("Starting upload test to verify mock storage...")

    # Create a test file
    test_file_path = create_test_file()
    print(f"Created test file at: {test_file_path}")

    # Backend server URL
    upload_url = "http://localhost:8000/api/media/upload"
    
    # Prepare the file for upload
    files = {
        'file': (os.path.basename(test_file_path), open(test_file_path, 'rb'), 'text/plain')
    }
    
    # Add metadata
    data = {
        'title': 'Test Upload',
        'description': 'Testing mock storage upload functionality'
    }
    
    try:
        # Attempt to upload the file
        print("Attempting to upload file...")
        response = requests.post(upload_url, files=files, data=data)
        
        # Check response
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Upload successful! Mock storage is working correctly.")
            result = response.json()
            if 'file_url' in result:
                print(f"File URL: {result['file_url']}")
                
                # Verify the file can be accessed
                print("Attempting to access the uploaded file...")
                file_response = requests.get(result['file_url'])
                if file_response.status_code == 200:
                    print("✅ File access successful!")
                else:
                    print(f"❌ File access failed with status code: {file_response.status_code}")
            else:
                print("❌ No file URL returned in the response")
        else:
            print(f"❌ Upload failed with status code: {response.status_code}")
    
    except Exception as e:
        print(f"❌ Error during upload test: {str(e)}")
    
    finally:
        # Clean up the test file
        try:
            os.remove(test_file_path)
            print(f"Removed test file: {test_file_path}")
        except Exception as e:
            print(f"Error removing test file: {str(e)}")
        
        # Close the file handle in the files dictionary
        try:
            files['file'][1].close()
            print("Closed file handle")
        except:
            pass

if __name__ == "__main__":
    test_file_upload() 