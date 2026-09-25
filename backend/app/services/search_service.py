import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

# Ensure project root is on sys.path so top-level rag package can be imported
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from rag.chunking import create_code_chunks
from rag.retrieval import HybridRetriever
from app.services.repository_service import RepositoryService
from app.services.analysis_service import AnalysisService


class SearchService:
    def __init__(self, db_session=None):
        self.db = db_session

    def search_repository(
        self,
        repo_url: str,
        query: str,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Executes hybrid retrieval across an analyzed repository.
        Flow:
        1. Ingests source files safely using existing RepositoryService.
        2. Analyzes Python files with AST and builds code-aware chunks.
        3. Builds architecture graph capturing calls, containment, and imports.
        4. Semantic retrieval finds conceptually related code chunks via FAISS.
        5. Structural retrieval expands known code relationships from semantic seeds.
        6. Hybrid retrieval merges and deduplicates evidence without any learned reranker.
        """
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Search query cannot be empty.")

        # 1. Safely acquire repository source files (uses caching if recent)
        repo_service = RepositoryService(db_session=self.db)
        repo_data = repo_service.ingest_repository(repo_url)
        files = repo_data.get("files", [])

        python_files = [
            f for f in files
            if f.get("file_extension") == ".py" or f.get("language") == "Python"
        ]

        if not python_files:
            return {
                "repository_url": repo_url,
                "query": query,
                "results": [],
            }

        # 2. Run Python AST analysis across the source files
        analysis_service = AnalysisService(db_session=self.db)
        ast_analyses = [
            analysis_service.analyze_python_code(
                source_code=pf["source_content"],
                file_path=pf["relative_path"],
            )
            for pf in python_files
        ]

        # 3. Create code-aware chunks preserving AST symbol boundaries and line ranges
        chunks = create_code_chunks(
            repository_url=repo_url,
            files=python_files,
            ast_analyses=ast_analyses,
        )

        if not chunks:
            return {
                "repository_url": repo_url,
                "query": query,
                "results": [],
            }

        # 4. Build architecture graph capturing calls, contains, and imports
        graph = analysis_service.build_architecture_graph(repo_url)

        # 5. Execute hybrid retrieval:
        # Semantic retrieval finds conceptually related code via FAISS;
        # Structural retrieval expands known AST relationships;
        # Evidence is merged and deduplicated with no reranker.
        retriever = HybridRetriever(
            chunks=chunks,
            graph=graph,
            files=python_files,
        )
        results = retriever.retrieve(
            query=query,
            top_k=top_k,
            max_structural_expansion=top_k,
        )

        return {
            "repository_url": repo_url,
            "query": query,
            "results": results,
        }

    def search_codebase(self, query: str, repository_id: Optional[int] = None):
        raise NotImplementedError("SearchService.search_codebase with repository_id is scheduled for future implementation.")

