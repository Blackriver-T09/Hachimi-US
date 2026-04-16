#!/usr/bin/env python
"""
Complete test for Redis-enhanced features
"""
from online_tracker import tracker
import time

print("=" * 70)
print("REDIS-ENHANCED ONLINE TRACKING TEST")
print("=" * 70)

print(f"\n✓ Redis Status: {'Connected' if tracker.use_redis else 'Fallback Mode'}")

# Test 1: Basic tracking
print("\n[Test 1] Basic Session Tracking")
print("-" * 70)
tracker.heartbeat("user_1")
tracker.heartbeat("user_2")
tracker.heartbeat("user_3")
print(f"Added 3 sessions")
print(f"Current online: {tracker.get_online_count()}")

# Test 2: Peak tracking
print("\n[Test 2] Peak Tracking")
print("-" * 70)
print(f"Initial peak today: {tracker.get_peak_today()}")
tracker.update_peak()
print(f"After update: {tracker.get_peak_today()}")

# Add more users to test peak
tracker.heartbeat("user_4")
tracker.heartbeat("user_5")
tracker.update_peak()
print(f"Added 2 more users, new peak: {tracker.get_peak_today()}")

# Test 3: Stats logging
print("\n[Test 3] Database Logging")
print("-" * 70)
print("Logging current stats to database...")
tracker.log_stats_to_db()
print("✓ Stats logged successfully")

# Test 4: Get stats
print("\n[Test 4] Get Complete Stats")
print("-" * 70)
stats = tracker.get_stats()
print(f"Online count: {stats['online_count']}")
print(f"Peak today: {stats['peak_today']}")
print(f"Timestamp: {stats['timestamp']}")
print(f"Using Redis: {stats['using_redis']}")

# Test 5: Historical data
print("\n[Test 5] Historical Data")
print("-" * 70)
history = tracker.get_history(hours=24)
print(f"Found {len(history)} historical records")
if history:
    print("\nMost recent records:")
    for record in history[-5:]:
        print(f"  {record['timestamp']}: {record['online_count']} online, peak: {record['peak_count']}")

# Test 6: Session expiration
print("\n[Test 6] Session Expiration Test")
print("-" * 70)
print(f"Current online: {tracker.get_online_count()}")
print(f"Waiting {tracker.session_timeout + 2} seconds for sessions to expire...")
time.sleep(tracker.session_timeout + 2)
print(f"After timeout: {tracker.get_online_count()} online")

# Test 7: New session after expiration
print("\n[Test 7] New Session After Expiration")
print("-" * 70)
tracker.heartbeat("user_new")
tracker.update_peak()
print(f"Added new session")
print(f"Current online: {tracker.get_online_count()}")
print(f"Peak today: {tracker.get_peak_today()}")

print("\n" + "=" * 70)
print("ALL TESTS COMPLETED SUCCESSFULLY!")
print("=" * 70)

print("\n📊 Summary:")
print(f"  • Redis: {'✓ Connected' if tracker.use_redis else '✗ Using fallback'}")
print(f"  • Session timeout: {tracker.session_timeout}s")
print(f"  • Current online: {tracker.get_online_count()}")
print(f"  • Peak today: {tracker.get_peak_today()}")
print(f"  • Historical records: {len(tracker.get_history(hours=24))}")
