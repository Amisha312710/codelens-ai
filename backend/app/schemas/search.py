from typing import List, Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    url: str = Field(..., description="Public GitHub repository URL")
    query: str = Field(..., description="Natural language search query")
    top_k: int = Field(default=5, ge=1, le=50, description="Maximum number of results to return")


class SearchResultItem(BaseModel):
    file_path: str
    symbol_name: str
    symbol_type: str
    start_line: int
    end_line: int
    source_code: str
    similarity_score: Optional[float] = None
    retrieval_sources: List[str] = Field(default_factory=lambda: ["semantic"])


class SearchResponse(BaseModel):
    repository_url: str
    query: str
    results: List[SearchResultItem]


# Retain legacy models for backwards compatibility if needed
class SearchQuery(BaseModel):
    query: str
    repository_id: Optional[int] = None

