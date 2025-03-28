#!/usr/bin/env python3
print("Script starting - SHOULD BE VISIBLE")

import os
import ssl
import socket
from urllib.parse import urlparse
import re

# Try to get MongoDB URI from environment
mongo_uri = os.getenv("MONGODB_URI", "")
if not mongo_uri:
    print("MONGODB_URI not found in environment variables")
    # Hardcode URI for testing only (with password masked)
    mongo_uri = "mongodb+srv://goodgodgeorge:MASKED_PASSWORD@autoshortsdb.f7asv.mongodb.net/?retryWrites=true&w=majority&appName=autoshortsdb"
    print(f"Using hardcoded URI: {mongo_uri}")

# Extract hostname
if 'mongodb+srv://' in mongo_uri:
    match = re.search(r'mongodb\+srv:\/\/(?:[^:@]+(?::[^@]+)?@)?([^\/]+)', mongo_uri)
    if match:
        hostname = match.group(1)
        print(f"Extracted hostname: {hostname}")
        
        # Create likely shard hostnames
        base_parts = hostname.split('.')
        if len(base_parts) > 1:
            cluster_name = base_parts[0]
            domain = '.'.join(base_parts[1:])
            
            for i in range(3):
                shard = f"{cluster_name}-shard-00-0{i}.{domain}"
                print(f"\nTesting connection to {shard}:27017...")
                
                try:
                    # Create socket
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(10)
                    
                    # Wrap with SSL/TLS
                    context = ssl.create_default_context()
                    secure_sock = context.wrap_socket(sock, server_hostname=shard)
                    
                    # Try to connect
                    secure_sock.connect((shard, 27017))
                    print(f"✅ Successfully connected to {shard}:27017")
                    secure_sock.close()
                except socket.gaierror as e:
                    print(f"❌ DNS resolution failed for {shard}: {e}")
                except socket.timeout as e:
                    print(f"❌ Connection timed out to {shard}: {e}")
                except ssl.SSLError as e:
                    print(f"❌ SSL error when connecting to {shard}: {e}")
                except Exception as e:
                    print(f"❌ Error connecting to {shard}: {e}")
    else:
        print("Could not extract hostname from URI")
else:
    print("Not an SRV URI, can't parse correctly")

print("Script completed") 