from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.flow import FlowRequest, FlowResponse, FunctionsListResponse
from app.schemas.analysis import RepositoryAnalysisRequest
from app.services.flow_service import FlowService

router = APIRouter(prefix="/flows", tags=["flows"])


@router.post("", response_model=FlowResponse)
@router.post("/trace", response_model=FlowResponse)
def trace_code_flow(
    payload: FlowRequest,
    db: Session = Depends(get_db),
):
    """
    Traces the static function call flow starting from a root function up to max_depth (1–3).
    Reuses existing AST architecture graph call relationships.
    Returns ordered nodes and CALLS edges.
    """
    repo_url = payload.url
    root_func = payload.root_function or payload.entry_point

    if not repo_url or not repo_url.strip():
        raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")
    if not root_func or not root_func.strip():
        raise HTTPException(status_code=400, detail="Root function cannot be empty.")

    service = FlowService(db_session=db)
    return service.trace_flow(
        repo_url=repo_url.strip(),
        root_function=root_func.strip(),
        max_depth=payload.max_depth,
    )


@router.post("/functions", response_model=FunctionsListResponse)
def list_repository_functions(
    payload: RepositoryAnalysisRequest,
    db: Session = Depends(get_db),
):
    """
    Returns a sorted list of all functions discovered in the repository
    for the compact Code Flow search control.
    """
    if not payload.url or not payload.url.strip():
        raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

    service = FlowService(db_session=db)
    funcs = service.list_repository_functions(repo_url=payload.url.strip())
    return {
        "repository_url": payload.url.strip(),
        "functions": funcs,
    }

