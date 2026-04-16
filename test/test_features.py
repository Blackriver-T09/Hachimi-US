#!/usr/bin/env python
"""
Test script for online tracking and duration reading
"""
import os
import time
from online_tracker import tracker

print("=" * 60)
print("Testing Online User Tracking")
print("=" * 60)

# Test 1: Initial state
print(f"\n1. Initial online count: {tracker.get_online_count()}")

# Test 2: Add some sessions
print("\n2. Adding 3 user sessions...")
tracker.heartbeat("user_1")
tracker.heartbeat("user_2")
tracker.heartbeat("user_3")
print(f"   Online count: {tracker.get_online_count()}")

# Test 3: Update existing session
print("\n3. Updating user_1 session...")
time.sleep(1)
tracker.heartbeat("user_1")
print(f"   Online count: {tracker.get_online_count()}")

# Test 4: Wait for timeout
print(f"\n4. Waiting {tracker.session_timeout + 2} seconds for sessions to expire...")
time.sleep(tracker.session_timeout + 2)
print(f"   Online count after timeout: {tracker.get_online_count()}")

# Test 5: Add new session
print("\n5. Adding new session after timeout...")
tracker.heartbeat("user_4")
print(f"   Online count: {tracker.get_online_count()}")

print("\n" + "=" * 60)
print("Testing Duration Reading")
print("=" * 60)

# Test duration reading
music_dir = os.path.join(os.path.dirname(__file__), 'music')
if os.path.exists(music_dir):
    mp3_files = [f for f in os.listdir(music_dir) if f.endswith('.mp3')]
    print(f"\nFound {len(mp3_files)} MP3 files in {music_dir}")
    
    if mp3_files:
        import mutagen
        for mp3_file in mp3_files[:3]:  # Test first 3 files
            filepath = os.path.join(music_dir, mp3_file)
            try:
                audio = mutagen.File(filepath)
                if audio and hasattr(audio.info, 'length'):
                    duration = int(audio.info.length)
                    mins = duration // 60
                    secs = duration % 60
                    print(f"  {mp3_file}: {mins}:{secs:02d} ({duration}s)")
                else:
                    print(f"  {mp3_file}: Could not read duration")
            except Exception as e:
                print(f"  {mp3_file}: Error - {e}")
    else:
        print("  No MP3 files found")
else:
    print(f"\nMusic directory not found: {music_dir}")

print("\n" + "=" * 60)
print("All tests completed!")
print("=" * 60)
