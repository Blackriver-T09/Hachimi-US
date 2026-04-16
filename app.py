from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from scraper import scrape_bilibili
from database import SessionLocal, Video
from online_tracker import tracker
import traceback
import os
import jwt
import datetime
from functools import wraps
import mutagen
import threading
import time as time_module
import subprocess

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
except ImportError:
    print("Warning: config.py not found. Using default credentials.")
    USERNAME = "admin"
    PASSWORD = "password"
    JWT_SECRET = "fallback-secret-key-change-me"

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
                'duration': duration
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

@app.route('/static/<folder>/<filename>')
def serve_static(folder, filename):
    if folder not in ['figures', 'music', 'videos', 'bullet']:
        return "Access denied", 403
    return send_from_directory(os.path.join(app.root_path, folder), filename)

@app.route('/api/scrape', methods=['POST'])
@token_required
def handle_scrape():
    data = request.json
    if not data or 'url' not in data:
        return jsonify({'success': False, 'error': 'No URL provided'}), 400
        
    url = data['url']
    try:
        result = scrape_bilibili(url)
        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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

if __name__ == '__main__':
    from database import init_db
    init_db()
    
    # Start stats logging thread
    logger_thread = threading.Thread(target=stats_logger_thread, daemon=True)
    logger_thread.start()
    print("✓ Stats logging thread started (every 5 minutes)")
    
    app.run(host='127.0.0.1', port=5000, debug=True)
