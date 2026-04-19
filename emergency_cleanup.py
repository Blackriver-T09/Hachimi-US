#!/usr/bin/env python3
"""
紧急清理脚本 - 清理 ID 13-36 的重复数据
"""

from database import SessionLocal, Video, ScrapeTask
import os
import shutil

def backup_database():
    """备份数据库"""
    if os.path.exists('db/hachimi.db'):
        backup_path = 'db/hachimi.db.backup'
        shutil.copy2('db/hachimi.db', backup_path)
        print(f"✓ 数据库已备份到: {backup_path}")

def cleanup_videos_13_to_36():
    """删除 ID 13-36 的所有视频记录和文件"""
    db = SessionLocal()
    try:
        # 获取 ID 13-36 的视频
        videos_to_delete = db.query(Video).filter(Video.id >= 13, Video.id <= 36).all()
        
        print(f"\n找到 {len(videos_to_delete)} 个视频需要删除 (ID 13-36)")
        
        for video in videos_to_delete:
            print(f"\n删除视频 ID {video.id}: {video.title}")
            
            # 删除文件
            files_to_delete = [
                ('music', f'{video.id}.mp3'),
                ('figures', f'{video.id}.jpg'),
                ('videos', f'{video.id}.mp4'),
                ('bullet', f'{video.id}.xml')
            ]
            
            for folder, filename in files_to_delete:
                filepath = os.path.join(folder, filename)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    print(f"  ✓ 删除文件: {filepath}")
                else:
                    print(f"  - 文件不存在: {filepath}")
            
            # 删除数据库记录
            db.delete(video)
        
        db.commit()
        print(f"\n✓ 已从数据库删除 {len(videos_to_delete)} 条记录")
        
    except Exception as e:
        print(f"✗ 错误: {e}")
        db.rollback()
    finally:
        db.close()

def cleanup_all_scrape_tasks():
    """删除所有爬取任务"""
    db = SessionLocal()
    try:
        all_tasks = db.query(ScrapeTask).all()
        count = len(all_tasks)
        
        print(f"\n找到 {count} 个爬取任务")
        
        for task in all_tasks:
            db.delete(task)
        
        db.commit()
        print(f"✓ 已删除所有 {count} 个爬取任务")
        
    except Exception as e:
        print(f"✗ 错误: {e}")
        db.rollback()
    finally:
        db.close()

def show_remaining_videos():
    """显示剩余的视频"""
    db = SessionLocal()
    try:
        remaining = db.query(Video).order_by(Video.id).all()
        
        print(f"\n剩余视频列表 ({len(remaining)} 首):")
        print("-" * 80)
        for video in remaining:
            print(f"ID {video.id:3d}: {video.title}")
        print("-" * 80)
        
    finally:
        db.close()

def verify_files():
    """验证文件完整性"""
    db = SessionLocal()
    try:
        videos = db.query(Video).all()
        
        print(f"\n验证文件完整性...")
        missing_files = []
        
        for video in videos:
            files = {
                'music': f'music/{video.id}.mp3',
                'figure': f'figures/{video.id}.jpg',
                'video': f'videos/{video.id}.mp4',
                'bullet': f'bullet/{video.id}.xml'
            }
            
            for file_type, filepath in files.items():
                if not os.path.exists(filepath):
                    missing_files.append((video.id, video.title, file_type, filepath))
        
        if missing_files:
            print(f"\n⚠️  发现 {len(missing_files)} 个缺失文件:")
            for vid, title, ftype, fpath in missing_files:
                print(f"  ID {vid} ({title}): 缺少 {ftype} - {fpath}")
        else:
            print("✓ 所有文件完整")
        
    finally:
        db.close()

if __name__ == '__main__':
    print("=" * 80)
    print("紧急清理脚本 - 清理 ID 13-36 的重复数据")
    print("=" * 80)
    
    # 确认
    print("\n⚠️  警告: 此操作将:")
    print("  1. 备份数据库")
    print("  2. 删除 ID 13-36 的所有视频和文件")
    print("  3. 删除所有爬取任务")
    print()
    
    confirm = input("确认执行? (yes/no): ")
    
    if confirm.lower() != 'yes':
        print("已取消")
        exit(0)
    
    print("\n开始清理...")
    
    # 1. 备份数据库
    backup_database()
    
    # 2. 删除 ID 13-36 的视频
    cleanup_videos_13_to_36()
    
    # 3. 删除所有爬取任务
    cleanup_all_scrape_tasks()
    
    # 4. 显示剩余视频
    show_remaining_videos()
    
    # 5. 验证文件
    verify_files()
    
    print("\n" + "=" * 80)
    print("✓ 清理完成")
    print("=" * 80)
    print("\n下一步:")
    print("  1. 重启服务器: python3 app.py")
    print("  2. 刷新浏览器: Ctrl+Shift+R")
    print("  3. 如果需要恢复，数据库备份在: db/hachimi.db.backup")
