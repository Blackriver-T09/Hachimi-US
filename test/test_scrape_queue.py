#!/usr/bin/env python3
"""
测试爬取池功能
"""

import time
import requests
from database import SessionLocal, ScrapeTask, Video

# 测试 URL
TEST_URLS = [
    "https://www.bilibili.com/video/BV1test1",
    "https://www.bilibili.com/video/BV1test2",
    "https://www.bilibili.com/video/BV1test3",
]

API_BASE = "http://127.0.0.1:5000"

def get_token():
    """获取 JWT token"""
    response = requests.post(f"{API_BASE}/api/login", json={
        "username": "admin",
        "password": "password"
    })
    if response.status_code == 200:
        return response.json()['token']
    else:
        print("⚠️  无法获取 token，请确保服务器正在运行")
        return None

def test_add_tasks():
    """测试添加任务到队列"""
    print("=" * 60)
    print("测试：添加任务到队列")
    print("=" * 60)
    
    token = get_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    for url in TEST_URLS:
        print(f"\n添加任务: {url}")
        response = requests.post(
            f"{API_BASE}/api/scrape",
            json={"url": url, "max_retries": 2},
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 任务已添加: ID {data.get('task_id')}")
        else:
            print(f"✗ 添加失败: {response.json()}")

def test_get_stats():
    """测试获取队列统计"""
    print("\n" + "=" * 60)
    print("测试：获取队列统计")
    print("=" * 60)
    
    token = get_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/api/scrape/queue/stats", headers=headers)
    
    if response.status_code == 200:
        stats = response.json()['stats']
        print("\n队列统计:")
        print(f"  总任务数: {stats['total']}")
        print(f"  队列中: {stats['in_queue']}")
        print(f"  爬取中: {stats['scraping']}")
        print(f"  等待中: {stats['waiting']}")
        print(f"  已完成: {stats['finished']}")
        print(f"  已失败: {stats['failed']}")
    else:
        print(f"✗ 获取统计失败: {response.status_code}")

def test_get_tasks():
    """测试获取任务列表"""
    print("\n" + "=" * 60)
    print("测试：获取任务列表")
    print("=" * 60)
    
    token = get_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/api/scrape/queue/tasks?limit=10", headers=headers)
    
    if response.status_code == 200:
        tasks = response.json()['tasks']
        print(f"\n找到 {len(tasks)} 个任务:")
        
        for task in tasks:
            print(f"\n任务 #{task['id']}:")
            print(f"  URL: {task['url']}")
            print(f"  状态: {task['status']}")
            print(f"  重试: {task['retry_count']}/{task['max_retries']}")
            if task['error_message']:
                print(f"  错误: {task['error_message'][:50]}...")
            if task['video_id']:
                print(f"  视频ID: {task['video_id']}")
    else:
        print(f"✗ 获取任务失败: {response.status_code}")

def test_database_direct():
    """直接查询数据库"""
    print("\n" + "=" * 60)
    print("测试：直接查询数据库")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        total_tasks = db.query(ScrapeTask).count()
        in_queue = db.query(ScrapeTask).filter_by(status='in_queue').count()
        scraping = db.query(ScrapeTask).filter_by(status='scraping').count()
        waiting = db.query(ScrapeTask).filter_by(status='waiting').count()
        finished = db.query(ScrapeTask).filter_by(status='finished').count()
        failed = db.query(ScrapeTask).filter_by(status='failed').count()
        
        print(f"\n数据库中的任务:")
        print(f"  总数: {total_tasks}")
        print(f"  in_queue: {in_queue}")
        print(f"  scraping: {scraping}")
        print(f"  waiting: {waiting}")
        print(f"  finished: {finished}")
        print(f"  failed: {failed}")
        
        # 显示最近的任务
        recent_tasks = db.query(ScrapeTask).order_by(ScrapeTask.created_at.desc()).limit(5).all()
        
        if recent_tasks:
            print(f"\n最近 {len(recent_tasks)} 个任务:")
            for task in recent_tasks:
                print(f"\n  任务 #{task.id}:")
                print(f"    URL: {task.url}")
                print(f"    状态: {task.status}")
                print(f"    创建: {task.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"    更新: {task.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
                
    finally:
        db.close()

def monitor_queue(duration=60):
    """监控队列处理进度"""
    print("\n" + "=" * 60)
    print(f"监控队列处理进度（{duration}秒）")
    print("=" * 60)
    print("按 Ctrl+C 停止\n")
    
    token = get_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    start_time = time.time()
    
    try:
        while time.time() - start_time < duration:
            response = requests.get(f"{API_BASE}/api/scrape/queue/stats", headers=headers)
            
            if response.status_code == 200:
                stats = response.json()['stats']
                print(f"\r[{time.strftime('%H:%M:%S')}] "
                      f"队列:{stats['in_queue']} | "
                      f"爬取中:{stats['scraping']} | "
                      f"等待:{stats['waiting']} | "
                      f"完成:{stats['finished']} | "
                      f"失败:{stats['failed']}", 
                      end='', flush=True)
            
            time.sleep(2)
        
        print("\n\n监控完成")
        
    except KeyboardInterrupt:
        print("\n\n已停止监控")

def cleanup_test_tasks():
    """清理测试任务"""
    print("\n" + "=" * 60)
    print("清理测试任务")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # 删除测试 URL 的任务
        deleted = 0
        for url in TEST_URLS:
            task = db.query(ScrapeTask).filter_by(url=url).first()
            if task:
                db.delete(task)
                deleted += 1
        
        db.commit()
        print(f"✓ 已删除 {deleted} 个测试任务")
        
    finally:
        db.close()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "add":
            test_add_tasks()
        elif command == "stats":
            test_get_stats()
        elif command == "tasks":
            test_get_tasks()
        elif command == "db":
            test_database_direct()
        elif command == "monitor":
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 60
            monitor_queue(duration)
        elif command == "cleanup":
            cleanup_test_tasks()
        else:
            print(f"未知命令: {command}")
            print("可用命令: add, stats, tasks, db, monitor, cleanup")
    else:
        # 运行所有测试
        print("🧪 爬取池功能测试\n")
        
        # 清理旧的测试任务
        cleanup_test_tasks()
        
        # 添加任务
        test_add_tasks()
        time.sleep(2)
        
        # 获取统计
        test_get_stats()
        
        # 获取任务列表
        test_get_tasks()
        
        # 数据库查询
        test_database_direct()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试完成")
        print("=" * 60)
        print("\n提示:")
        print("  - 运行 'python3 test_scrape_queue.py monitor' 监控处理进度")
        print("  - 运行 'python3 test_scrape_queue.py cleanup' 清理测试数据")
