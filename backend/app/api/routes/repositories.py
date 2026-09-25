from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.repository import RepositoryIngestRequest, RepositoryIngestResponse
from app.services.repository_service import RepositoryService

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("/ingest", response_model=RepositoryIngestResponse)
def ingest_repository(
    payload: RepositoryIngestRequest,
    db: Session = Depends(get_db),
):
    """
    Ingest a public GitHub repository.
    Safely clones into an isolated temporary directory, filters untrusted/irrelevant files,
    captures source file metadata, and deletes the temporary clone.
    """
    service = RepositoryService(db_session=db)
    return service.ingest_repository(payload.url)
