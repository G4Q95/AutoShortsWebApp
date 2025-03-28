#!/usr/bin/env python3
"""
A very simple test of Wrangler's access to R2.
"""
import subprocess
import os
import sys

# Define colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

def run_command(cmd):
    """Run a command and return the result."""
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result

def main():
    bucket_name = "autoshorts-media"
    if len(sys.argv) > 1:
        bucket_name = sys.argv[1]
    
    print(f"\n{YELLOW}Testing Wrangler R2 access to bucket: {bucket_name}{RESET}\n")
    
    # Check if Wrangler is installed
    result = run_command(["wrangler", "--version"])
    if result.returncode == 0:
        print(f"{GREEN}✓ Wrangler is installed: {result.stdout.strip()}{RESET}")
    else:
        print(f"{RED}✗ Wrangler not found: {result.stderr}{RESET}")
        return 1
    
    # List buckets
    print("\nChecking available buckets:")
    result = run_command(["wrangler", "r2", "bucket", "list"])
    if result.returncode == 0:
        print(f"{GREEN}✓ Successfully listed buckets{RESET}")
        print("\nOutput:")
        print(result.stdout)
        
        # Check if our bucket is in the list
        if f"name:           {bucket_name}" in result.stdout:
            print(f"{GREEN}✓ Bucket '{bucket_name}' found!{RESET}")
        else:
            print(f"{RED}✗ Bucket '{bucket_name}' not found in the list{RESET}")
            print(f"  Available buckets in the output: {result.stdout}")
            return 1
    else:
        print(f"{RED}✗ Failed to list buckets: {result.stderr}{RESET}")
        return 1
    
    # Create a test file
    test_content = "This is a test file for R2 access."
    test_filename = "test_file.txt"
    with open(test_filename, "w") as f:
        f.write(test_content)
    
    # Upload the test file
    print(f"\nUploading test file to {bucket_name}:")
    result = run_command(["wrangler", "r2", "object", "put", f"{bucket_name}/test-wrangler-access.txt", "--file", test_filename])
    if result.returncode == 0:
        print(f"{GREEN}✓ Successfully uploaded test file{RESET}")
        print(result.stdout)
    else:
        print(f"{RED}✗ Failed to upload test file: {result.stderr}{RESET}")
        os.remove(test_filename)
        return 1
    
    # Delete the test file from R2
    print(f"\nDeleting test file from {bucket_name}:")
    result = run_command(["wrangler", "r2", "object", "delete", f"{bucket_name}/test-wrangler-access.txt"])
    if result.returncode == 0:
        print(f"{GREEN}✓ Successfully deleted test file{RESET}")
        print(result.stdout)
    else:
        print(f"{RED}✗ Failed to delete test file: {result.stderr}{RESET}")
        os.remove(test_filename)
        return 1
    
    # Clean up the local test file
    os.remove(test_filename)
    
    print(f"\n{GREEN}All tests passed! Wrangler can access the R2 bucket.{RESET}")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 