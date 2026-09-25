from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

DEFAULT_EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
_EMBEDDING_MODEL: Optional[SentenceTransformer] = None


def get_embedding_model(model_name: str = DEFAULT_EMBEDDING_MODEL_NAME) -> SentenceTransformer:
    """
    Returns the singleton SentenceTransformer instance.
    Loads model once per process lifecycle to prevent redundant overhead.
    """
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        _EMBEDDING_MODEL = SentenceTransformer(model_name)
    return _EMBEDDING_MODEL


def embed_texts(
    texts: List[str],
    model_name: str = DEFAULT_EMBEDDING_MODEL_NAME,
    normalize: bool = True,
) -> np.ndarray:
    """
    Generates sentence embeddings for a list of strings using SentenceTransformer.
    Returns float32 NumPy array normalized for cosine similarity via inner product.
    """
    if not texts:
        return np.empty((0, 384), dtype=np.float32)

    model = get_embedding_model(model_name)
    embeddings = model.encode(
        texts,
        normalize_embeddings=normalize,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return embeddings.astype(np.float32)
