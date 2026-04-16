"""
Online user tracking system using Redis
Tracks active sessions and provides real-time online user count
Also logs historical statistics to database
"""
import redis
import time
from datetime import datetime, timedelta

class OnlineTracker:
    def __init__(self, redis_host='localhost', redis_port=6379, redis_db=0):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.Redis(
                host=redis_host, 
                port=redis_port, 
                db=redis_db,
                decode_responses=True
            )
            self.redis_client.ping()
            self.use_redis = True
            print("✓ Redis connected for online tracking")
        except (redis.ConnectionError, redis.RedisError) as e:
            print(f"⚠ Redis not available, using in-memory fallback: {e}")
            self.use_redis = False
            self.memory_sessions = {}  # Fallback to in-memory dict
        
        self.session_timeout = 30  # seconds - consider user offline after 30s of inactivity
    
    def heartbeat(self, session_id: str):
        """
        Record a heartbeat from a user session
        This should be called periodically from the frontend
        """
        current_time = int(time.time())
        
        if self.use_redis:
            # Store session with expiration
            key = f"session:{session_id}"
            self.redis_client.setex(key, self.session_timeout, current_time)
        else:
            # Fallback: in-memory storage
            self.memory_sessions[session_id] = current_time
            # Clean up old sessions
            self._cleanup_memory_sessions()
    
    def get_online_count(self) -> int:
        """Get the current number of online users"""
        if self.use_redis:
            # Count all active session keys
            pattern = "session:*"
            keys = self.redis_client.keys(pattern)
            return len(keys)
        else:
            # Fallback: count in-memory sessions
            self._cleanup_memory_sessions()
            return len(self.memory_sessions)
    
    def _cleanup_memory_sessions(self):
        """Remove expired sessions from memory (fallback mode)"""
        current_time = int(time.time())
        expired = [
            sid for sid, last_seen in self.memory_sessions.items()
            if current_time - last_seen > self.session_timeout
        ]
        for sid in expired:
            del self.memory_sessions[sid]
    
    def get_stats(self) -> dict:
        """Get detailed statistics"""
        online_count = self.get_online_count()
        peak_today = self.get_peak_today()
        
        return {
            'online_count': online_count,
            'peak_today': peak_today,
            'timestamp': datetime.now().isoformat(),
            'using_redis': self.use_redis
        }
    
    def get_peak_today(self) -> int:
        """Get peak online count for today"""
        if self.use_redis:
            peak_key = f"peak:{datetime.now().strftime('%Y-%m-%d')}"
            peak = self.redis_client.get(peak_key)
            return int(peak) if peak else 0
        else:
            # Fallback: return current count as peak
            return self.get_online_count()
    
    def update_peak(self):
        """Update peak count if current count is higher"""
        current_count = self.get_online_count()
        
        if self.use_redis:
            today = datetime.now().strftime('%Y-%m-%d')
            peak_key = f"peak:{today}"
            
            # Get current peak
            current_peak = self.redis_client.get(peak_key)
            current_peak = int(current_peak) if current_peak else 0
            
            # Update if current is higher
            if current_count > current_peak:
                self.redis_client.setex(peak_key, 86400, current_count)  # Expire after 24 hours
    
    def log_stats_to_db(self):
        """Log current stats to database for historical tracking"""
        try:
            from database import SessionLocal, OnlineStats
            
            db = SessionLocal()
            try:
                online_count = self.get_online_count()
                peak_count = self.get_peak_today()
                
                # Update peak before logging
                self.update_peak()
                
                # Create new stats entry
                stats = OnlineStats(
                    online_count=online_count,
                    peak_count=max(peak_count, online_count)
                )
                db.add(stats)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            print(f"Warning: Failed to log stats to database: {e}")
    
    def get_history(self, hours: int = 24) -> list:
        """Get historical stats from database"""
        try:
            from database import SessionLocal, OnlineStats
            
            db = SessionLocal()
            try:
                since = datetime.utcnow() - timedelta(hours=hours)
                stats = db.query(OnlineStats).filter(
                    OnlineStats.timestamp >= since
                ).order_by(OnlineStats.timestamp.asc()).all()
                
                return [{
                    'timestamp': s.timestamp.isoformat(),
                    'online_count': s.online_count,
                    'peak_count': s.peak_count
                } for s in stats]
            finally:
                db.close()
        except Exception as e:
            print(f"Warning: Failed to get history: {e}")
            return []

# Global instance
tracker = OnlineTracker()
