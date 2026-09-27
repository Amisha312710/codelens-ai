import os
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
from rag.evidence_ranking import CodeEvidenceRanker
from rag.generation import (
    LLMProvider,
    OpenAIProvider,
    validate_context,
    format_evidence_prompt,
    extract_citations,
    GROUNDING_SYSTEM_PROMPT,
)
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
        6. Produces complete deduplicated hybrid candidate pool.
        7. Cross-encoder reranks the candidate pool against the user query.
        8. Returns final top-K reranked results with full precision reranker_score.
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

        # 5. Hybrid candidate generation:
        # Generates complete deduplicated hybrid candidate pool from semantic FAISS retrieval
        # and AST structural expansion.
        retriever = HybridRetriever(
            chunks=chunks,
            graph=graph,
            files=python_files,
        )
        hybrid_candidates = retriever.retrieve(
            query=query,
            top_k=top_k,
            max_structural_expansion=top_k,
        )

        # 6. Deterministic Code Evidence Ranking:
        # Resolves duplicate spans and containment redundancies, then ranks candidates
        # using AST symbol metadata, graph connectivity, identifier matching, and intent gating.
        ranker = CodeEvidenceRanker(graph=graph)
        ranked_results = ranker.rank(
            query=query,
            candidates=hybrid_candidates,
            top_k=top_k,
        )

        # Ensure return contract matches SearchResultItem schema with reranker_score=None
        for res in ranked_results:
            res.setdefault("reranker_score", None)
            res.pop("_evidence_score", None)

        return {
            "repository_url": repo_url,
            "query": query,
            "results": ranked_results,
        }

    def ask_repository(
        self,
        repo_url: str,
        question: str,
        top_k: int = 5,
        provider: Optional[LLMProvider] = None,
    ) -> Dict[str, Any]:
        """
        Answers natural-language codebase questions using grounded LLM generation over retrieved evidence.
        Reuses the existing search_repository() pipeline without duplicating retrieval logic.
        """
        if not question or not question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        # 1. Reuse existing search_repository pipeline (ingestion, AST, FAISS, graph, ranker, top-k)
        search_res = self.search_repository(
            repo_url=repo_url,
            query=question,
            top_k=top_k,
        )
        raw_evidence = search_res.get("results", [])

        # 2. Context validation step (deduplicates spans, ensures non-empty code and valid metadata)
        validated_evidence = validate_context(raw_evidence)

        # 3. If no usable evidence exists, return early with grounded message without calling LLM
        if not validated_evidence:
            return {
                "question": question,
                "answer": "The available repository evidence is insufficient to answer this question.",
                "citations": [],
                "evidence_used": [],
            }

        # 4. Resolve LLM provider
        if provider is None:
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="Server configuration error: OPENAI_API_KEY is not configured.",
                )
            provider = OpenAIProvider(api_key=api_key)

        # 5. Format prompt and execute LLM generation
        evidence_prompt = format_evidence_prompt(validated_evidence)
        user_prompt = (
            f"Question: {question.strip()}\n\n"
            f"Supplied Repository Evidence:\n\n"
            f"{evidence_prompt}\n\n"
            f"Please provide a grounded answer with inline citations."
        )

        try:
            answer = provider.generate(
                prompt=user_prompt,
                system_prompt=GROUNDING_SYSTEM_PROMPT,
            )
        except Exception as e:
            # Controlled API error, no stack trace exposed to client
            raise HTTPException(
                status_code=502,
                detail=f"LLM generation failed: {type(e).__name__}",
            )

        # 6. Parse citations only (without claiming verification yet)
        citations = extract_citations(answer)

        # 7. Return structured response
        return {
            "question": question,
            "answer": answer,
            "citations": citations,
            "evidence_used": validated_evidence,
        }

    def search_codebase(self, query: str, repository_id: Optional[int] = None):
        raise NotImplementedError("SearchService.search_codebase with repository_id is scheduled for future implementation.")

