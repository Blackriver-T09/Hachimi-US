from sqlalchemy import create_engine, Column, Integer, String, DateTime
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

# Ensure database directory exists
os.makedirs('db', exist_ok=True)

engine = create_engine('sqlite:///db/hachimi.db')
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
