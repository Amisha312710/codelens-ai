from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.walkthrough import WalkthroughRequest, WalkthroughResponse
from app.services.walkthrough_service import WalkthroughService

router = APIRouter(prefix="/walkthroughs", tags=["walkthroughs"])


@router.post("", response_model=WalkthroughResponse)
@router.post("/generate", response_model=WalkthroughResponse)
def generate_walkthrough(
    payload: WalkthroughRequest,
    db: Session = Depends(get_db),
):
    """
    Generates an evidence-grounded Visual Walkthrough for an analyzed repository.
    Strictly returns only supported walkthrough concepts from the 5 approved V1 visual types.
    """
    if not payload.url and not payload.repository_id:
        raise HTTPException(
            status_code=400,
            detail="Repository URL ('url') or 'repository_id' must be provided.",
        )

    service = WalkthroughService(db_session=db)
    return service.generate_walkthrough(
        repo_url=payload.url,
        repository_id=payload.repository_id,
    )
