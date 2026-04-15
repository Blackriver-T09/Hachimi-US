import os
import re
import json
import shutil
import requests
from moviepy import VideoFileClip, AudioFileClip
from database import SessionLocal, Video

HEADERS_1 = {
    'Accept': '*/*',
    'Accept-Language': 'zh,en-US;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Range': 'bytes=0-',
    'Origin': 'https://www.bilibili.com',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:82.0) Gecko/20100101 Firefox/82.0',
}

HEADERS_2 = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:82.0) Gecko/20100101 Firefox/82.0',
    'Accept': '*/*',
    'Accept-Language': 'zh,en-US;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate, br',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'range',
    'Origin': 'https://www.bilibili.com',
    'Connection': 'keep-alive',
}

HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh,en-US;q=0.7,en;q=0.3',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:82.0) Gecko/20100101 Firefox/82.0',
}

def clean_title(title):
    return re.sub(r'[\\/:"*?<>|]', '_', title)

def scrape_bilibili(url):
    # Ensure directories exist
    for d in ['videos', 'music', 'bullet', 'figures']:
        os.makedirs(d, exist_ok=True)

    session = requests.Session()
    
    # 1. Fetch base page
    res = session.get(url, headers=HEADERS)
    res.encoding = 'utf-8'
    text = res.text
    
    # 2. Extract Title and Cover using INITIAL_STATE
    try:
        init_state_match = re.search(r'__INITIAL_STATE__=(.*?);\(function\(\)', text)
        if init_state_match:
            init_state = json.loads(init_state_match.group(1))
            title = init_state['videoData']['title']
            cover_url = init_state['videoData']['pic']
            cid = str(init_state['videoData']['cid'])
        else:
            raise ValueError("INITIAL_STATE not found")
    except Exception:
        # Fallback to older methods
        try:
            title_match = re.search(r'<title data-vue-meta="true">(.*?)</title>', text)
            if title_match:
                title = title_match.group(1).replace('_哔哩哔哩_bilibili', '').strip()
            else:
                title_match = re.search(r'<span class="tit">(.*?)</span>', text)
                title = title_match.group(1) if title_match else re.findall(r'/video/(.*?)$', res.url)[0]
        except Exception:
            title = "downloaded_video"
            
        try:
            cid = re.findall(r'cid=([\d]+)', text)[0]
        except Exception:
            cid = None
            
        try:
            cover_url = re.findall(r'<meta data-vue-meta="true" itemprop="image" content="(.*?)">', text)[0]
        except Exception:
            cover_url = None
            
    title = clean_title(title)
    if cover_url and cover_url.startswith('//'):
        cover_url = 'https:' + cover_url

    # 5. Extract Video and Audio URLs
    try:
        playinfo_match = re.search(r'<script>window.__playinfo__=(.*?)</script>', text)
        if not playinfo_match:
            playinfo_match = re.search(r'__playinfo__=(.*?)</script><script>', text)
        playinfo = json.loads(playinfo_match.group(1))
        
        video_url = playinfo['data']['dash']['video'][0]['baseUrl']
        audio_url = playinfo['data']['dash']['audio'][0]['baseUrl']
    except Exception as e:
        raise ValueError("Could not extract video/audio URLs. The URL might be invalid or require login.") from e

    # Create database entry to get ID
    db = SessionLocal()
    try:
        db_video = Video(title=title, source_url=url)
        db.add(db_video)
        db.commit()
        db.refresh(db_video)
        video_id = str(db_video.id)
    finally:
        db.close()
        
    print(f"Assigned ID {video_id} to {title}")

    HEADERS_1['Referer'] = url
    HEADERS_2['Referer'] = url
    
    # --- Download Cover (Figures) ---
    figure_path = None
    if cover_url:
        print(f"Downloading cover for {title}...")
        cover_res = session.get(cover_url, headers=HEADERS)
        figure_path = os.path.join('figures', f'{video_id}.jpg')
        with open(figure_path, 'wb') as f:
            f.write(cover_res.content)
            
    # --- Download Danmaku (Bullet) ---
    bullet_path = None
    if cid:
        print(f"Downloading danmaku for {title}...")
        xml_url = f'http://comment.bilibili.com/{cid}.xml'
        danmaku_res = session.get(xml_url, headers=HEADERS)
        danmaku_res.encoding = 'utf-8'
        bullet_path = os.path.join('bullet', f'{video_id}.xml')
        with open(bullet_path, 'w', encoding='utf-8') as f:
            f.write(danmaku_res.text)

    # Permission for Video/Audio
    session.options(video_url, headers=HEADERS_2)
    session.options(audio_url, headers=HEADERS_2)

    # --- Download Audio (Music) ---
    print(f"Downloading audio for {title}...")
    audio_path = os.path.join('music', f'{video_id}.mp3')
    audio_temp_path = os.path.join('music', f'{video_id}_temp.mp3') # For video merge
    
    with session.get(audio_url, headers=HEADERS_1, stream=True) as r:
        r.raise_for_status()
        with open(audio_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
                
    shutil.copy(audio_path, audio_temp_path)

    # --- Download Video ---
    print(f"Downloading video for {title}...")
    video_temp_path = os.path.join('videos', f'{video_id}_temp.mp4')
    with session.get(video_url, headers=HEADERS_1, stream=True) as r:
        r.raise_for_status()
        with open(video_temp_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
                
    # --- Merge Video and Audio ---
    print(f"Merging video and audio for {title}...")
    final_video_path = os.path.join('videos', f'{video_id}.mp4')
    try:
        video_clip = VideoFileClip(video_temp_path)
        audio_clip = AudioFileClip(audio_temp_path)
        
        # Check for MoviePy V2 vs V1 API
        if hasattr(video_clip, 'with_audio'):
            final_clip = video_clip.with_audio(audio_clip)
        else:
            final_clip = video_clip.set_audio(audio_clip)
            
        final_clip.write_videofile(final_video_path, fps=24, logger=None)
        
        video_clip.close()
        audio_clip.close()
    finally:
        if os.path.exists(video_temp_path):
            os.remove(video_temp_path)
        if os.path.exists(audio_temp_path):
            os.remove(audio_temp_path)
            
    print(f"Successfully processed {title} (ID: {video_id})!")
    return {
        'id': video_id,
        'title': title,
        'video': final_video_path,
        'music': audio_path,
        'bullet': bullet_path,
        'figure': figure_path
    }

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        test_url = sys.argv[1]
        scrape_bilibili(test_url)
    else:
        print("Usage: python scraper.py <url>")
