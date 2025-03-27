import os
import logging
from app.services.storage import R2Storage

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('r2_listing')

def format_size(size_bytes):
    """Format bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0 or unit == 'TB':
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0

def main():
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
    print("\n===== R2 Bucket Directory Summary =====")
    for dir_name, stats in sorted(directories.items()):
        print(f"{dir_name}: {stats['count']} objects, {format_size(stats['size'])}")
    
    # Add a total row
    total_count = sum(dir_info['count'] for dir_info in directories.values())
    total_size = sum(dir_info['size'] for dir_info in directories.values())
    print(f"TOTAL: {total_count} objects, {format_size(total_size)}")
    print("=======================================\n")
    
    # Print a sample of the largest objects
    objects.sort(key=lambda x: x.get('Size', 0), reverse=True)
    sample_count = min(10, len(objects))
    
    print(f"\n===== {sample_count} Largest Objects =====")
    for i, obj in enumerate(objects[:sample_count]):
        key = obj.get('Key', '')
        size = format_size(obj.get('Size', 0))
        print(f"{i+1}. {key} - {size}")
    print("=======================================\n")

if __name__ == "__main__":
    main() 