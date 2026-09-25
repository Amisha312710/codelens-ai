from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.search import SearchRequest, SearchResponse
from app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.post("", response_model=SearchResponse)
@router.post("/", response_model=SearchResponse)
def search_codebase(
    payload: SearchRequest,
    db: Session = Depends(get_db),
):
    """
    Executes semantic code retrieval for a given natural-language query over a repository.
    Generates code-aware chunks, embeds with Sentence Transformers, and retrieves top-k
    candidates via FAISS.
    """
    service = SearchService(db_session=db)
    return service.search_repository(
        repo_url=payload.url,
        query=payload.query,
        top_k=payload.top_k,
    )

