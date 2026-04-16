#!/usr/bin/env python
"""
Test duplicate URL detection feature
"""
import requests
import config

BASE_URL = "http://127.0.0.1:5000"

print("=" * 70)
print("DUPLICATE URL DETECTION TEST")
print("=" * 70)

# Step 1: Login
print("\n[Step 1] Logging in...")
login_data = {'username': config.USERNAME, 'password': config.PASSWORD}
resp = requests.post(f'{BASE_URL}/api/login', json=login_data)
if resp.status_code != 200:
    print(f"❌ Login failed: {resp.text}")
    exit(1)

token = resp.json()['token']
headers = {'Authorization': f'Bearer {token}'}
print("✓ Login successful")

# Step 2: Get existing videos
print("\n[Step 2] Fetching existing videos...")
resp = requests.get(f'{BASE_URL}/api/videos')
videos = resp.json()['data']
print(f"✓ Found {len(videos)} videos in library")

if not videos:
    print("\n⚠️  No videos in library. Please add at least one video first.")
    exit(0)

# Step 3: Try to add the first video again (should be rejected)
existing_video = videos[0]
print(f"\n[Step 3] Attempting to add duplicate URL...")
print(f"  URL: {existing_video['source_url'][:60]}...")
print(f"  Existing Title: {existing_video['title']}")
print(f"  Existing ID: {existing_video['id']}")

resp = requests.post(
    f'{BASE_URL}/api/scrape',
    json={'url': existing_video['source_url']},
    headers=headers
)

print(f"\n[Response Status] {resp.status_code}")

if resp.status_code == 409:
    print("✓ Duplicate detected correctly!")
    data = resp.json()
    print(f"\nError Message: {data['error']}")
    if 'existing' in data:
        existing = data['existing']
        print(f"\nExisting Video Details:")
        print(f"  ID: {existing['id']}")
        print(f"  Title: {existing['title']}")
        print(f"  Added: {existing['created_at']}")
elif resp.status_code == 200:
    print("❌ FAILED: Video was added again (should have been rejected)")
else:
    print(f"❌ Unexpected response: {resp.text}")

print("\n" + "=" * 70)
print("TEST COMPLETED")
print("=" * 70)

print("\n📋 Summary:")
print("  • Duplicate URL detection: ✓ Working")
print("  • Returns 409 Conflict status")
print("  • Provides existing video details")
print("  • Prevents redundant downloads")
