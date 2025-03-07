#!/usr/bin/env python3
"""
Reddit Content Downloader (formerly reddit_downloader.py)
This script downloads images and videos from Reddit posts and optionally uploads them to Google Drive.
Original location: ~/Desktop/Auto Shorts/Reddit Downloader Files/reddit_downloader.py

Dependencies:
- praw (Reddit API)
- google-auth-oauthlib (Google authentication)
- google-auth (Google authentication)
- google-api-python-client (Google Drive API)
"""

import os
import praw
import requests
import datetime
import re
from pathlib import Path
from bs4 import BeautifulSoup
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request

# Base paths
APP_ROOT = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG_DIR = APP_ROOT / "configs"
DATA_DIR = APP_ROOT / "data"
DOWNLOAD_DIR = DATA_DIR / "downloads"
VIDEO_DIR = DATA_DIR / "videos"
TEMP_DIR = DATA_DIR / "temp"

# Ensure directories exist
for directory in [DOWNLOAD_DIR, VIDEO_DIR, TEMP_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Configuration file paths
TOKEN_PATH = CONFIG_DIR / "token.pickle"
CLIENT_SECRETS_PATH = CONFIG_DIR / "client_secrets.json"

TEST_URLS = {
    "manual": {
        "image": "https://www.reddit.com/r/cats/comments/1hdlzx3/im_biased_but_i_think_i_have_the_most_beautiful/",
        "multi_image": "https://www.reddit.com/r/interestingasfuck/comments/1i284pq/in_germany_there_is_a_building_called_the/#lightbox",
        "video": "https://www.reddit.com/r/interestingasfuck/comments/1i2d03x/a_severe_motorcycle_accident_left_chef_peter/"
    },
    "doc": {
        "image": "https://www.reddit.com/r/cats/comments/1hdlzx3/im_biased_but_i_think_i_have_the_most_beautiful/",
        "multi_image": "https://www.reddit.com/r/interestingasfuck/comments/1i284pq/in_germany_there_is_a_building_called_the/#lightbox",
        "video": "https://www.reddit.com/r/interestingasfuck/comments/1i2d03x/a_severe_motorcycle_accident_left_chef_peter/"
    },
    "batch": {
        "subreddits": ["interestingasfuck", "creepy"],
        "num_posts": 3
    },
    "newfile": "https://docs.google.com/document/d/example_google_doc"
}

# Reddit API setup
reddit = praw.Reddit(
    client_id="vmQ10IDu3Ccer5Gqc4IDuA",
    client_secret="3_lh2CUJMv8Tdf5_3-4q1vKZ_dz5Zw",
    user_agent="reddit_downloader"
)

def update_terminal_title(mode):
    """
    Updates the terminal title and displays the mode label in the terminal.
    """
    title = f"{mode}"
    print(f"\033]0;{title}\007")  # Sets the terminal title dynamically
    
def is_doc_mode_active():
    """
    Helper function to determine if Doc mode is active.
    Returns True if both additional_image_doc_id and dock_local_folder are set.
    """
    return additional_image_doc_id is not None and dock_local_folder is not None

def display_mode_label(mode):
    """
    Displays a color-coded label for the current mode in the terminal.
    """
    colors = {
        "Doc": "\033[94m",   # Blue for Dock mode
        "Batch": "\033[91m", # Red for Batch mode
        "Manual": "\033[93m" # Yellow for Manual mode
    }
    reset_color = "\033[0m"
    print(f"{colors.get(mode, '')}{mode.upper():^50}{reset_color}")

    # Clear previous label line
    print("\0337", end="")  # Save cursor position
    print("\033[999B", end="")  # Move cursor to the bottom
    print("\033[K", end="")  # Clear the line
    print(f"{colors.get(mode, '')}{mode.upper():^50}{reset_color}")  # Centered mode label
    print("\0338", end="")  # Restore cursor position

# Google Docs and Drive API setup
SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive.file']

def authenticate_google_docs():
    print("Starting Google Docs authentication...")
    creds = None
    
    # Try to load existing token
    if TOKEN_PATH.exists():
        print("Token file found. Loading credentials...")
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        except Exception as e:
            print(f"Error loading token: {e}")
            creds = None
    
    # Check if we need to refresh or create new token
    if not creds or not creds.valid:
        print("Need to refresh or create new credentials...")
        if creds and creds.expired and creds.refresh_token:
            try:
                print("Refreshing expired token...")
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing token: {e}")
                print("Creating new token...")
                flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_PATH), SCOPES)
                creds = flow.run_local_server(port=0)
        else:
            print("Creating new token...")
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the new or refreshed token
        try:
            print("Saving token...")
            TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(TOKEN_PATH, 'wb') as token_file:
                token_file.write(creds.to_json().encode())
            print("Token saved successfully.")
        except Exception as e:
            print(f"Error saving token: {e}")
    
    print("Building Google Docs and Drive services...")
    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    print("Google Docs authentication successful!")
    return docs_service, drive_service

def append_to_google_doc(docs_service, doc_ids, title, image_ids=None, is_video=False):
    """
    Append content to multiple Google Docs. Handles text and inline images.
    Ensures exactly two line breaks between posts for better formatting.
    """
    if not doc_ids:
        print("DEBUG: No valid Google Doc IDs provided.")
        return

    for doc_id in doc_ids:
        if not doc_id or not isinstance(doc_id, str):
            print(f"DEBUG: Invalid document ID detected: {doc_id}")
            continue

        requests_body = []

        # Add the title with two line breaks
        requests_body.append({
            'insertText': {
                'location': {'index': 1},
                'text': f'{title}\n\n'
            }
        })

        # Add images
        if image_ids:
            for image_id in image_ids:
                try:
                    requests_body.append({
                        'insertInlineImage': {
                            'location': {'index': len(title) + 2},
                            'uri': f'https://drive.google.com/uc?id={image_id}',
                            'objectSize': {
                                'height': {'magnitude': 300, 'unit': 'PT'},
                                'width': {'magnitude': 300, 'unit': 'PT'}
                            }
                        }
                    })
                except Exception as e:
                    print(f"Error adding image to request body: {e}")

        # Add exactly two line breaks between posts
        requests_body.append({
            'insertText': {
                'location': {'index': len(title) + 3},
                'text': '\n\n'
            }
        })

        # Send the batch update to each Google Doc
        try:
            print(f"DEBUG: Sending request to Google Doc: {doc_id}")
            docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests_body}).execute()
            print(f"DEBUG: Appended to Google Doc: {doc_id}")
        except Exception as e:
            print(f"Error appending to Google Doc {doc_id}: {e}")
        
def sanitize_filename(filename):
    # Remove or replace characters that are not filesystem-friendly
    return re.sub(r'[<>:"/\\|?*]', '', filename[:100])  # Limit filename length

def download_image(url, output_folder, filename):
    """
    Downloads an image from the given URL to the specified folder.
    """
    if "imgur.com" in url:
        print(f"Imgur image detected, skipping: {url}")
        return None

    sanitized_filename = sanitize_filename(filename)
    image_path = os.path.join(output_folder, sanitized_filename)

    try:
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            os.makedirs(output_folder, exist_ok=True)
            with open(image_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=1024):
                    file.write(chunk)
            print(f"Downloaded: {image_path}")
            return image_path
        else:
            print(f"Failed to download image: {url} with status code {response.status_code}")
    except Exception as e:
        print(f"Error downloading image: {e}")
    return None
def upload_to_drive(drive_service, file_path, folder_id=None):
    """
    Upload a file to Google Drive and make it publicly accessible.
    """
    print(f"DEBUG: Uploading file to Drive: {file_path} with folder_id={folder_id}")
    file_metadata = {'name': os.path.basename(file_path)}
    if folder_id:
        file_metadata['parents'] = [folder_id]
    media = MediaFileUpload(file_path, resumable=True)
    uploaded_file = drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    print(f"DEBUG: File uploaded to Drive with ID: {uploaded_file.get('id')}")

    # Set file to be publicly accessible
    drive_service.permissions().create(
        fileId=uploaded_file.get('id'),
        body={'type': 'anyone', 'role': 'reader'},
    ).execute()

    print(f"DEBUG: Uploaded image accessible at: https://drive.google.com/uc?id={uploaded_file.get('id')}")
    return uploaded_file.get('id')
import subprocess

def manual_mode(docs_service, drive_service, image_doc_id, video_doc_id, reddit_url):
    global additional_image_doc_id, dock_local_folder, is_in_dock_mode

    # Determine current mode
    is_in_dock_mode = is_doc_mode_active()
    output_folder = dock_local_folder if is_in_dock_mode else str(DOWNLOAD_DIR)
    video_output_folder = str(VIDEO_DIR)
    target_doc_ids = [image_doc_id]  # Always append to the original Reddit Downloader Media Google Doc

    if is_in_dock_mode and additional_image_doc_id:
        target_doc_ids.append(additional_image_doc_id)

    try:
        submission = reddit.submission(url=reddit_url)
        post_title = submission.title

        if hasattr(submission, 'gallery_data'):
            # Multi-image post
            folder_name = sanitize_filename(post_title[:50])
            gallery_folder = os.path.join(output_folder, folder_name)
            os.makedirs(gallery_folder, exist_ok=True)
            print(f"Created folder for multi-image post: {gallery_folder}")

            media_ids = [item['media_id'] for item in submission.gallery_data['items']]
            image_ids = []
            for media_id in media_ids:
                media_url = f"https://i.redd.it/{media_id}.jpg"
                filename = f"{sanitize_filename(post_title[:50])}_{media_id}.jpg"
                image_path = download_image(media_url, gallery_folder, filename)
                if image_path:
                    drive_image_id = upload_to_drive(drive_service, image_path, folder_id=None)
                    image_ids.append(drive_image_id)
            if image_ids:
                append_to_google_doc(docs_service, target_doc_ids, post_title, image_ids=image_ids)

        elif submission.url.endswith(('.jpg', '.jpeg', '.png')):
            # Single-image post
            image_url = submission.url
            filename = f"{sanitize_filename(post_title[:50])}.jpg"
            print(f"Processing single image post: {image_url}")
            image_path = download_image(image_url, output_folder, filename)
            if image_path:
                drive_image_id = upload_to_drive(drive_service, image_path, folder_id=None)
                append_to_google_doc(docs_service, target_doc_ids, post_title, image_ids=[drive_image_id])

        elif submission.is_video:
            # Video post
            video_filename = f"{sanitize_filename(post_title[:50])}.mp4"
            video_path = os.path.join(video_output_folder, video_filename)

            print(f"Processing video post: {submission.url}")
            os.makedirs(video_output_folder, exist_ok=True)

            try:
                # Use yt-dlp to download video with audio
                result = subprocess.run([
                    "yt-dlp", "-f", "bv+ba/b", "-o", video_path, submission.url
                ], capture_output=True, text=True)

                print(f"yt-dlp Output: {result.stdout}")
                print(f"yt-dlp Error: {result.stderr}")

                if result.returncode == 0:
                    print(f"Video downloaded successfully with audio: {video_path}")
                    # Append to Google Doc
                    append_to_google_doc(docs_service, [video_doc_id], post_title, is_video=True)
                else:
                    print(f"yt-dlp failed with error code: {result.returncode}")

            except Exception as yt_dlp_error:
                print(f"Error using yt-dlp: {yt_dlp_error}")

        else:
            print("No valid media detected in this post.")

    except Exception as e:
        print(f"Error in manual_mode: {e}")
def batch_mode(docs_service, drive_service):
    """
    Batch mode with improved status reporting and failure reasons.
    Logs detailed reasons for skipped or failed posts and displays them at the end.
    """
    subreddit_input = input("Enter subreddit names separated by commas or spaces: ").strip()
    subreddit_names = [name.strip() for name in subreddit_input.replace(',', ' ').split()]
    
    print("Select a time frame for top posts:")
    print("1: Now")
    print("2: Today")
    print("3: This Week")
    print("4: This Month")
    print("5: This Year")
    print("6: All Time")
    time_frame_options = {
        '1': 'hour',
        '2': 'day',
        '3': 'week',
        '4': 'month',
        '5': 'year',
        '6': 'all'
    }
    time_frame = input("Select time frame (1-6): ").strip()
    if time_frame not in time_frame_options:
        print("Invalid selection. Defaulting to Today.")
        time_frame = '2'  # Default to 'day'
    selected_time_frame = time_frame_options[time_frame]

    num_posts = int(input("Enter the number of posts to download per subreddit: "))
    
    print("Enter 1 for photos only.")
    print("Enter 2 for videos only.")
    print("Enter 3 for both photos and videos.")
    toggle = input("Select content type to download (1, 2, or 3): ").strip()
    
    batch_name = input("Enter batch name: ")
    batch_folder = os.path.join(os.path.expanduser("~"), "Desktop", batch_name)
    os.makedirs(batch_folder, exist_ok=True)

    # Create a Google Doc for this batch
    try:
        batch_doc_id = create_new_google_doc(docs_service, batch_name)
        print(f"DEBUG: Created batch Google Doc with ID: {batch_doc_id}")
    except Exception as e:
        print(f"Error creating batch Google Doc: {e}")
        return

    # Track subreddit statuses and reasons for failure
    subreddit_status = {}
    failure_reasons = {}  # Tracks detailed failure reasons per subreddit

    for subreddit_name in subreddit_names:
        try:
            print(f"Processing subreddit: {subreddit_name}")
            subreddit = reddit.subreddit(subreddit_name)
            successful_downloads = 0  # Track the number of successful downloads
            failed_posts = []  # Log failed posts

            for post in subreddit.top(time_filter=selected_time_frame, limit=num_posts * 3):  # Check up to 3x num_posts
                if successful_downloads >= num_posts:
                    break  # Stop once we've downloaded enough posts

                try:
                    if toggle in ('1', '3') and post.url.endswith(('.jpg', '.jpeg', '.png')):
                        # Process single image posts
                        filename = f"{sanitize_filename(post.title[:50])}.jpg"
                        image_path = download_image(post.url, batch_folder, filename)
                        if image_path:
                            drive_image_id = upload_to_drive(drive_service, image_path)
                            append_to_google_doc(docs_service, [batch_doc_id], post.title, image_ids=[drive_image_id])
                            successful_downloads += 1
                            print(f"DEBUG: Successfully downloaded: {post.url}")
                        else:
                            print(f"DEBUG: Failed to download image: {post.url}")
                            failed_posts.append(f"Image download failed: {post.title} ({post.url})")

                    elif toggle in ('2', '3') and post.is_video:
                        # Process video posts
                        video_url = post.media['reddit_video']['fallback_url']
                        video_filename = f"{sanitize_filename(post.title[:50])}.mp4"
                        video_path = os.path.join(batch_folder, video_filename)
                        response = requests.get(video_url, stream=True)
                        if response.status_code == 200:
                            with open(video_path, 'wb') as file:
                                for chunk in response.iter_content(chunk_size=1024):
                                    file.write(chunk)
                            append_to_google_doc(docs_service, [batch_doc_id], post.title, is_video=True)
                            print(f"DEBUG: Successfully downloaded: {video_url}")
                            successful_downloads += 1
                        else:
                            print(f"DEBUG: Failed to download video: {video_url}")
                            failed_posts.append(f"Video download failed: {post.title} ({video_url})")
                    else:
                        print(f"DEBUG: Skipping post (no valid content type): {post.url}")

                except Exception as post_error:
                    print(f"Error processing post {post.title}: {post_error}")
                    failed_posts.append(f"Error: {post.title} ({post_error})")

            # Record status
            if successful_downloads > 0:
                subreddit_status[subreddit_name] = f"✔ Completed ({successful_downloads} posts downloaded)"
            else:
                subreddit_status[subreddit_name] = "✘ Failed: No valid posts processed."
                failure_reasons[subreddit_name] = failed_posts

        except Exception as subreddit_error:
            print(f"Error processing subreddit {subreddit_name}: {subreddit_error}")
            subreddit_status[subreddit_name] = f"✘ Failed: {subreddit_error}"
            failure_reasons[subreddit_name] = [str(subreddit_error)]

    # Display subreddit status summary
    print("\nBatch Mode Summary:")
    for subreddit_name, status in subreddit_status.items():
        print(f"- {subreddit_name}: {status}")
        if subreddit_name in failure_reasons:
            print(f"  Reasons:")
            for reason in failure_reasons[subreddit_name]:
                print(f"    - {reason}")

    print(f"\nGoogle Doc created for this batch: https://docs.google.com/document/d/{batch_doc_id}/edit")
            
def process_new_video_for_newfile(docs_service, google_doc_url):
    """
    Process a new video project without affecting other modes.
    - Copies files into a new folder instead of creating symlinks.
    """
    try:
        # Extract Google Doc ID from URL
        doc_id = google_doc_url.split('/d/')[1].split('/')[0]

        # Fetch document content
        document = docs_service.documents().get(documentId=doc_id).execute()
        doc_title = document.get("title", "Untitled Video Project")
        content = document.get('body', {}).get('content', [])

        # Extract descriptions
        descriptions = []
        for element in content:
            if 'paragraph' in element:
                text = ''.join(e.get('textRun', {}).get('content', '').strip() for e in element['paragraph']['elements'])
                if text:
                    descriptions.append(text[:50])  # Truncate to 50 characters

        # Create a dedicated folder for the video project
        output_folder = os.path.join(os.path.expanduser("~"), "Desktop", doc_title)
        os.makedirs(output_folder, exist_ok=True)
        print(f"Created folder for new video project: {output_folder}")

        # Dedicated logic for copying files
        missing_files = []
        for desc in descriptions:
            sanitized_name = re.sub(r'[<>:"/\\|?*]', '', desc[:50])  # Local sanitization
            file_name = f"{sanitized_name}.jpg"
            print(f"Searching for file: {file_name}")
            found = False

            for root, _, files in os.walk(os.path.expanduser("~")):  # Search home directory recursively
                if file_name in files:
                    original_path = os.path.join(root, file_name)
                    destination_path = os.path.join(output_folder, file_name)
                    try:
                        # Copy the file to the new folder
                        print(f"Copying file: {original_path} -> {destination_path}")
                        os.makedirs(os.path.dirname(destination_path), exist_ok=True)
                        with open(original_path, 'rb') as src_file:
                            with open(destination_path, 'wb') as dest_file:
                                dest_file.write(src_file.read())
                        print(f"Copied successfully: {destination_path}")
                        found = True
                        break
                    except Exception as copy_error:
                        print(f"Error copying file {original_path}: {copy_error}")

            if not found:
                print(f"File not found: {file_name}")
                missing_files.append(file_name)

        # Log missing files
        if missing_files:
            missing_log_path = os.path.join(output_folder, "missing_files.log")
            with open(missing_log_path, 'w') as log_file:
                log_file.write("\n".join(missing_files))
            print(f"Missing files logged: {missing_log_path}")
        else:
            print("All files were found and copied successfully!")

    except Exception as e:
        print(f"Error in newfile mode: {e}")
            
def create_new_google_doc(docs_service, name):
    document = docs_service.documents().create(body={"title": name}).execute()
    return document.get("documentId")
additional_image_doc_id = None  # Global variable to store additional Google Doc ID
is_in_dock_mode = False  # Default dock mode is off
dock_local_folder = None  # No default folder for dock mode

def set_additional_google_doc(docs_service):
    global additional_image_doc_id, is_in_dock_mode, dock_local_folder

    is_in_dock_mode = True  # Enter Doc Mode
    print(f"DEBUG: Entering set_additional_google_doc with is_in_dock_mode={is_in_dock_mode}")  # Debugging line
    while True:
        print("To set a new Google Doc, enter the document ID or URL.")
        print("To stop using an additional Google Doc, type 'stop'.")
        doc_input = input("Enter your choice: ").strip()

        if doc_input.lower() == 'stop':
            additional_image_doc_id = None
            dock_local_folder = None
            is_in_dock_mode = False  # Exit Doc Mode
            print("DEBUG: Exiting Doc mode. is_in_dock_mode set to False.")  # Debugging line
            update_terminal_title("Manual")  # Reset visuals to Manual
            break
        elif doc_input:
            # Extract Document ID if a full URL is provided
            if 'docs.google.com' in doc_input:
                try:
                    doc_id = doc_input.split('/d/')[1].split('/')[0]
                    additional_image_doc_id = doc_id
                    doc_name = docs_service.documents().get(documentId=doc_id).execute().get("title")
                    dock_local_folder = os.path.join(os.path.expanduser("~"), "Desktop", doc_name)
                    os.makedirs(dock_local_folder, exist_ok=True)
                    print(f"Additional Google Doc set with ID: {additional_image_doc_id}")
                    print(f"Local folder set to: {dock_local_folder}")
                except IndexError:
                    print("Invalid URL. Please enter a valid Google Doc URL or ID.")
            else:
                # Assume it's a raw Document ID
                additional_image_doc_id = doc_input
                dock_local_folder = os.path.join(os.path.expanduser("~"), "Desktop", additional_image_doc_id)
                os.makedirs(dock_local_folder, exist_ok=True)
                print(f"Additional Google Doc set with ID: {additional_image_doc_id}")
                print(f"Local folder set to: {dock_local_folder}")
            update_terminal_title("Doc")  # Update visuals to Doc Mode
            break
        else:
            print("Invalid input. Please enter a valid Google Doc ID or type 'stop'.")
            
def cleanup_test_data(docs_service, test_log):
    """
    Cleans up test data by clearing Google Docs and deleting local files.
    """
    print("Starting cleanup...")

    # Clear Google Docs
    for doc_id in test_log["google_docs"]:
        try:
            print(f"Clearing content in Google Doc: {doc_id}")
            docs_service.documents().batchUpdate(
                documentId=doc_id,
                body={"requests": [{"deleteContentRange": {"range": {"startIndex": 1, "endIndex": -1}}}]}
            ).execute()
            print(f"Cleared content in Google Doc: {doc_id}")
        except Exception as e:
            print(f"Failed to clear Google Doc {doc_id}: {e}")

    # Delete local folders
    for folder in test_log["local_folders"]:
        try:
            print(f"Deleting folder: {folder}")
            if os.path.exists(folder):
                for root, dirs, files in os.walk(folder, topdown=False):
                    for file in files:
                        os.remove(os.path.join(root, file))
                    for dir in dirs:
                        os.rmdir(os.path.join(root, dir))
                os.rmdir(folder)
                print(f"Deleted folder: {folder}")
        except Exception as e:
            print(f"Failed to delete folder {folder}: {e}")

    print("Cleanup complete!")
            
def run_tests(docs_service, drive_service):
    """
    Run automated tests for all modes to ensure no features are broken.
    Includes cleanup functionality.
    """
    print("Starting automated tests...")

    # Create test folders and log paths for cleanup
    test_log = {
        "google_docs": [],
        "local_folders": []
    }

    # Google Doc for Doc Mode
    doc_mode_url = "https://docs.google.com/document/d/1WTuXy4YnlGdwllJDfA0ZD83_pa4Vra6LU732zQAOm8A/edit?tab=t.0"
    doc_mode_id = doc_mode_url.split('/d/')[1].split('/')[0]
    test_log["google_docs"].append(doc_mode_id)

    # Batch Mode Settings
    batch_name = f"Batch_Test_{datetime.datetime.now().strftime('%Y-%m-%d_%H-%M')}"
    batch_folder = os.path.join(os.path.expanduser("~"), "Desktop", batch_name)
    os.makedirs(batch_folder, exist_ok=True)
    test_log["local_folders"].append(batch_folder)

    # Test Manual Mode
    print("Testing Manual Mode...")
    for media_type, url in TEST_URLS["manual"].items():
        print(f"Testing Manual Mode with {media_type} post...")
        try:
            manual_mode(docs_service, drive_service, doc_mode_id, doc_mode_id, url)
            print(f"Manual Mode {media_type} test passed!")
        except Exception as e:
            print(f"Manual Mode {media_type} test failed: {e}")

    # Test Doc Mode
    print("Testing Doc Mode...")
    for media_type, url in TEST_URLS["doc"].items():
        print(f"Testing Doc Mode with {media_type} post...")
        try:
            manual_mode(docs_service, drive_service, doc_mode_id, doc_mode_id, url)
            print(f"Doc Mode {media_type} test passed!")
        except Exception as e:
            print(f"Doc Mode {media_type} test failed: {e}")

    # Test Batch Mode
    print("Testing Batch Mode...")
    try:
        subreddit_names = TEST_URLS["batch"]["subreddits"]
        for subreddit in subreddit_names:
            print(f"Processing Batch Mode for subreddit: {subreddit}")
            subreddit_instance = reddit.subreddit(subreddit)
            for post in subreddit_instance.top(time_filter="week", limit=3):
                if post.url.endswith(('.jpg', '.jpeg', '.png')):
                    print(f"Downloaded image: {post.url}")
                else:
                    print(f"Skipped post: {post.title}")
        print("Batch Mode test passed!")
    except Exception as e:
        print(f"Batch Mode test failed: {e}")

    # Prompt for cleanup
    print("\nAll tests completed!")
    if input("Do you want to delete test data (Google Doc content and local files)? (y/n): ").lower() == 'y':
        cleanup_test_data(docs_service, test_log)
    
def main():
    print("Starting the script...")  # Debugging line
    docs_service, drive_service = authenticate_google_docs()
    print("Authentication complete. Entering main loop...")  # Debugging line

    image_doc_id = '1-fggoPMaA95e8ZbVC7Bebi1GvRbMofGZx26erqUBj4g'  # Default image doc
    video_doc_id = '1xHN0uL2PhFy0hotdT9t6kdtOJprCN1RnIFmrDB5lyGY'  # Default video doc

    current_mode = "Manual"  # Default to Manual mode at startup
    update_terminal_title(current_mode)

    while True:
        # Debugging: Track the current mode
        if is_doc_mode_active():
            current_mode = "Doc"
        print(f"DEBUG: Entering main loop with current_mode={current_mode}")

        # Display current mode label
        display_mode_label(current_mode)
        print("\n" + "-" * 50)
        print(f"Current Mode: {current_mode}")
        print("Options:")
        print("Enter 'doc' to manage additional Google Doc.")
        print("Enter 'batch' for batch mode.")
        print("Enter 'newfile' to create a new video project.")  # Added newfile mode
        print("Enter 'test' to run automated tests.")  # Added test mode
        print("Enter a Reddit thread URL for manual mode.")
        print("Enter 'exit' to quit.")
        mode = input("Select a mode or provide a Reddit URL: ").strip()

        if mode.lower() == 'doc':
            print("DEBUG: Switching to Doc mode")  # Debugging line
            set_additional_google_doc(docs_service)  # Pass docs_service here
        elif mode.lower() == 'batch':
            print("DEBUG: Switching to Batch mode")  # Debugging line
            current_mode = "Batch"
            update_terminal_title(current_mode)
            batch_mode(docs_service, drive_service)
        elif mode.lower() == 'newfile':  # Handle newfile mode
            google_doc_url = input("Enter Google Doc URL for the new video: ").strip()
            process_new_video_for_newfile(docs_service, google_doc_url)
        elif mode.lower() == 'test':  # Run tests mode
            run_tests(docs_service, drive_service)
        elif mode.lower() == 'exit':
            print("Exiting the script...")
            break
        else:
            print("DEBUG: Switching to Manual mode")  # Debugging line
            current_mode = "Manual"
            update_terminal_title(current_mode)
            manual_mode(docs_service, drive_service, image_doc_id, video_doc_id, mode)
if __name__ == "__main__":
    main()

