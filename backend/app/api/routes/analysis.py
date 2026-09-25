from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analysis import (
    AnalyzeCodeRequest,
    ArchitectureGraphResponse,
    FileASTAnalysisResult,
    RepositoryAnalysisRequest,
    RepositoryAnalysisResponse,
)
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/ast", response_model=FileASTAnalysisResult)
def analyze_code_ast(payload: AnalyzeCodeRequest):
    """
    Analyzes Python source code using the built-in ast module.
    Extracts functions, classes, imports, function calls, and syntax errors.
    Never executes repository code.
    """
    service = AnalysisService()
    return service.analyze_python_code(
        source_code=payload.source_code,
        file_path=payload.file_path,
    )


@router.post("/repository", response_model=RepositoryAnalysisResponse)
def analyze_repository(
    payload: RepositoryAnalysisRequest,
    db: Session = Depends(get_db),
):
    """
    Performs repository-level code analysis across all Python files in a public GitHub repository.
    Reuses repository ingestion to acquire files safely and executes AST analysis,
    aggregating results and syntactically establishing internal file-level dependencies.
    """
    service = AnalysisService(db_session=db)
    return service.analyze_repository(repo_url=payload.url)


@router.post("/graph", response_model=ArchitectureGraphResponse)
def get_architecture_graph(
    payload: RepositoryAnalysisRequest,
    db: Session = Depends(get_db),
):
    """
    Constructs an architecture graph representation of the repository.
    Generates file, class, and function nodes, as well as contains,
    internal imports, and unambiguous function call edges.
    """
    service = AnalysisService(db_session=db)
    return service.build_architecture_graph(repo_url=payload.url)
