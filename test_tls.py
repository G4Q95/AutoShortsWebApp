#!/usr/bin/env python3

import os
import ssl
import socket
import re

# Print at start to verify script execution
print("SCRIPT EXECUTION STARTED")

# Hardcoded MongoDB URI with masked password for testing
mongo_uri = "mongodb+srv://goodgodgeorge:MASKED_PASSWORD@autoshortsdb.f7asv.mongodb.net/?retryWrites=true&w=majority&appName=autoshortsdb"
print(f"Using URI: {mongo_uri}")

# Extract hostname
hostname = None
if 'mongodb+srv://' in mongo_uri:
    match = re.search(r'mongodb\+srv:\/\/(?:[^:@]+(?::[^@]+)?@)?([^\/]+)', mongo_uri)
    if match:
        hostname = match.group(1)
        print(f"Extracted hostname: {hostname}")
    else:
        print("Could not extract hostname from URI")
else:
    print("Not an SRV URI")
    exit(1)

# Create shard hostnames
base_parts = hostname.split('.')
if len(base_parts) > 1:
    cluster_name = base_parts[0]
    domain = '.'.join(base_parts[1:])
    
    # Test connection to each shard
    for i in range(3):
        shard = f"{cluster_name}-shard-00-0{i}.{domain}"
        print(f"\nTesting direct TLS connection to {shard}:27017...")
        
        try:
            # Create socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            
            # Perform DNS lookup first to verify
            try:
                print(f"Resolving DNS for {shard}...")
                ip_addr = socket.gethostbyname(shard)
                print(f"Resolved to IP: {ip_addr}")
            except socket.gaierror as e:
                print(f"DNS resolution failed: {e}")
                continue
            
            # Wrap with SSL/TLS
            print("Setting up TLS context...")
            context = ssl.create_default_context()
            secure_sock = context.wrap_socket(sock, server_hostname=shard)
            
            # Try to connect
            print(f"Connecting to {shard}:27017...")
            secure_sock.connect((shard, 27017))
            print(f"✅ Successfully established TLS connection to {shard}:27017")
            secure_sock.close()
        except socket.gaierror as e:
            print(f"❌ DNS resolution failed: {e}")
        except socket.timeout as e:
            print(f"❌ Connection timed out: {e}")
        except ssl.SSLError as e:
            print(f"❌ SSL error: {e}")
        except Exception as e:
            print(f"❌ Error: {e}")

print("\nScript completed") 