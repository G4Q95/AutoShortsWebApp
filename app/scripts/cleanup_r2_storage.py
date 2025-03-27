import argparse
import os
import logging
from pathlib import Path
import sys
from typing import List, Dict, Any, Set, Optional
from prettytable import PrettyTable

# Add the parent directory to sys.path to allow imports from app
sys.path.append(str(Path(__file__).parent.parent.parent))

from app.services.storage import R2Storage
from app.database.database import get_mongodb_client
from app.core.config import Settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('r2_cleanup')

def check_environment():
    """Check if all required environment variables are set."""
    env_vars = {
        'MONGODB_URI': os.getenv('MONGODB_URI'),
        'OPENAI_API_KEY': os.getenv('OPENAI_API_KEY'),
        'ELEVENLABS_API_KEY': os.getenv('ELEVENLABS_API_KEY'),
        'ELEVENLABS_MODEL_ID': os.getenv('ELEVENLABS_MODEL_ID'),
        'ELEVENLABS_API_URL': os.getenv('ELEVENLABS_API_URL'),
        'CLOUDFLARE_R2_ENDPOINT': os.getenv('CLOUDFLARE_R2_ENDPOINT'),
        'CLOUDFLARE_R2_ACCESS_KEY_ID': os.getenv('CLOUDFLARE_R2_ACCESS_KEY_ID'),
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY': os.getenv('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
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

def get_active_project_ids() -> Set[str]:
    """Get IDs of all active projects from MongoDB."""
    try:
        mongodb_client = get_mongodb_client()
        db = mongodb_client[Settings().MONGODB_NAME]
        projects_collection = db['projects']
        
        # Find all active projects
        project_ids = {str(project['_id']) for project in projects_collection.find({}, {'_id': 1})}
        logger.info(f"Found {len(project_ids)} active projects in database")
        return project_ids
    except Exception as e:
        logger.error(f"Error fetching project IDs: {e}")
        return set()

def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0 or unit == 'TB':
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0

def get_bucket_objects(storage: R2Storage, prefix: str) -> List[Dict[str, Any]]:
    """Get list of all objects with given prefix from the bucket."""
    result = storage.list_directory(prefix)
    objects = result.get('objects', [])
    logger.info(f"Found {len(objects)} total objects in R2 storage")
    return objects

def identify_orphaned_files(objects: List[Dict[str, Any]], active_project_ids: Set[str], prefix: str) -> List[Dict[str, Any]]:
    """Identify orphaned files by comparing with active project IDs."""
    orphaned_files = []
    active_files = []
    
    # Skip project ID check if prefix doesn't start with 'projects/'
    if not prefix.startswith('projects/'):
        logger.info(f"Skipping project ID check for prefix: {prefix}")
        return []
    
    total_size = 0
    active_size = 0
    orphaned_size = 0
    
    for obj in objects:
        key = obj.get('Key', '')
        size = obj.get('Size', 0)
        total_size += size
        
        # Extract project ID from key (assuming format projects/{project_id}/...)
        parts = key.split('/')
        if len(parts) > 1:
            project_id = parts[1]  # Second element should be project ID
            if project_id not in active_project_ids:
                orphaned_files.append(obj)
                orphaned_size += size
            else:
                active_files.append(obj)
                active_size += size
        else:
            # If we can't extract a project ID, consider it active
            active_files.append(obj)
            active_size += size
    
    logger.info(f"Found {len(orphaned_files)} orphaned files and {len(active_files)} active files")
    logger.info(f"===== R2 Storage Summary =====")
    logger.info(f"Total objects: {len(objects)}")
    logger.info(f"Active files: {len(active_files)} ({format_size(active_size)})")
    logger.info(f"Orphaned files: {len(orphaned_files)} ({format_size(orphaned_size)})")
    
    return orphaned_files

def delete_orphaned_files(storage: R2Storage, orphaned_files: List[Dict[str, Any]], dry_run: bool = True) -> None:
    """Delete orphaned files from the bucket."""
    if not orphaned_files:
        logger.info("No orphaned files found. Storage is clean!")
        return
    
    total_size = sum(obj.get('Size', 0) for obj in orphaned_files)
    
    if dry_run:
        logger.info(f"DRY RUN: Would delete {len(orphaned_files)} orphaned files ({format_size(total_size)})")
        return
    
    # Group files by directory to use batch deletion
    directories = {}
    for obj in orphaned_files:
        key = obj.get('Key', '')
        directory = '/'.join(key.split('/')[:-1]) + '/'
        
        if directory not in directories:
            directories[directory] = []
        
        directories[directory].append(obj)
    
    logger.info(f"Grouped orphaned files into {len(directories)} directories for batch deletion")
    
    # Delete directories in batch
    for directory, files in directories.items():
        files_count = len(files)
        dir_size = sum(obj.get('Size', 0) for obj in files)
        
        logger.info(f"Deleting directory {directory} with {files_count} files ({format_size(dir_size)})")
        result = storage.delete_directory(directory)
        
        if result['deleted_count'] > 0:
            logger.info(f"Successfully deleted {result['deleted_count']} files ({format_size(result['bytes_freed'])})")
        
        if result['failed_count'] > 0:
            logger.error(f"Failed to delete {result['failed_count']} files")
            for i, error in enumerate(result['errors'][:5]):  # Show first 5 errors
                logger.error(f"Error {i+1}: {error}")
            
            if len(result['errors']) > 5:
                logger.error(f"... and {len(result['errors']) - 5} more errors")

def list_sample_objects(storage: R2Storage, limit: int = 50) -> None:
    """List a sample of objects in the bucket with their sizes."""
    result = storage.list_directory("")
    objects = result.get('objects', [])
    
    if not objects:
        logger.info("No objects found in the bucket")
        return
    
    # Create a pretty table
    table = PrettyTable()
    table.field_names = ["Key", "Size", "Last Modified"]
    table.align["Key"] = "l"
    table.align["Size"] = "r"
    table.align["Last Modified"] = "l"
    
    # Sort objects by size (largest first)
    objects.sort(key=lambda x: x.get('Size', 0), reverse=True)
    
    # Add rows to the table (limit to the specified number)
    sample = objects[:limit]
    for obj in sample:
        key = obj.get('Key', '')
        size = format_size(obj.get('Size', 0))
        last_modified = obj.get('LastModified', '').split('.')[0]  # Remove microseconds
        table.add_row([key, size, last_modified])
    
    print(f"\n===== Sample of {len(sample)} objects (sorted by size) =====")
    print(table)
    print(f"\nTotal objects in bucket: {len(objects)}")
    total_size = sum(obj.get('Size', 0) for obj in objects)
    print(f"Total size: {format_size(total_size)}")
    print("============================================\n")

def list_directories(storage):
    """List top-level directories in the bucket and their object counts."""
    result = storage.list_directory("")
    objects = result.get('objects', [])
    
    if not objects:
        print("No objects found in the bucket.")
        return
    
    # Count objects by top-level "directory"
    directories = {}
    for obj in objects:
        key = obj.get('Key', '')
        size = obj.get('Size', 0)
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
        directories[top_dir]['size'] += size
    
    # Print directory summary
    print("\n===== R2 Bucket Directory Summary =====")
    for dir_name, stats in sorted(directories.items()):
        print(f"{dir_name}: {stats['count']} objects, {format_size(stats['size'])}")
    
    # Add a total row
    total_count = sum(dir_info['count'] for dir_info in directories.values())
    total_size = sum(dir_info['size'] for dir_info in directories.values())
    print(f"TOTAL: {total_count} objects, {format_size(total_size)}")
    print("=======================================\n")

def main():
    parser = argparse.ArgumentParser(description='Clean up orphaned files in R2 storage')
    parser.add_argument('--prefix', type=str, help='Prefix to filter objects (default: projects/)')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (do not delete files)')
    parser.add_argument('--force', action='store_true', help='Force deletion without confirmation')
    parser.add_argument('--list-sample', action='store_true', help='List a sample of objects in the bucket')
    parser.add_argument('--sample-limit', type=int, default=50, help='Number of objects to show in the sample (default: 50)')
    parser.add_argument('--list-dirs', action='store_true', help='List top-level directories in the bucket')
    
    args = parser.parse_args()
    
    # Check environment variables
    check_environment()
    
    # Initialize storage client
    storage = R2Storage()
    
    # If list-sample flag is set, just list sample and exit
    if args.list_sample:
        list_sample_objects(storage, args.sample_limit)
        return
    
    # If list-dirs flag is set, just list directories and exit
    if args.list_dirs:
        list_directories(storage)
        return
    
    # For cleanup operations, prefix is required
    if args.prefix is None:
        parser.error("--prefix is required for cleanup operations")
    
    logger.info(f"Scanning R2 storage with prefix: {args.prefix}")
    
    # Get all active project IDs from database
    active_project_ids = get_active_project_ids()
    
    # Get all objects with prefix
    objects = get_bucket_objects(storage, args.prefix)
    
    # Identify orphaned files
    orphaned_files = identify_orphaned_files(objects, active_project_ids, args.prefix)
    
    # Delete orphaned files if any
    if orphaned_files:
        if args.force:
            delete_orphaned_files(storage, orphaned_files, dry_run=args.dry_run)
        else:
            count = len(orphaned_files)
            total_size = sum(obj.get('Size', 0) for obj in orphaned_files)
            
            logger.info(f"Found {count} orphaned files to delete ({format_size(total_size)})")
            logger.info("Use --force to delete these files")
            
            # List first 10 files
            if count > 0:
                logger.info("Sample of files to be deleted:")
                for i, obj in enumerate(orphaned_files[:10]):
                    logger.info(f"  {i+1}. {obj.get('Key', '')} ({format_size(obj.get('Size', 0))})")
                
                if count > 10:
                    logger.info(f"  ... and {count - 10} more files")
    else:
        logger.info("No orphaned files found to delete")

if __name__ == "__main__":
    main() 