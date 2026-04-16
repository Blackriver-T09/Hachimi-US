from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from scraper import scrape_bilibili
from database import SessionLocal, Video
import traceback
import os
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)  # Enable CORS for all routes

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    # Add cross-origin headers for media
    response.headers.add('Cross-Origin-Resource-Policy', 'cross-origin')
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
        video_list = [{
            'id': v.id,
            'title': v.title,
            'source_url': v.source_url,
            'created_at': v.created_at.isoformat()
        } for v in videos]
        return jsonify({'success': True, 'data': video_list})
    finally:
        db.close()

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

if __name__ == '__main__':
    from database import init_db
    init_db()
    app.run(host='127.0.0.1', port=5000, debug=True)
