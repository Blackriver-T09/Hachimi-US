from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from scraper import scrape_bilibili
from database import SessionLocal, Video, ScrapeTask
from online_tracker import tracker
from scrape_queue import get_scrape_queue
import traceback
import os
import jwt
import datetime
from functools import wraps
import mutagen
import threading
import time as time_module
import subprocess
import logging

app = Flask(__name__)

# Configure CORS properly
CORS(app, 
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Max-Age'] = '3600'
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    return response

# Load config
try:
    import config
    USERNAME = config.USERNAME
    PASSWORD = config.PASSWORD
    JWT_SECRET = config.API_KEY
    START_INDEX = getattr(config, 'START_INDEX', None)
except ImportError:
    print("Warning: config.py not found. Using default credentials.")
    USERNAME = "admin"
    PASSWORD = "password"
    JWT_SECRET = "fallback-secret-key-change-me"
    START_INDEX = None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'success': False, 'error': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except Exception:
            return jsonify({'success': False, 'error': 'Token is invalid!'}), 401

        return f(*args, **kwargs)
    return decorated

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'success': False, 'error': 'Missing credentials'}), 400

    if data['username'] == USERNAME and data['password'] == PASSWORD:
        token = jwt.encode({
            'user': data['username'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm="HS256")
        
        return jsonify({'success': True, 'token': token})
    
    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get public configuration"""
    return jsonify({
        'success': True,
        'start_index': START_INDEX
    })

@app.route('/api/videos', methods=['GET'])
def get_videos():
    db = SessionLocal()
    try:
        videos = db.query(Video).order_by(Video.id.desc()).all()
        video_list = []
        for v in videos:
            # Try to get duration from audio file using ffprobe
            duration = None
            try:
                audio_path = os.path.join(app.root_path, 'music', f'{v.id}.mp3')
                if os.path.exists(audio_path):
                    # Use ffprobe to get duration (works with all formats)
                    result = subprocess.run(
                        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                         '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        duration = int(float(result.stdout.strip()))
            except Exception as e:
                # Silently ignore - duration will remain None
                pass
            
            video_list.append({
                'id': v.id,
                'title': v.title,
                'source_url': v.source_url,
                'created_at': v.created_at.isoformat(),
                'duration': duration,
                'likes': v.likes
            })
        return jsonify({'success': True, 'data': video_list})
    finally:
        db.close()

@app.route('/api/videos/<int:video_id>', methods=['PUT'])
@token_required
def update_video(video_id):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return jsonify({'success': False, 'error': 'Video not found'}), 404
        
        data = request.json
        if 'title' in data:
            video.title = data['title']
            db.commit()
        
        return jsonify({'success': True})
    finally:
        db.close()

@app.route('/api/videos/<int:video_id>/like', methods=['POST'])
def like_video(video_id):
    """Like a video (increment likes count)"""
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return jsonify({'success': False, 'error': 'Video not found'}), 404
        
        video.likes += 1
        db.commit()
        
        return jsonify({'success': True, 'likes': video.likes})
    finally:
        db.close()

@app.route('/api/videos/<int:video_id>/unlike', methods=['POST'])
def unlike_video(video_id):
    """Unlike a video (decrement likes count, minimum 0)"""
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return jsonify({'success': False, 'error': 'Video not found'}), 404
        
        video.likes = max(0, video.likes - 1)
        db.commit()
        
        return jsonify({'success': True, 'likes': video.likes})
    finally:
        db.close()

@app.route('/api/videos/<int:video_id>', methods=['DELETE'])
@token_required
def delete_video(video_id):
    """Delete a video and all associated files"""
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            return jsonify({'success': False, 'error': 'Video not found'}), 404
        
        # Delete associated files
        files_to_delete = [
            os.path.join(app.root_path, 'music', f'{video_id}.mp3'),
            os.path.join(app.root_path, 'figures', f'{video_id}.jpg'),
            os.path.join(app.root_path, 'videos', f'{video_id}.mp4'),
            os.path.join(app.root_path, 'bullet', f'{video_id}.xml'),
        ]
        
        deleted_files = []
        for file_path in files_to_delete:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    deleted_files.append(os.path.basename(file_path))
                except Exception as e:
                    print(f"Warning: Failed to delete {file_path}: {e}")
        
        # Delete from database
        db.delete(video)
        db.commit()
        
        return jsonify({
            'success': True,
            'message': f'Video {video_id} deleted',
            'deleted_files': deleted_files
        })
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/stats/online', methods=['GET'])
def get_online_users():
    """Get current online user count with peak"""
    stats = tracker.get_stats()
    return jsonify({
        'success': True, 
        'count': stats['online_count'],
        'peak_today': stats['peak_today']
    })

@app.route('/api/stats/history', methods=['GET'])
def get_stats_history():
    """Get historical online user stats"""
    hours = request.args.get('hours', 24, type=int)
    history = tracker.get_history(hours=hours)
    return jsonify({'success': True, 'data': history})

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    """Record a heartbeat from a user session"""
    data = request.json
    session_id = data.get('session_id')
    
    if not session_id:
        return jsonify({'success': False, 'error': 'No session_id provided'}), 400
    
    tracker.heartbeat(session_id)
    tracker.update_peak()  # Update peak count
    return jsonify({'success': True})

@app.route('/api/offline', methods=['POST'])
def offline():
    """Mark a user session as offline"""
    # Handle both JSON and sendBeacon (text/plain) formats
    try:
        if request.is_json:
            data = request.json
        else:
            # sendBeacon sends as text/plain
            import json
            data = json.loads(request.data.decode('utf-8'))
        
        session_id = data.get('session_id')
        
        if not session_id:
            return jsonify({'success': False, 'error': 'No session_id provided'}), 400
        
        tracker.remove_session(session_id)
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error in offline endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/static/<folder>/<filename>')
def serve_static(folder, filename):
    if folder not in ['figures', 'music', 'videos', 'bullet']:
        return "Access denied", 403
    return send_from_directory(os.path.join(app.root_path, folder), filename)

@app.route('/api/scrape', methods=['POST'])
@token_required
def handle_scrape():
    """Add URL to scrape queue instead of immediate scraping"""
    data = request.json
    if not data or 'url' not in data:
        return jsonify({'success': False, 'error': 'No URL provided'}), 400
        
    url = data['url']
    max_retries = data.get('max_retries', 3)
    
    # Add to queue
    queue = get_scrape_queue()
    result = queue.add_task(url, max_retries=max_retries)
    
    if result['success']:
        return jsonify(result), 200
    else:
        return jsonify(result), 409 if 'already exists' in result['message'] else 400

@app.route('/api/scrape/queue/stats', methods=['GET'])
@token_required
def get_queue_stats():
    """Get scrape queue statistics"""
    queue = get_scrape_queue()
    stats = queue.get_queue_stats()
    return jsonify({'success': True, 'stats': stats})

@app.route('/api/scrape/queue/tasks', methods=['GET'])
@token_required
def get_queue_tasks():
    """Get all tasks in queue"""
    status = request.args.get('status')
    limit = request.args.get('limit', 50, type=int)
    
    queue = get_scrape_queue()
    tasks = queue.get_all_tasks(status=status, limit=limit)
    
    return jsonify({'success': True, 'tasks': tasks})

@app.route('/api/scrape/queue/task/<int:task_id>', methods=['GET'])
@token_required
def get_task_detail(task_id):
    """Get specific task details"""
    db = SessionLocal()
    try:
        task = db.query(ScrapeTask).filter_by(id=task_id).first()
        if not task:
            return jsonify({'success': False, 'error': 'Task not found'}), 404
        
        return jsonify({
            'success': True,
            'task': {
                'id': task.id,
                'url': task.url,
                'status': task.status,
                'retry_count': task.retry_count,
                'max_retries': task.max_retries,
                'error_message': task.error_message,
                'created_at': task.created_at.isoformat() if task.created_at else None,
                'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                'next_retry_at': task.next_retry_at.isoformat() if task.next_retry_at else None,
                'video_id': task.video_id
            }
        })
    finally:
        db.close()

def stats_logger_thread():
    """Background thread to log stats every 5 minutes"""
    while True:
        try:
            tracker.log_stats_to_db()
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Stats logged: {tracker.get_online_count()} online, peak: {tracker.get_peak_today()}")
        except Exception as e:
            print(f"Error logging stats: {e}")
        
        # Wait 5 minutes
        time_module.sleep(300)

def scrape_queue_thread():
    """Background thread for scrape queue processing"""
    queue = get_scrape_queue(
        check_interval=10,    # Check every 10 seconds
        base_wait_time=60     # Base wait time: 60 seconds
    )
    queue.run_background_loop()

if __name__ == '__main__':
    from database import init_db
    init_db()
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Start stats logging thread
    logger_thread = threading.Thread(target=stats_logger_thread, daemon=True)
    logger_thread.start()
    print("✓ Stats logging thread started (every 5 minutes)")
    
    # Start scrape queue thread
    queue_thread = threading.Thread(target=scrape_queue_thread, daemon=True)
    queue_thread.start()
    print("✓ Scrape queue thread started (checks every 10 seconds)")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
