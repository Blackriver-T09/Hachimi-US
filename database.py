from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

Base = declarative_base()

class Video(Base):
    __tablename__ = 'videos'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    likes = Column(Integer, default=0, nullable=False)

class OnlineStats(Base):
    __tablename__ = 'online_stats'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    online_count = Column(Integer, nullable=False)
    peak_count = Column(Integer, nullable=False)  # Peak count for this day

class ScrapeTask(Base):
    __tablename__ = 'scrape_tasks'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String, nullable=False, unique=True)
    status = Column(String, nullable=False, default='in_queue')  # in_queue, scraping, waiting, finished, failed
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    next_retry_at = Column(DateTime, nullable=True)  # When to retry if waiting
    video_id = Column(Integer, nullable=True)  # ID of created video if finished

# Ensure database directory exists
os.makedirs('db', exist_ok=True)

engine = create_engine('sqlite:///db/hachimi.db')
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
