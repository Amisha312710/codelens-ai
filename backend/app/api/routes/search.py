from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.search import SearchRequest, SearchResponse, AskRequest, AskResponse
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


@router.post("/ask", response_model=AskResponse)
def ask_codebase(
    payload: AskRequest,
    db: Session = Depends(get_db),
):
    """
    Answers a natural-language question about a repository using grounded LLM generation
    over retrieved codebase evidence with predictable inline source citations.
    """
    service = SearchService(db_session=db)
    conv_dicts = [
        m.model_dump() if hasattr(m, "model_dump") else (m.dict() if hasattr(m, "dict") else dict(m))
        for m in (payload.conversation or [])
    ]
    return service.ask_repository(
        repo_url=payload.url,
        question=payload.question,
        top_k=payload.top_k,
        explanation_mode=payload.explanation_mode,
        conversation=conv_dicts,
    )

