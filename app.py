from flask import Flask, request, jsonify, render_template_string, send_from_directory
from scraper import scrape_bilibili
from database import SessionLocal, Video
import traceback
import os

app = Flask(__name__)

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hachimi Music Scraper</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen p-4">
    <nav class="bg-white shadow mb-8 rounded-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex">
                    <div class="flex-shrink-0 flex items-center">
                        <span class="font-bold text-xl text-blue-600">Hachimi</span>
                    </div>
                    <div class="ml-6 flex space-x-8">
                        <a href="/" class="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Scraper
                        </a>
                        <a href="/player" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Music Player
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <div class="flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
            <h1 class="text-3xl font-bold text-center text-blue-600 mb-6">Bilibili Scraper</h1>
            
            <div class="mb-6">
                <label for="url" class="block text-sm font-medium text-gray-700 mb-2">Bilibili Video URL</label>
                <div class="flex gap-2">
                    <input type="text" id="url" 
                        class="flex-1 p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://www.bilibili.com/video/BV..."
                        value="https://www.bilibili.com/video/BV12wNqz5Etw/?spm_id_from=333.1387.favlist.content.click&vd_source=e59e065fb52ab5a6c6accaf0d793c23b">
                    <button id="scrapeBtn" onclick="startScraping()" 
                        class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition duration-200 font-medium whitespace-nowrap">
                        Start Scraping
                    </button>
                </div>
            </div>

            <div id="loading" class="hidden flex items-center justify-center space-x-3 my-8 text-gray-600">
                <div class="loader"></div>
                <span>Processing... This might take a while depending on video length.</span>
            </div>

            <div id="result" class="hidden">
                <div id="success-msg" class="hidden bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
                    <p class="font-bold">Success!</p>
                    <p>Files downloaded successfully.</p>
                </div>
                <div id="error-msg" class="hidden bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
                    <p class="font-bold">Error!</p>
                    <p id="error-text">Something went wrong.</p>
                </div>

                <div id="details" class="hidden">
                    <h3 class="text-xl font-semibold mb-3" id="video-title">Video Title</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-gray-50 p-4 rounded border">
                            <h4 class="font-bold text-gray-700 mb-1">Cover</h4>
                            <p class="text-sm text-gray-600 break-all" id="path-figure">-</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded border">
                            <h4 class="font-bold text-gray-700 mb-1">Video</h4>
                            <p class="text-sm text-gray-600 break-all" id="path-video">-</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded border">
                            <h4 class="font-bold text-gray-700 mb-1">Audio</h4>
                            <p class="text-sm text-gray-600 break-all" id="path-music">-</p>
                        </div>
                        <div class="bg-gray-50 p-4 rounded border">
                            <h4 class="font-bold text-gray-700 mb-1">Danmaku</h4>
                            <p class="text-sm text-gray-600 break-all" id="path-bullet">-</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function startScraping() {
            const urlInput = document.getElementById('url');
            const btn = document.getElementById('scrapeBtn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            const successMsg = document.getElementById('success-msg');
            const errorMsg = document.getElementById('error-msg');
            const details = document.getElementById('details');
            
            if (!urlInput.value.trim()) {
                alert('Please enter a valid URL');
                return;
            }

            // UI state: loading
            urlInput.disabled = true;
            btn.disabled = true;
            btn.classList.add('opacity-50');
            loading.classList.remove('hidden');
            result.classList.remove('hidden');
            successMsg.classList.add('hidden');
            errorMsg.classList.add('hidden');
            details.classList.add('hidden');

            try {
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: urlInput.value.trim() })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    successMsg.classList.remove('hidden');
                    details.classList.remove('hidden');
                    
                    document.getElementById('video-title').textContent = data.data.title + ' (ID: ' + data.data.id + ')';
                    document.getElementById('path-figure').textContent = data.data.figure || 'Not found';
                    document.getElementById('path-video').textContent = data.data.video || 'Not found';
                    document.getElementById('path-music').textContent = data.data.music || 'Not found';
                    document.getElementById('path-bullet').textContent = data.data.bullet || 'Not found';
                } else {
                    throw new Error(data.error || 'Unknown error occurred');
                }
            } catch (err) {
                errorMsg.classList.remove('hidden');
                document.getElementById('error-text').textContent = err.message;
            } finally {
                // UI state: reset
                urlInput.disabled = false;
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                loading.classList.add('hidden');
            }
        }
    </script>
</body>
</html>
"""

PLAYER_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hachimi Music Player</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen p-4">
    <nav class="bg-white shadow mb-8 rounded-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex">
                    <div class="flex-shrink-0 flex items-center">
                        <span class="font-bold text-xl text-blue-600">Hachimi</span>
                    </div>
                    <div class="ml-6 flex space-x-8">
                        <a href="/" class="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Scraper
                        </a>
                        <a href="/player" class="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                            Music Player
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-900 mb-8">Music Library</h1>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {% for video in videos %}
            <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-300">
                <div class="aspect-w-16 aspect-h-9 w-full overflow-hidden bg-gray-200">
                    <img src="/static/figures/{{ video.id }}.jpg" alt="{{ video.title }}" 
                         class="w-full h-48 object-cover cursor-pointer"
                         onclick="playMusic('{{ video.id }}', '{{ video.title|replace(\"'\", \"\\\\'\") }}', '/static/figures/{{ video.id }}.jpg')"
                         onerror="this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%25%22%20height%3D%22100%25%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20fill%3D%22%23eee%22%20width%3D%22100%25%22%20height%3D%22100%25%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20dy%3D%2210.5%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3ENo%20Cover%3C%2Ftext%3E%3C%2Fsvg%3E'">
                </div>
                <div class="p-4">
                    <h3 class="text-lg font-semibold text-gray-900 truncate" title="{{ video.title }}">{{ video.title }}</h3>
                    <p class="text-sm text-gray-500 mt-1">ID: {{ video.id }}</p>
                    <a href="{{ video.source_url }}" target="_blank" class="text-xs text-blue-500 hover:underline mt-2 inline-block">Source URL</a>
                </div>
            </div>
            {% endfor %}
            
            {% if not videos %}
            <div class="col-span-full text-center py-12 text-gray-500">
                <p class="text-xl mb-4">No music found.</p>
                <a href="/" class="text-blue-500 hover:underline">Go to scraper to add some music</a>
            </div>
            {% endif %}
        </div>
    </div>

    <!-- Fixed Bottom Player -->
    <div id="player-container" class="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-gray-200 transform translate-y-full transition-transform duration-300 z-50">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <img id="current-cover" src="" class="w-16 h-16 object-cover rounded shadow-sm">
            <div class="flex-1 min-w-0">
                <p id="current-title" class="font-bold text-gray-900 truncate">Select a song</p>
            </div>
            <audio id="audio-player" controls class="w-full max-w-md">
                Your browser does not support the audio element.
            </audio>
            <button onclick="closePlayer()" class="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    </div>

    <script>
        function playMusic(id, title, coverUrl) {
            const playerContainer = document.getElementById('player-container');
            const audioPlayer = document.getElementById('audio-player');
            const currentTitle = document.getElementById('current-title');
            const currentCover = document.getElementById('current-cover');

            currentTitle.textContent = title;
            currentCover.src = coverUrl;
            
            // Show player
            playerContainer.classList.remove('translate-y-full');
            
            // Set source and play
            audioPlayer.src = `/static/music/${id}.mp3`;
            audioPlayer.play().catch(e => {
                console.error("Playback failed:", e);
                alert("Could not play the audio file. It might still be downloading or missing.");
            });
        }

        function closePlayer() {
            const playerContainer = document.getElementById('player-container');
            const audioPlayer = document.getElementById('audio-player');
            
            playerContainer.classList.add('translate-y-full');
            audioPlayer.pause();
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/player')
def player():
    db = SessionLocal()
    try:
        videos = db.query(Video).order_by(Video.id.desc()).all()
        return render_template_string(PLAYER_TEMPLATE, videos=videos)
    finally:
        db.close()

@app.route('/static/<folder>/<filename>')
def serve_static(folder, filename):
    # Security check to ensure we only serve from allowed directories
    if folder not in ['figures', 'music', 'videos', 'bullet']:
        return "Access denied", 403
    return send_from_directory(os.path.join(app.root_path, folder), filename)

@app.route('/api/scrape', methods=['POST'])
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
    # Initialize DB if not exists
    from database import init_db
    init_db()
    
    app.run(host='127.0.0.1', port=5000, debug=True)
