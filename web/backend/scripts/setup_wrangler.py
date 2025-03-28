#!/usr/bin/env python3
"""
Set up Wrangler authentication for Cloudflare R2 access.

This script guides you through the process of configuring Wrangler 
for use with Cloudflare R2 in our application.

Usage:
    python setup_wrangler.py

Requirements:
    - Wrangler must be installed (npm i -g wrangler)
    - You need your Cloudflare account ID and API token
"""

import subprocess
import os
import sys
import json
import logging
from pathlib import Path
import getpass

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def check_wrangler_installed():
    """Check if Wrangler is installed and get the version."""
    try:
        result = subprocess.run(
            ["wrangler", "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        version = result.stdout.strip()
        logger.info(f"Wrangler is installed: {version}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Error checking Wrangler version: {e.stderr}")
        return False
    except FileNotFoundError:
        logger.error("Wrangler is not installed. Please install it with 'npm i -g wrangler'")
        return False

def check_wrangler_authentication():
    """Check if Wrangler is authenticated with Cloudflare."""
    try:
        # Try a command that requires authentication
        result = subprocess.run(
            ["wrangler", "whoami"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # Parse the output to get account info
            output = result.stdout.strip()
            logger.info(f"Wrangler is authenticated: {output}")
            
            # Try to parse JSON (newer wrangler versions return JSON)
            try:
                data = json.loads(output)
                account_id = data.get("account", {}).get("id")
                account_name = data.get("account", {}).get("name")
                if account_id and account_name:
                    logger.info(f"Authenticated as: {account_name} (Account ID: {account_id})")
            except json.JSONDecodeError:
                # Not JSON format, just log the raw output
                pass
                
            return True
        else:
            logger.warning("Wrangler is not authenticated with Cloudflare")
            logger.info("Error message: " + result.stderr.strip())
            return False
    except Exception as e:
        logger.error(f"Error checking Wrangler authentication: {str(e)}")
        return False

def authenticate_wrangler():
    """Authenticate Wrangler with Cloudflare."""
    logger.info("Starting Wrangler authentication process...")
    
    # Check if .wrangler directory exists in the home directory
    home_dir = Path.home()
    wrangler_dir = home_dir / ".wrangler"
    config_file = wrangler_dir / "config.toml"
    
    if config_file.exists():
        logger.info("Wrangler config file already exists. Do you want to reconfigure it?")
        choice = input("Reconfigure Wrangler? (y/n): ").strip().lower()
        if choice != 'y':
            logger.info("Skipping Wrangler configuration")
            return True
    
    # Guide the user through the login process
    logger.info("\n==== Wrangler Authentication Guide ====")
    logger.info("1. You'll need to authenticate Wrangler with your Cloudflare account")
    logger.info("2. We'll run 'wrangler login' which will open a browser window")
    logger.info("3. Follow the prompts in the browser to authenticate")
    logger.info("4. After successful authentication, return to this terminal")
    
    input("\nPress Enter to start the login process...")
    
    try:
        # Run wrangler login
        result = subprocess.run(["wrangler", "login"], text=True)
        
        if result.returncode == 0:
            logger.info("Wrangler login process completed")
            
            # Verify authentication worked
            if check_wrangler_authentication():
                logger.info("Authentication successful!")
                return True
            else:
                logger.error("Authentication process completed but verification failed")
                return False
        else:
            logger.error("Wrangler login failed")
            return False
    except Exception as e:
        logger.error(f"Error during Wrangler login: {str(e)}")
        return False

def test_r2_access():
    """Test access to R2 buckets."""
    logger.info("\nTesting access to R2 buckets...")
    
    try:
        # List available R2 buckets
        result = subprocess.run(
            ["wrangler", "r2", "bucket", "list", "--json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            try:
                buckets = json.loads(result.stdout)
                
                if buckets:
                    logger.info(f"Successfully accessed R2: Found {len(buckets)} buckets")
                    logger.info("Available buckets:")
                    for i, bucket in enumerate(buckets):
                        bucket_name = bucket.get("name", "Unknown")
                        creation_date = bucket.get("creation_date", "Unknown")
                        logger.info(f"  {i+1}. {bucket_name} (Created: {creation_date})")
                    
                    # Ask the user to select a bucket to test
                    if len(buckets) > 0:
                        logger.info("\nWould you like to test listing objects in one of these buckets?")
                        choice = input("Select a bucket number or press Enter to skip: ").strip()
                        
                        if choice and choice.isdigit() and 1 <= int(choice) <= len(buckets):
                            selected_bucket = buckets[int(choice)-1]["name"]
                            logger.info(f"Selected bucket: {selected_bucket}")
                            
                            # Test listing objects in the selected bucket
                            test_list_objects(selected_bucket)
                else:
                    logger.warning("No R2 buckets found in your account")
            except json.JSONDecodeError:
                logger.error("Failed to parse bucket list response")
                logger.info(f"Raw response: {result.stdout}")
        else:
            logger.error(f"Failed to list R2 buckets: {result.stderr}")
    except Exception as e:
        logger.error(f"Error testing R2 access: {str(e)}")
    
    return

def test_list_objects(bucket_name):
    """Test listing objects in a specific bucket."""
    logger.info(f"\nListing objects in bucket '{bucket_name}'...")
    
    try:
        # List objects in the bucket
        result = subprocess.run(
            ["wrangler", "r2", "object", "list", bucket_name, "--json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            try:
                objects = json.loads(result.stdout)
                
                if objects:
                    logger.info(f"Successfully listed objects: Found {len(objects)} objects")
                    logger.info("First 5 objects:")
                    for i, obj in enumerate(objects[:5]):
                        key = obj.get("key", "Unknown")
                        size = obj.get("size", 0)
                        size_kb = round(size / 1024, 2) if size > 0 else 0
                        logger.info(f"  {i+1}. {key} ({size_kb} KB)")
                    
                    if len(objects) > 5:
                        logger.info(f"  ... and {len(objects) - 5} more objects")
                else:
                    logger.info("Bucket is empty (no objects found)")
            except json.JSONDecodeError:
                logger.error("Failed to parse object list response")
                logger.info(f"Raw response: {result.stdout}")
        else:
            logger.error(f"Failed to list objects in bucket: {result.stderr}")
    except Exception as e:
        logger.error(f"Error listing objects: {str(e)}")

def setup_env_vars():
    """Guide the user to set up environment variables for R2."""
    logger.info("\n==== R2 Environment Variables Setup ====")
    logger.info("The application needs these environment variables to access R2:")
    logger.info("  - R2_ACCOUNT_ID: Your Cloudflare account ID")
    logger.info("  - R2_ACCESS_KEY_ID: Your R2 access key ID")
    logger.info("  - R2_SECRET_ACCESS_KEY: Your R2 secret access key")
    logger.info("  - R2_BUCKET_NAME: Your R2 bucket name")
    
    choice = input("\nWould you like help configuring these variables? (y/n): ").strip().lower()
    if choice != 'y':
        logger.info("Skipping environment variables setup")
        return
    
    # Account ID
    logger.info("\n1. Finding your Cloudflare Account ID:")
    logger.info("   - Running 'wrangler whoami' to get account details...")
    
    try:
        result = subprocess.run(
            ["wrangler", "whoami", "--json"],
            capture_output=True,
            text=True
        )
        
        account_id = None
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                account_id = data.get("account", {}).get("id")
                if account_id:
                    logger.info(f"   - Found Account ID: {account_id}")
                else:
                    logger.warning("   - Could not extract Account ID from response")
            except json.JSONDecodeError:
                logger.warning("   - Could not parse response as JSON")
        
        if not account_id:
            account_id = input("   - Enter your Cloudflare Account ID manually: ").strip()
    except Exception as e:
        logger.error(f"   - Error getting account ID: {str(e)}")
        account_id = input("   - Enter your Cloudflare Account ID manually: ").strip()
    
    # R2 credentials
    logger.info("\n2. Creating R2 API Token:")
    logger.info("   - Go to https://dash.cloudflare.com -> R2 -> Manage R2 API Tokens")
    logger.info("   - Create a new API token with read/write permissions")
    
    access_key = input("   - Enter your R2 Access Key ID: ").strip()
    secret_key = getpass.getpass("   - Enter your R2 Secret Access Key: ").strip()
    
    # Bucket name
    logger.info("\n3. Selecting R2 Bucket:")
    try:
        result = subprocess.run(
            ["wrangler", "r2", "bucket", "list", "--json"],
            capture_output=True,
            text=True
        )
        
        bucket_name = None
        if result.returncode == 0:
            try:
                buckets = json.loads(result.stdout)
                
                if buckets:
                    logger.info(f"   - Found {len(buckets)} buckets:")
                    for i, bucket in enumerate(buckets):
                        bucket_name = bucket.get("name", "Unknown")
                        logger.info(f"     {i+1}. {bucket_name}")
                    
                    choice = input("   - Select a bucket number or enter a name manually: ").strip()
                    if choice.isdigit() and 1 <= int(choice) <= len(buckets):
                        bucket_name = buckets[int(choice)-1]["name"]
                    else:
                        bucket_name = choice
                else:
                    logger.warning("   - No R2 buckets found in your account")
                    bucket_name = input("   - Enter your R2 bucket name: ").strip()
            except json.JSONDecodeError:
                logger.warning("   - Could not parse bucket list response")
                bucket_name = input("   - Enter your R2 bucket name: ").strip()
        else:
            logger.warning(f"   - Failed to list R2 buckets: {result.stderr}")
            bucket_name = input("   - Enter your R2 bucket name: ").strip()
    except Exception as e:
        logger.error(f"   - Error listing buckets: {str(e)}")
        bucket_name = input("   - Enter your R2 bucket name: ").strip()
    
    # Generate .env file content
    env_content = f"""# Cloudflare R2 configuration
R2_ACCOUNT_ID={account_id}
R2_ACCESS_KEY_ID={access_key}
R2_SECRET_ACCESS_KEY={secret_key}
R2_BUCKET_NAME={bucket_name}
"""
    
    # Ask where to save
    logger.info("\n4. Saving Configuration:")
    logger.info("   - Where would you like to save these variables?")
    logger.info("     1. Create/update .env file in the current directory")
    logger.info("     2. Just show me the variables to copy manually")
    logger.info("     3. Cancel")
    
    choice = input("   - Select an option (1-3): ").strip()
    
    if choice == "1":
        env_path = Path(".env")
        
        # Check if file exists
        if env_path.exists():
            logger.warning("   - .env file already exists")
            overwrite = input("   - Do you want to (o)verwrite it or (a)ppend to it? (o/a): ").strip().lower()
            
            if overwrite == "o":
                with open(env_path, "w") as f:
                    f.write(env_content)
                logger.info(f"   - Overwrote .env file at {env_path.absolute()}")
            elif overwrite == "a":
                with open(env_path, "a") as f:
                    f.write("\n\n" + env_content)
                logger.info(f"   - Appended to .env file at {env_path.absolute()}")
            else:
                logger.info("   - Cancelled writing to .env file")
        else:
            with open(env_path, "w") as f:
                f.write(env_content)
            logger.info(f"   - Created .env file at {env_path.absolute()}")
    elif choice == "2":
        logger.info("\n==== Environment Variables ====")
        logger.info(env_content)
        logger.info("================================")
    else:
        logger.info("   - Cancelled saving configuration")
    
    logger.info("\nR2 environment variables setup complete!")

def main():
    """Main function to guide Wrangler setup."""
    logger.info("=== Wrangler Setup for Cloudflare R2 Access ===\n")
    
    # Step 1: Check if Wrangler is installed
    if not check_wrangler_installed():
        logger.error("Wrangler is not installed. Please install it with 'npm i -g wrangler'")
        return 1
    
    # Step 2: Check if Wrangler is authenticated
    is_authenticated = check_wrangler_authentication()
    
    # Step 3: If not authenticated, guide through the process
    if not is_authenticated:
        if not authenticate_wrangler():
            logger.error("Failed to authenticate Wrangler. Please try again manually with 'wrangler login'")
            return 1
    
    # Step 4: Test R2 access
    test_r2_access()
    
    # Step 5: Guide the user to set up environment variables
    setup_env_vars()
    
    logger.info("\n=== Wrangler Setup Complete ===")
    logger.info("You can now use Wrangler to manage your R2 storage!")
    
    return 0

if __name__ == "__main__":
    result = main()
    sys.exit(result) 