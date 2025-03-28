#!/usr/bin/env python3
"""
Test direct TLS connection to MongoDB Atlas
This script bypasses MongoDB drivers to directly test if we can establish a TLS connection
to MongoDB Atlas servers.
"""

print("SCRIPT EXECUTION STARTED - THIS SHOULD BE VISIBLE")
assert False, "Intentional assertion failure to check if script is running"

import os
import ssl
import socket
import dotenv
from urllib.parse import urlparse
import re

# Load environment variables
print("Loading .env file...")
dotenv_loaded = dotenv.load_dotenv()
print(f"Dotenv loaded: {dotenv_loaded}")

def extract_hostname_from_uri(uri):
    """Extract the hostname from a MongoDB URI"""
    # For SRV records
    if 'mongodb+srv://' in uri:
        match = re.search(r'mongodb\+srv:\/\/(?:[^:@]+(?::[^@]+)?@)?([^\/]+)', uri)
        if match:
            return match.group(1)
    # For standard MongoDB URIs
    else:
        match = re.search(r'mongodb:\/\/(?:[^:@]+(?::[^@]+)?@)?([^:,\/]+)(?::\d+)?', uri)
        if match:
            return match.group(1)
    return None

def test_tls_connection():
    """Test a direct TLS connection to MongoDB Atlas"""
    print("Starting TLS connection test")
    
    # List available environment variables
    print("Environment variables:")
    for key in os.environ:
        if "MONGO" in key.upper():
            value = os.environ[key]
            # Mask password in URI
            if "URI" in key.upper() and "://" in value:
                parts = value.split("@")
                if len(parts) > 1:
                    auth_part = parts[0].split("://")
                    if len(auth_part) > 1:
                        masked_uri = f"{auth_part[0]}://****@{parts[1]}"
                        print(f"  {key}: {masked_uri}")
                    else:
                        print(f"  {key}: {value}")
                else:
                    print(f"  {key}: {value}")
            else:
                print(f"  {key}: {value}")
    
    uri = os.getenv("MONGODB_URI", "")
    if not uri:
        print("Error: MONGODB_URI environment variable not set")
        # Try to look for a .env file
        env_files = [".env", "../.env", "../../.env"]
        for env_file in env_files:
            if os.path.exists(env_file):
                print(f"Found .env file at {env_file}, trying to load it...")
                dotenv.load_dotenv(env_file)
                uri = os.getenv("MONGODB_URI", "")
                if uri:
                    print(f"Successfully loaded MONGODB_URI from {env_file}")
                    break
                else:
                    print(f"Could not find MONGODB_URI in {env_file}")
        
        # If we still don't have a URI, check for other possible environment variable names
        if not uri:
            for key in ["MONGO_URI", "MONGODB_URL", "MONGO_URL"]:
                uri = os.getenv(key, "")
                if uri:
                    print(f"Found MongoDB URI in {key} environment variable")
                    break
        
        # As a last resort, ask the user
        if not uri:
            print("Could not find MongoDB URI in any environment variable.")
            print("Please enter your MongoDB URI manually:")
            uri = input("> ")
    
    if not uri:
        print("Error: No MongoDB URI provided. Cannot proceed with the test.")
        return False
    
    # Mask password in URI for logging
    masked_uri = uri
    if "@" in uri:
        prefix, suffix = uri.split("@", 1)
        if "://" in prefix:
            protocol, auth = prefix.split("://", 1)
            if ":" in auth:
                username = auth.split(":", 1)[0]
                masked_uri = f"{protocol}://{username}:****@{suffix}"
    
    print(f"\nTesting TLS connection with URI: {masked_uri}")
    
    # Extract the hostname from the URI
    hostname = extract_hostname_from_uri(uri)
    
    if not hostname:
        print("Error: Could not extract hostname from URI")
        print(f"URI format may be invalid: {masked_uri}")
        return False
    
    print(f"Extracted hostname: {hostname}")
    
    # For SRV records, we need to check the individual shard servers
    if "mongodb+srv" in uri:
        print(f"This is an SRV URI. Trying to connect to likely shard hosts...")
        # Create likely shard hostnames
        shards = []
        base_parts = hostname.split('.')
        if len(base_parts) > 1:
            cluster_name = base_parts[0]
            domain = '.'.join(base_parts[1:])
            for i in range(3):
                shards.append(f"{cluster_name}-shard-00-0{i}.{domain}")
        
        if not shards:
            print("Could not construct shard hostnames")
            return False
        
        success = False    
        for i, shard in enumerate(shards):
            try:
                print(f"\nTesting shard {i}: {shard}")
                # Create socket
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(10)
                
                # Wrap with SSL/TLS
                print(f"Setting up SSL/TLS context...")
                context = ssl.create_default_context()
                secure_sock = context.wrap_socket(sock, server_hostname=shard)
                
                # Try to connect
                print(f"Connecting to {shard}:27017...")
                secure_sock.connect((shard, 27017))
                
                print(f"✅ Successfully established TLS connection to {shard}:27017")
                peer_cert = secure_sock.getpeercert()
                print(f"Server certificate: {peer_cert}")
                secure_sock.close()
                success = True
            except socket.gaierror as e:
                print(f"❌ DNS resolution failed for {shard}: {e}")
            except socket.timeout as e:
                print(f"❌ Connection timed out to {shard}: {e}")
            except ssl.SSLError as e:
                print(f"❌ SSL error when connecting to {shard}: {e}")
            except Exception as e:
                print(f"❌ Error connecting to {shard}: {e}")
        
        return success
    else:
        # Regular MongoDB URI (not SRV)
        try:
            parsed_uri = urlparse(uri)
            port = parsed_uri.port or 27017
            print(f"Connecting to {hostname}:{port}...")
            
            # Create socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            
            # Wrap with SSL/TLS
            print(f"Setting up SSL/TLS context...")
            context = ssl.create_default_context()
            secure_sock = context.wrap_socket(sock, server_hostname=hostname)
            
            # Try to connect
            print(f"Attempting connection...")
            secure_sock.connect((hostname, port))
            
            print(f"✅ Successfully established TLS connection to {hostname}:{port}")
            peer_cert = secure_sock.getpeercert()
            print(f"Server certificate: {peer_cert}")
            secure_sock.close()
            return True
        except socket.gaierror as e:
            print(f"❌ DNS resolution failed for {hostname}: {e}")
        except socket.timeout as e:
            print(f"❌ Connection timed out to {hostname}: {e}")
        except ssl.SSLError as e:
            print(f"❌ SSL error when connecting to {hostname}: {e}")
        except Exception as e:
            print(f"❌ Error connecting to {hostname}: {e}")
    
    return False

def main():
    print("=== MongoDB TLS Connection Test ===")
    success = test_tls_connection()
    print("\n=== Test Summary ===")
    if success:
        print("✅ TLS connection test passed successfully")
    else:
        print("❌ TLS connection test failed")
        print("\nPossible issues:")
        print("1. Network connectivity problems")
        print("2. Firewall or proxy blocking the connection")
        print("3. TLS/SSL configuration incompatibility")
        print("4. MongoDB Atlas IP allowlist restrictions")
        print("\nSuggested actions:")
        print("1. Check if your IP is allowed in MongoDB Atlas")
        print("2. Try connecting from a different network")
        print("3. Check if the MongoDB Atlas cluster is running")
        print("4. Verify the MongoDB URI is correct")

if __name__ == "__main__":
    print("Script starting...")
    main()
    print("Script completed.") 