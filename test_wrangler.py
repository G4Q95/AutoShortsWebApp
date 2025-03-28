def test_list_bucket(bucket_name):
    """Test listing objects in the R2 bucket."""
    try:
        logger.info(f"Testing access to bucket: {bucket_name}")
        
        # First, verify the bucket exists
        logger.info("Running command: wrangler r2 bucket list")
        result = subprocess.run(
            ["wrangler", "r2", "bucket", "list"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            stdout = result.stdout.strip()
            logger.info("----- Raw Wrangler Output Start -----")
            logger.info(stdout)
            logger.info("----- Raw Wrangler Output End -----")
            
            # Look for any bucket names in the output
            bucket_exists = False
            lines = stdout.split("\n")
            logger.info(f"Output has {len(lines)} lines")
            
            for i, line in enumerate(lines):
                logger.info(f"Line {i}: '{line}'")
                
                # Look for lines with "name:" that might contain the bucket name
                if "name:" in line:
                    parts = line.split("name:")
                    if len(parts) > 1:
                        found_bucket = parts[1].strip()
                        logger.info(f"Found bucket name: '{found_bucket}'")
                        if found_bucket == bucket_name:
                            bucket_exists = True
                            break
            
            if bucket_exists:
                logger.info(f"✅ Bucket '{bucket_name}' found in your account")
                return True
            else:
                logger.error(f"❌ Bucket '{bucket_name}' not found in your account")
                return False
        else:
            logger.error(f"❌ Error accessing bucket list: {result.stderr}")
            logger.error("Make sure you have authenticated with Cloudflare:")
            logger.error("  Run: wrangler login")
            return False
    except Exception as e:
        logger.error(f"❌ Unexpected error testing bucket access: {str(e)}")
        return False

def test_delete_nonexistent_object(bucket_name):
    """Test deleting a nonexistent object to verify permissions."""
    try:
        nonexistent_key = "test_wrangler_nonexistent_object_" + os.urandom(4).hex()
        logger.info(f"Testing deletion permissions with nonexistent object: {nonexistent_key}")
        
        # Define the object path (bucket + key)
        object_path = f"{bucket_name}/{nonexistent_key}"
        
        # In Wrangler 4.x, the object delete command takes a single path argument
        result = subprocess.run(
            ["wrangler", "r2", "object", "delete", object_path],
            capture_output=True,
            text=True,
            check=False
        )
        
        # Check if deletion succeeded or got expected error
        if result.returncode == 0:
            logger.warning("⚠️ Delete test succeeded unexpectedly - object shouldn't exist")
            return True
        elif "not found" in result.stderr.lower() or "not exist" in result.stderr.lower() or "no such key" in result.stderr.lower():
            logger.info("✅ Delete permission test successful - received expected 'not found' response")
            return True
        else:
            logger.error(f"❌ Error testing delete permissions: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"❌ Unexpected error testing delete permissions: {str(e)}")
        return False 