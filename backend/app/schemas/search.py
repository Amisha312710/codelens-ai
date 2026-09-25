from typing import Optional
from pydantic import BaseModel


class SearchQuery(BaseModel):
    query: str
    repository_id: Optional[int] = None


class SearchResponse(BaseModel):
    query: str
    status: str = "unimplemented"
