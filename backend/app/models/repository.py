from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class Repository(Base):
    """Represents an analyzed GitHub repository in CodeLens AI."""
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    url = Column(String, nullable=False)
    default_branch = Column(String, default="main")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    files = relationship("File", back_populates="repository", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="repository", cascade="all, delete-orphan")
