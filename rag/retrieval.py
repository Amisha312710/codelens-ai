from typing import Any, Dict, List, Optional, Set
import faiss
import numpy as np

from rag.chunking import CodeChunk
from rag.embeddings import embed_texts


class SemanticRetriever:
    """
    In-memory FAISS-based semantic retriever for code chunks.
    Constructs an IndexFlatIP index over normalized chunk embeddings
    and ranks results by cosine similarity.
    """

    def __init__(self, chunks: List[CodeChunk]):
        self.chunks = chunks
        self.index: Optional[faiss.IndexFlatIP] = None
        self.dimension: int = 384
        if self.chunks:
            self._build_index()

    def _build_index(self):
        texts = [chunk.get_embedding_text() for chunk in self.chunks]
        embeddings = embed_texts(texts, normalize=True)
        self.dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(embeddings)

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves the top-k semantically most similar chunks for a given natural-language query.
        Returns empty list if index is empty or query is blank.
        """
        if not self.chunks or self.index is None or not query or not query.strip():
            return []

        k = max(1, min(top_k, len(self.chunks)))

        # Embed query with unit normalization
        query_embedding = embed_texts([query.strip()], normalize=True)

        # Search FAISS index
        distances, indices = self.index.search(query_embedding, k)

        results: List[Dict[str, Any]] = []
        for score, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.chunks):
                continue
            chunk = self.chunks[idx]
            results.append({
                "file_path": chunk.file_path,
                "symbol_name": chunk.symbol_name,
                "symbol_type": chunk.symbol_type,
                "start_line": chunk.start_line,
                "end_line": chunk.end_line,
                "source_code": chunk.source_code,
                "similarity_score": round(float(score), 4),
            })

        return results


class StructuralRetriever:
    """
    Structural retriever leveraging Python AST and architecture graph relationships.
    Expands candidate symbols across:
    - calls: callers and callees
    - contains: class membership and file-to-symbol containment
    - imports: internal file/module dependencies
    Strictly derives relationships from existing AST analysis without runtime execution.
    """

    def __init__(
        self,
        graph: Dict[str, Any],
        chunks: List[CodeChunk],
        files: Optional[List[Dict[str, Any]]] = None,
    ):
        self.graph = graph or {}
        self.chunks = chunks or []
        self.files = files or []
        self._build_index()

    def _build_index(self):
        # Index graph nodes by ID
        self.nodes_by_id: Dict[str, Dict[str, Any]] = {}
        for node in self.graph.get("nodes", []):
            self.nodes_by_id[node["id"]] = node

        # Build adjacency lists for incoming and outgoing edges
        self.outgoing_edges: Dict[str, List[Dict[str, Any]]] = {}
        self.incoming_edges: Dict[str, List[Dict[str, Any]]] = {}
        for edge in self.graph.get("edges", []):
            src = edge.get("source")
            tgt = edge.get("target")
            if src and tgt:
                self.outgoing_edges.setdefault(src, []).append(edge)
                self.incoming_edges.setdefault(tgt, []).append(edge)

        # Index files by relative_path
        self.files_by_path: Dict[str, Dict[str, Any]] = {}
        for f in self.files:
            rel = f.get("relative_path")
            if rel:
                self.files_by_path[rel] = f

        # Index chunks by (file_path, symbol_type.upper(), symbol_name)
        self.chunks_by_symbol: Dict[tuple, CodeChunk] = {}
        for c in self.chunks:
            self.chunks_by_symbol[(c.file_path, c.symbol_type.upper(), c.symbol_name)] = c

    def _node_to_candidate(self, node_id: str) -> Optional[Dict[str, Any]]:
        node = self.nodes_by_id.get(node_id)
        if not node:
            return None

        file_path = node.get("file_path") or ""
        node_type = (node.get("type") or "file").upper()
        display_name = node.get("name") or file_path

        # Check existing chunks first
        symbol_chunk = self.chunks_by_symbol.get((file_path, node_type, display_name))
        if not symbol_chunk and "." in display_name:
            # Handle scoped method name, e.g. ClassName.method_name -> method_name
            short_name = display_name.split(".")[-1]
            symbol_chunk = self.chunks_by_symbol.get((file_path, node_type, short_name))

        if symbol_chunk:
            return {
                "file_path": symbol_chunk.file_path,
                "symbol_name": symbol_chunk.symbol_name,
                "symbol_type": symbol_chunk.symbol_type,
                "start_line": symbol_chunk.start_line,
                "end_line": symbol_chunk.end_line,
                "source_code": symbol_chunk.source_code,
                "similarity_score": None,
                "retrieval_sources": ["structural"],
            }

        # Otherwise extract from source file
        file_obj = self.files_by_path.get(file_path)
        if not file_obj:
            return None

        content = file_obj.get("source_content", "")
        lines = content.splitlines(keepends=True)
        total_lines = len(lines) if lines else 1
        start = max(1, node.get("start_line") or 1)
        end = min(total_lines, max(start, node.get("end_line") or total_lines))
        source_code = "".join(lines[start - 1 : end]) if lines else content

        return {
            "file_path": file_path,
            "symbol_name": display_name,
            "symbol_type": node_type,
            "start_line": start,
            "end_line": end,
            "source_code": source_code,
            "similarity_score": None,
            "retrieval_sources": ["structural"],
        }

    def _find_node_id_for_candidate(self, candidate: Dict[str, Any]) -> Optional[str]:
        file_path = candidate.get("file_path") or ""
        symbol_name = candidate.get("symbol_name") or ""
        sym_type = (candidate.get("symbol_type") or "").upper()
        start = candidate.get("start_line")
        end = candidate.get("end_line")

        if sym_type == "FILE":
            cand_id = f"file:{file_path}"
            if cand_id in self.nodes_by_id:
                return cand_id

        if sym_type == "CLASS":
            cand_id = f"class:{file_path}:{symbol_name}"
            if cand_id in self.nodes_by_id:
                return cand_id

        if sym_type in ("FUNCTION", "ASYNC_FUNCTION"):
            cand_id = f"func:{file_path}:{symbol_name}"
            if cand_id in self.nodes_by_id:
                return cand_id

        # Fallback search across nodes for exact line range or matching method name
        for nid, node in self.nodes_by_id.items():
            if node.get("file_path") == file_path:
                if start and end and node.get("start_line") == start and node.get("end_line") == end:
                    return nid
                if symbol_name and (node.get("name") == symbol_name or node.get("name", "").endswith(f".{symbol_name}")):
                    return nid

        return None

    def expand_candidates(
        self,
        candidates: List[Dict[str, Any]],
        max_expansion: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Expands the structural neighborhood around seed candidates using AST relationships.
        Priority:
        1. calls (callees and callers)
        2. contains (class members, enclosing class/file)
        3. imports (internal dependencies)
        """
        if not candidates or not self.graph:
            return []

        call_expansions: List[Dict[str, Any]] = []
        contains_expansions: List[Dict[str, Any]] = []
        import_expansions: List[Dict[str, Any]] = []

        seen_node_ids: Set[str] = set()

        for cand in candidates:
            seed_id = self._find_node_id_for_candidate(cand)
            if not seed_id:
                continue

            # 1. Calls: callees (outgoing calls) and callers (incoming calls)
            for edge in self.outgoing_edges.get(seed_id, []):
                if edge.get("type") == "calls":
                    tgt = edge.get("target")
                    if tgt and tgt != seed_id and tgt not in seen_node_ids:
                        c_dict = self._node_to_candidate(tgt)
                        if c_dict:
                            call_expansions.append(c_dict)
                            seen_node_ids.add(tgt)

            for edge in self.incoming_edges.get(seed_id, []):
                if edge.get("type") == "calls":
                    src = edge.get("source")
                    if src and src != seed_id and src not in seen_node_ids:
                        c_dict = self._node_to_candidate(src)
                        if c_dict:
                            call_expansions.append(c_dict)
                            seen_node_ids.add(src)

            # 2. Contains: enclosing container (incoming contains) or contained members (outgoing contains)
            for edge in self.outgoing_edges.get(seed_id, []):
                if edge.get("type") == "contains":
                    tgt = edge.get("target")
                    if tgt and tgt != seed_id and tgt not in seen_node_ids:
                        c_dict = self._node_to_candidate(tgt)
                        if c_dict:
                            contains_expansions.append(c_dict)
                            seen_node_ids.add(tgt)

            for edge in self.incoming_edges.get(seed_id, []):
                if edge.get("type") == "contains":
                    src = edge.get("source")
                    if src and src != seed_id and src not in seen_node_ids:
                        c_dict = self._node_to_candidate(src)
                        if c_dict:
                            contains_expansions.append(c_dict)
                            seen_node_ids.add(src)

            # 3. Imports: imported internal files (outgoing) and importing files (incoming)
            for edge in self.outgoing_edges.get(seed_id, []):
                if edge.get("type") == "imports":
                    tgt = edge.get("target")
                    if tgt and tgt != seed_id and tgt not in seen_node_ids:
                        c_dict = self._node_to_candidate(tgt)
                        if c_dict:
                            import_expansions.append(c_dict)
                            seen_node_ids.add(tgt)

            for edge in self.incoming_edges.get(seed_id, []):
                if edge.get("type") == "imports":
                    src = edge.get("source")
                    if src and src != seed_id and src not in seen_node_ids:
                        c_dict = self._node_to_candidate(src)
                        if c_dict:
                            import_expansions.append(c_dict)
                            seen_node_ids.add(src)

        # Sort within each category deterministically
        def sort_key(item: Dict[str, Any]):
            return (item.get("file_path", ""), item.get("symbol_name", ""), item.get("start_line", 0))

        call_expansions.sort(key=sort_key)
        contains_expansions.sort(key=sort_key)
        import_expansions.sort(key=sort_key)

        combined = call_expansions + contains_expansions + import_expansions
        return combined[:max_expansion] if max_expansion > 0 else combined


class HybridRetriever:
    """
    Orchestrates hybrid retrieval merging evidence from:
    1. Semantic retrieval (Sentence Transformers + FAISS): finds conceptually related code.
    2. Structural retrieval (AST + architecture graph): expands known code relationships.
    Deduplicates candidates and preserves source metadata.
    Intentionally has NO reranker or LLM.
    """

    def __init__(
        self,
        chunks: List[CodeChunk],
        graph: Dict[str, Any],
        files: Optional[List[Dict[str, Any]]] = None,
    ):
        self.semantic_retriever = SemanticRetriever(chunks)
        self.structural_retriever = StructuralRetriever(graph=graph, chunks=chunks, files=files)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        max_structural_expansion: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval:
        1. Runs semantic retrieval to obtain initial top-k candidates.
        2. Expands semantic candidates using structural relationships (callers, callees, containment, imports).
        3. Merges and deduplicates candidates, preserving FAISS scores for semantic results
           and setting similarity_score: null for structural-only candidates.
        4. Returns deterministically ordered hybrid results:
           - Candidates found semantically (ordered by FAISS similarity score).
           - Structurally expanded candidates (ordered deterministically by relationship priority).
        """
        if not query or not query.strip():
            return []

        # 1. Semantic retrieval
        semantic_results = self.semantic_retriever.retrieve(query=query, top_k=top_k)

        # 2. Structural expansion from semantic seeds
        structural_results = self.structural_retriever.expand_candidates(
            candidates=semantic_results,
            max_expansion=max_structural_expansion,
        )

        # 3. Deduplicate and merge candidates
        merged_results: List[Dict[str, Any]] = []
        seen_keys: Dict[tuple, Dict[str, Any]] = {}

        # Add semantic candidates first (preserving FAISS ranking)
        for item in semantic_results:
            key = (
                item["file_path"],
                item["symbol_type"].upper(),
                item["symbol_name"],
                item["start_line"],
                item["end_line"],
            )
            item_copy = dict(item)
            item_copy["retrieval_sources"] = ["semantic"]
            seen_keys[key] = item_copy
            merged_results.append(item_copy)

        # Merge structural candidates
        for item in structural_results:
            key = (
                item["file_path"],
                item["symbol_type"].upper(),
                item["symbol_name"],
                item["start_line"],
                item["end_line"],
            )
            if key in seen_keys:
                existing = seen_keys[key]
                if "structural" not in existing["retrieval_sources"]:
                    existing["retrieval_sources"].append("structural")
            else:
                item_copy = dict(item)
                item_copy["similarity_score"] = None
                item_copy["retrieval_sources"] = ["structural"]
                seen_keys[key] = item_copy
                merged_results.append(item_copy)

        return merged_results
