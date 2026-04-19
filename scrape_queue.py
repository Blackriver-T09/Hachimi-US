"""
爬取池管理系统
支持队列管理、失败重试、状态跟踪
"""

import time
import logging
from datetime import datetime, timedelta
from threading import Lock
from database import SessionLocal, ScrapeTask, Video
from scraper import scrape_bilibili

logger = logging.getLogger(__name__)

class ScrapeQueue:
    """
    爬取池管理器
    - 队列管理
    - 失败重试（指数退避）
    - 状态跟踪
    - 串行处理
    """
    
    def __init__(self, check_interval=10, base_wait_time=60):
        """
        初始化爬取池
        
        Args:
            check_interval: 检查队列间隔（秒）
            base_wait_time: 基础等待时间（秒），失败后等待时间
        """
        self.check_interval = check_interval
        self.base_wait_time = base_wait_time
        self.processing_lock = Lock()
        self.is_processing = False
        
        logger.info(f"ScrapeQueue initialized (check_interval={check_interval}s, base_wait={base_wait_time}s)")
    
    def add_task(self, url, max_retries=3):
        """
        添加爬取任务到队列
        
        Args:
            url: 视频 URL
            max_retries: 最大重试次数
            
        Returns:
            dict: {'success': bool, 'task_id': int, 'message': str}
        """
        db = SessionLocal()
        try:
            # 检查 URL 是否已存在
            existing_task = db.query(ScrapeTask).filter_by(url=url).first()
            if existing_task:
                return {
                    'success': False,
                    'task_id': existing_task.id,
                    'message': f'Task already exists with status: {existing_task.status}'
                }
            
            # 检查是否已经爬取过（在 videos 表中）
            existing_video = db.query(Video).filter_by(source_url=url).first()
            if existing_video:
                return {
                    'success': False,
                    'video_id': existing_video.id,
                    'message': 'Video already exists in database'
                }
            
            # 创建新任务
            task = ScrapeTask(
                url=url,
                status='in_queue',
                max_retries=max_retries
            )
            db.add(task)
            db.commit()
            db.refresh(task)
            
            logger.info(f"Added task {task.id} to queue: {url}")
            
            return {
                'success': True,
                'task_id': task.id,
                'message': 'Task added to queue'
            }
            
        except Exception as e:
            logger.error(f"Failed to add task: {e}")
            db.rollback()
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }
        finally:
            db.close()
    
    def get_next_task(self):
        """
        获取下一个待处理的任务
        
        Returns:
            ScrapeTask or None
        """
        db = SessionLocal()
        try:
            now = datetime.utcnow()
            
            # 优先处理 in_queue 状态的任务
            task = db.query(ScrapeTask).filter_by(status='in_queue').order_by(ScrapeTask.created_at).first()
            
            if task:
                return task
            
            # 其次处理 waiting 状态且到达重试时间的任务
            task = db.query(ScrapeTask).filter(
                ScrapeTask.status == 'waiting',
                ScrapeTask.next_retry_at <= now
            ).order_by(ScrapeTask.next_retry_at).first()
            
            return task
            
        finally:
            db.close()
    
    def update_task_status(self, task_id, status, error_message=None, video_id=None):
        """
        更新任务状态
        
        Args:
            task_id: 任务 ID
            status: 新状态
            error_message: 错误信息（可选）
            video_id: 创建的视频 ID（可选）
        """
        db = SessionLocal()
        try:
            task = db.query(ScrapeTask).filter_by(id=task_id).first()
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            task.status = status
            task.updated_at = datetime.utcnow()
            
            if error_message:
                task.error_message = error_message
            
            if video_id:
                task.video_id = video_id
            
            db.commit()
            logger.info(f"Task {task_id} status updated to: {status}")
            
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            db.rollback()
        finally:
            db.close()
    
    def process_task(self, task):
        """
        处理单个爬取任务
        
        Args:
            task: ScrapeTask 对象
            
        Returns:
            bool: 是否成功
        """
        task_id = task.id
        task_url = task.url
        
        db = SessionLocal()
        try:
            # 从当前 session 获取 task 对象
            task = db.query(ScrapeTask).filter_by(id=task_id).first()
            if not task:
                logger.error(f"Task {task_id} not found")
                return False
            
            # 更新状态为 scraping
            task.status = 'scraping'
            task.updated_at = datetime.utcnow()
            db.commit()
            
            logger.info(f"Processing task {task.id}: {task.url}")
            
            # 执行爬取
            try:
                result = scrape_bilibili(task_url)
                
                # scraper.py 返回的是包含 id 的字典，如果成功的话
                if result and isinstance(result, dict) and 'id' in result:
                    # 爬取成功
                    video_id = result['id']
                    task.status = 'finished'
                    task.video_id = video_id
                    task.error_message = None
                    task.updated_at = datetime.utcnow()
                    db.commit()
                    
                    logger.info(f"✓ Task {task.id} completed successfully, video_id={video_id}")
                    return True
                else:
                    # 爬取失败
                    error_msg = 'Scraper did not return valid result'
                    raise Exception(error_msg)
                    
            except Exception as scrape_error:
                # 爬取失败，处理重试逻辑
                task.retry_count += 1
                task.error_message = str(scrape_error)
                
                if task.retry_count < task.max_retries:
                    # 还有重试机会，计算下次重试时间（指数退避）
                    wait_time = self.base_wait_time * (2 ** (task.retry_count - 1))
                    task.next_retry_at = datetime.utcnow() + timedelta(seconds=wait_time)
                    task.status = 'waiting'
                    task.updated_at = datetime.utcnow()
                    db.commit()
                    
                    logger.warning(f"Task {task.id} failed (attempt {task.retry_count}/{task.max_retries}), "
                                 f"will retry at {task.next_retry_at.strftime('%H:%M:%S')}")
                else:
                    # 重试次数用完，标记为失败
                    task.status = 'failed'
                    task.updated_at = datetime.utcnow()
                    db.commit()
                    
                    logger.error(f"✗ Task {task.id} failed permanently after {task.retry_count} attempts: {task.error_message}")
                
                return False
                
        except Exception as e:
            logger.error(f"Error processing task {task.id}: {e}")
            db.rollback()
            return False
        finally:
            db.close()
    
    def process_one(self):
        """
        处理一个任务（如果有待处理的）
        
        Returns:
            bool: 是否处理了一个任务
        """
        with self.processing_lock:
            if self.is_processing:
                logger.debug("Already processing, skipping")
                return False
            
            self.is_processing = True
            
            try:
                # 获取下一个任务
                task = self.get_next_task()
                
                if task is None:
                    logger.debug("No tasks to process")
                    return False
                
                # 处理任务
                logger.info(f"Found task {task.id} to process (status: {task.status})")
                success = self.process_task(task)
                
                return True
                
            finally:
                self.is_processing = False
    
    def run_background_loop(self):
        """
        后台循环 - 在线程中运行
        持续检查并处理队列中的任务
        """
        logger.info("ScrapeQueue background loop started")
        
        while True:
            try:
                # 处理一个任务
                processed = self.process_one()
                
                if processed:
                    logger.info(f"Processed one task, waiting {self.check_interval}s before next check")
                else:
                    logger.debug(f"No tasks processed, waiting {self.check_interval}s")
                
                # 等待下一次检查
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"Error in background loop: {e}")
                time.sleep(10)  # 出错后等待 10 秒再继续
    
    def get_queue_stats(self):
        """
        获取队列统计信息
        
        Returns:
            dict: 统计信息
        """
        db = SessionLocal()
        try:
            stats = {
                'in_queue': db.query(ScrapeTask).filter_by(status='in_queue').count(),
                'scraping': db.query(ScrapeTask).filter_by(status='scraping').count(),
                'waiting': db.query(ScrapeTask).filter_by(status='waiting').count(),
                'finished': db.query(ScrapeTask).filter_by(status='finished').count(),
                'failed': db.query(ScrapeTask).filter_by(status='failed').count(),
            }
            stats['total'] = sum(stats.values())
            return stats
        finally:
            db.close()
    
    def get_all_tasks(self, status=None, limit=50):
        """
        获取所有任务
        
        Args:
            status: 筛选状态（可选）
            limit: 返回数量限制
            
        Returns:
            list: 任务列表
        """
        db = SessionLocal()
        try:
            query = db.query(ScrapeTask)
            
            if status:
                query = query.filter_by(status=status)
            
            tasks = query.order_by(ScrapeTask.created_at.desc()).limit(limit).all()
            
            return [{
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
            } for task in tasks]
            
        finally:
            db.close()


# 全局单例
_queue = None

def get_scrape_queue(check_interval=10, base_wait_time=60):
    """
    获取全局爬取池实例
    
    Args:
        check_interval: 检查间隔（秒）
        base_wait_time: 基础等待时间（秒）
        
    Returns:
        ScrapeQueue: 爬取池实例
    """
    global _queue
    if _queue is None:
        _queue = ScrapeQueue(check_interval=check_interval, base_wait_time=base_wait_time)
    return _queue
