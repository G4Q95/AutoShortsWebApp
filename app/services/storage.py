def delete_directory(self, prefix):
    """
    Delete all objects with the given prefix (directory).
    
    Args:
        prefix (str): The prefix (directory) to delete all objects from
        
    Returns:
        dict: A dictionary with the results of the deletion operation
            - deleted_count: The number of objects successfully deleted
            - failed_count: The number of objects that failed to delete
            - total_bytes: The total size of the deleted objects
            - errors: A list of errors encountered during deletion
    """
    objects = self.list_directory(prefix)
    logging.info(f"Found {len(objects)} objects to delete with prefix: {prefix}")
    
    if not objects:
        return {
            "deleted_count": 0,
            "failed_count": 0,
            "total_bytes": 0,
            "errors": []
        }
    
    # Prepare result object
    result = {
        "deleted_count": 0,
        "failed_count": 0,
        "total_bytes": 0,
        "errors": []
    }
    
    # Process in batches to reduce API calls (Class A operations)
    batch_size = 1000  # Maximum objects per delete request
    
    for i in range(0, len(objects), batch_size):
        batch = objects[i:i+batch_size]
        objects_to_delete = [{'Key': obj['Key']} for obj in batch]
        
        try:
            # Delete the batch of objects
            response = self.s3_client.delete_objects(
                Bucket=self.bucket_name,
                Delete={
                    'Objects': objects_to_delete,
                    'Quiet': True  # Reduces response size
                }
            )
            
            # Count deleted objects
            deleted = len(batch)
            if 'Errors' in response and response['Errors']:
                deleted = deleted - len(response['Errors'])
                for error in response['Errors']:
                    result['errors'].append(f"Error deleting {error['Key']}: {error['Code']} - {error['Message']}")
                    result['failed_count'] += 1
            
            result['deleted_count'] += deleted
            
            # Calculate size of deleted objects
            batch_size_bytes = sum(obj.get('Size', 0) for obj in batch)
            result['total_bytes'] += batch_size_bytes
            
            logging.info(f"Deleted batch of {deleted} objects ({batch_size_bytes/1024/1024:.2f} MB)")
            
        except Exception as e:
            # If batch deletion fails, add all objects to failed count
            result['failed_count'] += len(batch)
            error_msg = f"Error deleting batch: {str(e)}"
            result['errors'].append(error_msg)
            logging.error(error_msg)
    
    # Log the final results
    logging.info(f"Deletion completed: {result['deleted_count']} objects deleted, " 
                 f"{result['failed_count']} failed, "
                 f"{result['total_bytes']/1024/1024:.2f} MB freed")
    
    if result['errors']:
        error_sample = result['errors'][:5]  # Show first 5 errors
        if len(result['errors']) > 5:
            error_sample.append(f"... and {len(result['errors'])-5} more errors")
        for error in error_sample:
            logging.error(error)
    
    return result 