#!/usr/bin/env python3

key = "9d7c5d8729760b9b69d1b860bc3fc5f"

print(f"Key: {key}")
print(f"Key length: {len(key)} characters")

if len(key) != 32:
    print("ERROR: Key must be exactly 32 characters!")
    
# Check if there are any hidden characters
import sys
print("\nChecking for hidden characters:")
for i, c in enumerate(key):
    print(f"Position {i}: '{c}' (ASCII: {ord(c)})")

print("\nTesting other known valid S3 key lengths:")
test_keys = [
    "AKIAIOSFODNN7EXAMPLE",  # 20 characters
    "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"  # 40 characters
]

for test_key in test_keys:
    print(f"Test key length: {len(test_key)} characters") 