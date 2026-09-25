from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# Database engine initialization (lazy connection, pool_pre_ping to verify connections)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

# Session factory for generating database sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Declarative Base for SQLAlchemy models
Base = declarative_base()


def get_db() -> Generator:
    """Dependency helper for obtaining a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
