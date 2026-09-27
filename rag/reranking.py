from typing import Any, Dict, List, Optional
from sentence_transformers import CrossEncoder

DEFAULT_RERANKER_MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_RERANKER_MODEL: Optional[CrossEncoder] = None


def get_reranker_model(model_name: str = DEFAULT_RERANKER_MODEL_NAME) -> CrossEncoder:
    """
    Returns the singleton CrossEncoder instance.
    Loads the model lazily once per process lifecycle to prevent redundant initialization overhead.
    """
    global _RERANKER_MODEL
    if _RERANKER_MODEL is None:
        _RERANKER_MODEL = CrossEncoder(model_name)
    return _RERANKER_MODEL


class CrossEncoderReranker:
    """
    Cross-Encoder Reranker using cross-attention over (query, passage) pairs.
    Takes the complete candidate pool produced by HybridRetriever and rescores
    candidates using their source code as passage content.
    """

    def __init__(self, model_name: str = DEFAULT_RERANKER_MODEL_NAME):
        self.model_name = model_name

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Reranks candidates against the user query using cross-encoder relevance scores.
        - Preserves existing similarity_score (FAISS inner product) without overwriting.
        - Preserves existing retrieval_sources exactly.
        - Assigns full precision float to candidate['reranker_score'].
        - Sorts candidates descending by reranker_score.
        - Returns the top_k candidates (or all reranked candidates if top_k is None).
        """
        if not candidates:
            return []

        if not query or not query.strip():
            # If query is empty, attach None for reranker_score and return
            for cand in candidates:
                cand.setdefault("reranker_score", None)
            return candidates[:top_k] if top_k is not None else candidates

        model = get_reranker_model(self.model_name)

        # Prepare (query, passage) pairs using candidate source_code
        pairs = [(query.strip(), cand.get("source_code", "")) for cand in candidates]

        # Compute cross-encoder relevance scores
        scores = model.predict(pairs)

        # Attach reranker_score as full precision float without overwriting similarity_score
        scored_candidates = []
        for cand, score in zip(candidates, scores):
            cand_copy = dict(cand)
            cand_copy["reranker_score"] = float(score)
            scored_candidates.append(cand_copy)

        # Sort descending by reranker_score
        scored_candidates.sort(key=lambda c: c["reranker_score"], reverse=True)

        if top_k is not None and top_k > 0:
            return scored_candidates[:top_k]
        return scored_candidates
