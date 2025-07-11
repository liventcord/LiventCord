import os

from sqlalchemy import Column, DateTime, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

db_path = "databases/guild_db.db"
db_dir = os.path.dirname(db_path)

if not os.path.exists(db_dir):
    os.makedirs(db_dir)

DATABASE_URL = f"sqlite:///{db_path}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Message(Base):  # type: ignore
    __tablename__ = "messages"

    message_id = Column(String, primary_key=True)
    guild_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    channel_id = Column(String, nullable=False)
    date = Column(DateTime, nullable=False)
    last_edited = Column(DateTime)
    attachment_urls = Column(Text)
    reply_to_id = Column(String)
    reaction_emojis_ids = Column(Text)
    embed = Column(Text)


Base.metadata.create_all(engine)
