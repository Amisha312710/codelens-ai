from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class RepositoryBase(BaseModel):
    name: str
    url: str
    default_branch: str = "main"


class RepositoryCreate(RepositoryBase):
    pass


class RepositoryResponse(RepositoryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RepositoryIngestRequest(BaseModel):
    url: str


class SourceFileMetadata(BaseModel):
    relative_path: str
    file_extension: str
    language: Optional[str] = None
    file_size: int
    source_content: str


class RepositoryIngestResponse(BaseModel):
    repository_url: str
    repository_name: str
    total_files: int
    files: List[SourceFileMetadata]
