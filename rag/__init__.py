"""
CodeLens AI - RAG Package
Code-aware chunking, embeddings, and FAISS vector retrieval.
"""

from rag.chunking import CodeChunk, create_code_chunks
from rag.embeddings import get_embedding_model, embed_texts
from rag.retrieval import SemanticRetriever, StructuralRetriever, HybridRetriever

__all__ = [
    "CodeChunk",
    "create_code_chunks",
    "get_embedding_model",
    "embed_texts",
    "SemanticRetriever",
    "StructuralRetriever",
    "HybridRetriever",
]
