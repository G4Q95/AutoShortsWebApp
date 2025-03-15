#!/usr/bin/env python3

key = "9d7d5a07297042b9b69d1b8680c3fa5f"

print(f"Key: {key}")
print(f"Key length: {len(key)} characters")

if len(key) != 32:
    print("ERROR: Key must be exactly 32 characters!")
else:
    print("SUCCESS: Key is exactly 32 characters! This should work with R2.") 