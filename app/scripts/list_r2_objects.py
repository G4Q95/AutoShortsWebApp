import os
import logging
import sys
from pathlib import Path
from prettytable import PrettyTable

# Add the parent directory to sys.path to allow imports from app
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.services.storage import R2Storage

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('r2_listing')

def check_environment():
    """Check if all required environment variables are set."""
    env_vars = {
        'CLOUDFLARE_R2_ENDPOINT': os.getenv('CLOUDFLARE_R2_ENDPOINT'),
        'CLOUDFLARE_R2_ACCESS_KEY_ID': os.getenv('CLOUDFLARE_R2_ACCESS_KEY_ID'),
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY': os.getenv('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
        'R2_BUCKET_NAME': os.getenv('R2_BUCKET_NAME'),
    }

    print("\n===== ENVIRONMENT VARIABLE STATUS =====")
    for var, value in env_vars.items():
        if value:
            # Mask the value for security
            masked_value = value[:4] + "..." + value[-3:] if len(value) > 10 else "***"
            print(f"✅ SET: {var} - {masked_value}")
        else:
            print(f"❌ MISSING: {var}")
    print("=======================================\n")

def format_size(size_bytes):
    """Format bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0 or unit == 'TB':
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0

def main():
    check_environment()
    
    # Initialize R2Storage
    storage = R2Storage()
    
    # List all objects in the bucket
    print("Listing objects in R2 bucket...")
    result = storage.list_directory("")
    
    objects = result.get('objects', [])
    if not objects:
        print("No objects found in the bucket.")
        return
    
    # Count objects by top-level "directory"
    directories = {}
    for obj in objects:
        key = obj.get('Key', '')
        parts = key.split('/')
        
        if len(parts) > 1 and parts[0]:
            top_dir = parts[0] + '/'
        else:
            top_dir = '[root]'
            
        if top_dir not in directories:
            directories[top_dir] = {
                'count': 0,
                'size': 0
            }
        
        directories[top_dir]['count'] += 1
        directories[top_dir]['size'] += obj.get('Size', 0)
    
    # Print directory summary
    dir_table = PrettyTable()
    dir_table.field_names = ["Directory", "Object Count", "Total Size"]
    dir_table.align["Directory"] = "l"
    dir_table.align["Object Count"] = "r"
    dir_table.align["Total Size"] = "r"
    
    for dir_name, stats in sorted(directories.items()):
        dir_table.add_row([
            dir_name, 
            stats['count'], 
            format_size(stats['size'])
        ])
    
    # Add a total row
    total_count = sum(dir_info['count'] for dir_info in directories.values())
    total_size = sum(dir_info['size'] for dir_info in directories.values())
    dir_table.add_row(["TOTAL", total_count, format_size(total_size)])
    
    print("\n===== R2 Bucket Directory Summary =====")
    print(dir_table)
    print("=======================================\n")
    
    # Sort objects by size (largest first)
    objects.sort(key=lambda x: x.get('Size', 0), reverse=True)
    
    # Create a table of the largest objects
    sample_count = min(25, len(objects))
    obj_table = PrettyTable()
    obj_table.field_names = ["Key", "Size", "Last Modified"]
    obj_table.align["Key"] = "l"
    obj_table.align["Size"] = "r"
    obj_table.align["Last Modified"] = "l"
    
    for obj in objects[:sample_count]:
        key = obj.get('Key', '')
        size = format_size(obj.get('Size', 0))
        last_modified = str(obj.get('LastModified', '')).split('.')[0]  # Remove microseconds
        obj_table.add_row([key, size, last_modified])
    
    print(f"\n===== {sample_count} Largest Objects =====")
    print(obj_table)
    print("=======================================\n")
    
    # Find the oldest objects
    objects.sort(key=lambda x: x.get('LastModified', ''))
    
    oldest_count = min(10, len(objects))
    oldest_table = PrettyTable()
    oldest_table.field_names = ["Key", "Size", "Last Modified"]
    oldest_table.align["Key"] = "l"
    oldest_table.align["Size"] = "r"
    oldest_table.align["Last Modified"] = "l"
    
    for obj in objects[:oldest_count]:
        key = obj.get('Key', '')
        size = format_size(obj.get('Size', 0))
        last_modified = str(obj.get('LastModified', '')).split('.')[0]  # Remove microseconds
        oldest_table.add_row([key, size, last_modified])
    
    print(f"\n===== {oldest_count} Oldest Objects =====")
    print(oldest_table)
    print("=======================================\n")

if __name__ == "__main__":
    main() 