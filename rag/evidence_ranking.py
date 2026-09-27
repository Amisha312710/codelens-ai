"""
CodeLens AI - Deterministic Code Evidence Ranker
Provides explainable, code-aware ranking over hybrid retrieval candidates
using AST symbol metadata, graph relationships, identifier lexical matches,
granularity signals, test intent gating, and duplicate/subsumption resolution.
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

# ==============================================================================
# DETERMINISTIC HEURISTIC WEIGHTS
# ==============================================================================
# All weights are explainable and derived from software engineering principles:
# - Semantic alignment establishes base topic relevance.
# - Dual-path agreement validates candidate robustness.
# - Direct call graph edges capture operational execution flow.
# - Exact identifier matches strongly indicate targeted symbols.
# - Granularity aligns with query abstraction level.
# - Test damping prevents test harnesses from displacing production logic.
# ==============================================================================

W_SEMANTIC: float = 0.40             # Base semantic similarity signal
W_AGREEMENT: float = 0.15            # Consensus bonus when candidate found by both semantic & structural paths
W_CALL_REL: float = 0.20             # Direct caller/callee operational connectivity
W_STRUCT_REL: float = 0.08           # Module import or containment connectivity
W_IDENTIFIER: float = 0.25           # Query-to-identifier match (exact symbol or sub-token overlap)
W_GRANULARITY: float = 0.10          # Symbol granularity alignment with query abstraction level

# Test adjustments
W_TEST_INTENT_BOOST: float = 0.15    # Bonus when query explicitly requests tests
W_TEST_DAMPING: float = 0.25         # Damping for test code during normal implementation queries

# Structural score decay for candidates with similarity_score=None
STRUCTURAL_SEED_DECAY: float = 0.75

# Query intent keyword sets
TEST_INTENT_TERMS = {
    "test", "tests", "testing", "tested", "assert", "assertion",
    "assertions", "mock", "mocks", "mocking", "fixture", "fixtures",
    "spec", "specs", "unittest", "pytest"
}

ARCHITECTURAL_INTENT_TERMS = {
    "architecture", "overview", "module", "modules", "package", "packages",
    "structure", "organization", "system", "design", "component", "components",
    "work", "works", "how"
}

INTERFACE_INTENT_TERMS = {
    "class", "classes", "interface", "interfaces", "type", "types",
    "model", "models", "schema", "schemas", "protocol"
}

STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "is", "are", "was", "were", "be", "been", "being", "do", "does", "did",
    "what", "where", "which", "who", "whom", "how", "why", "when", "can", "could",
    "should", "would", "about", "into", "through", "during", "before", "after",
    "above", "below", "from", "up", "down", "out", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "all", "any", "both", "each", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "s", "t", "just", "don", "shouldn", "now",
    "related", "implemented", "generated"
}


def tokenize_identifier(name: str) -> List[str]:
    """
    Tokenizes a code identifier or path by splitting on camelCase, snake_case,
    slashes, dots, and hyphens. Returns lowercase tokens including composite parts.
    E.g. 'get_answer' -> ['get_answer', 'get', 'answer']
         'TestAdvancedSuite' -> ['testadvancedsuite', 'test', 'advanced', 'suite']
         'sample/helpers.py' -> ['sample', 'helpers', 'py']
    """
    if not name:
        return []

    tokens: Set[str] = set()
    cleaned = name.replace("\\", "/")

    # Split by path separators, dots, hyphens, and underscores
    raw_pieces = re.split(r"[/._\-]+", cleaned)

    for piece in raw_pieces:
        if not piece:
            continue
        piece_lower = piece.lower()
        tokens.add(piece_lower)

        # Split camelCase / PascalCase: e.g. 'TestAdvanced' -> ['Test', 'Advanced']
        camel_parts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)", piece)
        for cp in camel_parts:
            cp_lower = cp.lower()
            if len(cp_lower) > 1:
                tokens.add(cp_lower)

    return list(tokens)


def is_test_candidate(candidate: Dict[str, Any]) -> bool:
    """
    Determines whether a candidate originates from test code using standard conventions:
    tests/, test/, test_*.py, *_test.py.
    """
    file_path = (candidate.get("file_path") or "").replace("\\", "/").lower()
    parts = file_path.split("/")
    filename = parts[-1] if parts else ""
    return (
        any(p in ("tests", "test") for p in parts[:-1])
        or filename.startswith("test_")
        or filename.endswith("_test.py")
        or "test" in parts
    )


def classify_query_intent(query: str) -> Dict[str, bool]:
    """
    Deterministically extracts query intent flags:
    - has_test_intent: whether query specifically asks about testing/asserts
    - has_arch_intent: whether query asks about module/package architecture
    - has_interface_intent: whether query asks about classes/interfaces
    """
    if not query:
        return {"has_test_intent": False, "has_arch_intent": False, "has_interface_intent": False}

    words = set(re.findall(r"\b[a-zA-Z]+\b", query.lower()))
    return {
        "has_test_intent": bool(words & TEST_INTENT_TERMS),
        "has_arch_intent": bool(words & ARCHITECTURAL_INTENT_TERMS),
        "has_interface_intent": bool(words & INTERFACE_INTENT_TERMS),
    }


def filter_and_subsume_duplicates(
    candidates: List[Dict[str, Any]],
    query: str = "",
) -> List[Dict[str, Any]]:
    """
    Resolves identical code spans and hierarchical containment redundancies:
    1. Detects candidates from the same file with identical or near-identical spans.
    2. Prefers finer-grained evidence: FUNCTION > CLASS > FILE.
    3. Merges retrieval_sources and preserves strongest semantic similarity score.
    4. Suppresses redundant containing FILE chunks when inner functions/classes are
       already present as targeted evidence, preventing duplicate top-K slot consumption.
    """
    if not candidates:
        return []

    intent = classify_query_intent(query)
    granularity_priority = {
        "FUNCTION": 3,
        "ASYNC_FUNCTION": 3,
        "CLASS": 2,
        "FILE": 1,
    }

    # Group candidates by file_path
    by_file: Dict[str, List[Dict[str, Any]]] = {}
    for c in candidates:
        fp = c.get("file_path", "")
        by_file.setdefault(fp, []).append(dict(c))

    filtered_candidates: List[Dict[str, Any]] = []

    for file_path, file_cands in by_file.items():
        if len(file_cands) == 1:
            filtered_candidates.append(file_cands[0])
            continue

        # Step 1: Collapse identical or near-identical spans
        # Sort candidates so finer granularity comes first
        file_cands.sort(
            key=lambda c: (
                -granularity_priority.get((c.get("symbol_type") or "").upper(), 0),
                -(c.get("similarity_score") or -999.0),
            )
        )

        surviving_cands: List[Dict[str, Any]] = []
        for cand in file_cands:
            c_start = cand.get("start_line", 1)
            c_end = cand.get("end_line", 1)
            c_len = max(1, c_end - c_start + 1)
            c_code = (cand.get("source_code") or "").strip()

            merged = False
            for survivor in surviving_cands:
                s_start = survivor.get("start_line", 1)
                s_end = survivor.get("end_line", 1)
                s_len = max(1, s_end - s_start + 1)
                s_code = (survivor.get("source_code") or "").strip()

                overlap = max(0, min(c_end, s_end) - max(c_start, s_start) + 1)
                min_span = min(c_len, s_len)
                overlap_ratio = overlap / min_span if min_span > 0 else 0.0

                # Check if identical code or near-identical span (>= 85% overlap)
                if (c_code and c_code == s_code) or overlap_ratio >= 0.85:
                    # Merge retrieval_sources
                    existing_sources = survivor.get("retrieval_sources", [])
                    new_sources = cand.get("retrieval_sources", [])
                    for src in new_sources:
                        if src not in existing_sources:
                            existing_sources.append(src)
                    survivor["retrieval_sources"] = existing_sources

                    # Preserve strongest similarity score
                    scores = [
                        s for s in [survivor.get("similarity_score"), cand.get("similarity_score")]
                        if s is not None
                    ]
                    if scores:
                        survivor["similarity_score"] = max(scores)

                    merged = True
                    break

            if not merged:
                surviving_cands.append(cand)

        # Step 2: Handle FILE vs FUNCTION/CLASS containment
        # If an inner function/class is present in the pool, suppress containing FILE chunk
        # to avoid wasting a separate top-K slot on the enclosing file.
        has_inner_symbols = any(
            (c.get("symbol_type") or "").upper() in ("FUNCTION", "ASYNC_FUNCTION", "CLASS")
            for c in surviving_cands
        )

        if has_inner_symbols:
            pruned: List[Dict[str, Any]] = []
            file_chunk_to_merge: Optional[Dict[str, Any]] = None

            for c in surviving_cands:
                sym_type = (c.get("symbol_type") or "").upper()
                if sym_type == "FILE":
                    file_chunk_to_merge = c
                else:
                    pruned.append(c)

            # Merge file chunk sources into inner symbols
            if file_chunk_to_merge and pruned:
                for inner_c in pruned:
                    existing_sources = inner_c.get("retrieval_sources", [])
                    for src in file_chunk_to_merge.get("retrieval_sources", []):
                        if src not in existing_sources:
                            existing_sources.append(src)
                    inner_c["retrieval_sources"] = existing_sources

            filtered_candidates.extend(pruned)
        else:
            filtered_candidates.extend(surviving_cands)

    return filtered_candidates


class CodeEvidenceRanker:
    """
    Deterministic, explainable Code Evidence Ranker.
    Ranks hybrid candidate pools using:
    - Semantic similarity (normalized FAISS scores)
    - Dual-path retrieval agreement (semantic + structural consensus)
    - Structural graph relationships (direct caller/callee adjacency vs. containment/imports)
    - Identifier lexical relevance (exact symbol matches and sub-token overlap)
    - Context-sensitive symbol granularity
    - Query-gated test damping/boosting
    - Span deduplication and containment subsumption
    """

    def __init__(self, graph: Optional[Dict[str, Any]] = None):
        self.graph = graph or {}
        self._index_graph()

    def _index_graph(self):
        """Builds fast lookup structures for architecture graph nodes and edges."""
        self.nodes_by_id: Dict[str, Dict[str, Any]] = {}
        for node in self.graph.get("nodes", []):
            self.nodes_by_id[node["id"]] = node

        # Adjacency maps: outgoing and incoming edges
        self.call_edges: Dict[str, Set[str]] = {}       # node_id -> set of caller/callee node_ids
        self.struct_edges: Dict[str, Set[str]] = {}     # node_id -> set of contains/imports node_ids

        for edge in self.graph.get("edges", []):
            src = edge.get("source")
            tgt = edge.get("target")
            etype = edge.get("type")
            if not src or not tgt:
                continue

            if etype == "calls":
                self.call_edges.setdefault(src, set()).add(tgt)
                self.call_edges.setdefault(tgt, set()).add(src)
            elif etype in ("contains", "imports"):
                self.struct_edges.setdefault(src, set()).add(tgt)
                self.struct_edges.setdefault(tgt, set()).add(src)

    def _find_node_id_for_candidate(self, candidate: Dict[str, Any]) -> Optional[str]:
        """Resolves candidate metadata to a graph node ID."""
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

        # Fallback search across nodes for matching file and name or line range
        for nid, node in self.nodes_by_id.items():
            if node.get("file_path") == file_path:
                if start and end and node.get("start_line") == start and node.get("end_line") == end:
                    return nid
                if symbol_name and (node.get("name") == symbol_name or node.get("name", "").endswith(f".{symbol_name}")):
                    return nid

        return None

    def _compute_identifier_relevance(
        self,
        candidate: Dict[str, Any],
        query_terms: Set[str],
        raw_query_lower: str,
    ) -> float:
        """
        Calculates lexical identifier match score [0.0, 1.0].
        - Exact match of full symbol name: 1.0
        - Exact match of base symbol (e.g. method without class): 1.0
        - Sub-token and path token overlap ratio: [0.0, 1.0]
        """
        if not query_terms:
            return 0.0

        symbol_name = candidate.get("symbol_name", "")
        file_path = candidate.get("file_path", "")

        sym_lower = symbol_name.lower()
        base_sym_lower = sym_lower.split(".")[-1]

        # Check exact symbol match in query terms or raw query
        if sym_lower in query_terms or (len(sym_lower) >= 3 and f" {sym_lower} " in f" {raw_query_lower} "):
            return 1.0
        if base_sym_lower in query_terms or (len(base_sym_lower) >= 3 and f" {base_sym_lower} " in f" {raw_query_lower} "):
            return 1.0

        # Sub-token overlap
        sym_tokens = set(tokenize_identifier(symbol_name))
        path_tokens = set(tokenize_identifier(file_path))

        # Filter out trivial 1-char tokens
        sym_tokens = {t for t in sym_tokens if len(t) > 1 and t not in STOPWORDS}
        path_tokens = {t for t in path_tokens if len(t) > 1 and t not in STOPWORDS}

        sym_overlap = len(query_terms & sym_tokens)
        path_overlap = len(query_terms & path_tokens)

        total_query_terms = len(query_terms)
        rho_sym = sym_overlap / total_query_terms if total_query_terms > 0 else 0.0
        rho_path = path_overlap / total_query_terms if total_query_terms > 0 else 0.0

        score = 0.70 * rho_sym + 0.30 * rho_path
        return min(1.0, score)

    def _compute_granularity_signal(
        self,
        candidate: Dict[str, Any],
        query_intent: Dict[str, bool],
    ) -> float:
        """
        Calculates symbol granularity score [0.0, W_GRANULARITY]
        based on query abstraction level.
        """
        sym_type = (candidate.get("symbol_type") or "").upper()

        if query_intent["has_arch_intent"]:
            # Module/architectural context query: Both classes and core functions provide structure
            if sym_type in ("FUNCTION", "ASYNC_FUNCTION"):
                return W_GRANULARITY
            elif sym_type == "CLASS":
                return W_GRANULARITY
            else:  # FILE
                return W_GRANULARITY * 0.6
        elif query_intent["has_interface_intent"]:
            # Interface/class level query
            if sym_type == "CLASS":
                return W_GRANULARITY
            elif sym_type in ("FUNCTION", "ASYNC_FUNCTION"):
                return W_GRANULARITY * 0.6
            else:
                return W_GRANULARITY * 0.3
        else:
            # Implementation/behavior query: Functions provide highest density
            if sym_type in ("FUNCTION", "ASYNC_FUNCTION"):
                return W_GRANULARITY
            elif sym_type == "CLASS":
                return W_GRANULARITY * 0.6
            else:
                return W_GRANULARITY * 0.2

    def _compute_test_adjustment(
        self,
        candidate: Dict[str, Any],
        query_intent: Dict[str, bool],
    ) -> float:
        """
        Calculates test adjustment score:
        - Negative damping when query is about production implementation.
        - Positive boost when query explicitly requests tests.
        """
        is_test = is_test_candidate(candidate)
        if is_test:
            if query_intent["has_test_intent"]:
                return W_TEST_INTENT_BOOST
            else:
                return -W_TEST_DAMPING
        return 0.0

    def rank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: Optional[int] = None,
        graph: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Ranks hybrid retrieval candidates using the deterministic Code Evidence formula.
        1. Subsumes duplicate spans and resolves FILE-vs-FUNCTION containment redundancies.
        2. Normalizes semantic scores within the candidate pool.
        3. Identifies graph connectivity (call vs. struct edges) to top semantic seeds.
        4. Calculates lexical identifier matches (exact & sub-token).
        5. Aligns symbol granularity and applies test intent adjustments.
        6. Sorts deterministically and returns top_k candidates.
        """
        if not candidates:
            return []

        if not query or not query.strip():
            # If query is empty, return deduplicated candidates preserving original order
            deduped = filter_and_subsume_duplicates(candidates, query="")
            return deduped[:top_k] if top_k is not None else deduped

        # Update graph if passed dynamically
        if graph is not None:
            self.graph = graph
            self._index_graph()

        # Step 1: Duplicate and containment subsumption
        processed_candidates = filter_and_subsume_duplicates(candidates, query=query)
        if not processed_candidates:
            return []

        # Step 2: Query analysis
        raw_query_lower = query.strip().lower()
        query_intent = classify_query_intent(query)
        has_test_intent = query_intent["has_test_intent"]
        query_words = re.findall(r"\b[a-zA-Z0-9_]+\b", raw_query_lower)
        query_terms = {w for w in query_words if len(w) > 1 and w not in STOPWORDS}

        # Step 3: Identify semantic seeds and normalize semantic scores
        raw_scores = [
            c.get("similarity_score") for c in processed_candidates
            if c.get("similarity_score") is not None
        ]

        if raw_scores:
            s_min = min(raw_scores)
            s_max = max(raw_scores)
            score_range = s_max - s_min
        else:
            s_min, s_max, score_range = 0.0, 0.0, 0.0

        # Semantic seeds: prioritize production candidates when query does not request tests
        production_seeds: List[Tuple[str, float]] = []
        test_seeds: List[Tuple[str, float]] = []
        candidate_node_map: Dict[int, Optional[str]] = {}

        for idx, c in enumerate(processed_candidates):
            nid = self._find_node_id_for_candidate(c)
            candidate_node_map[idx] = nid
            if "semantic" in c.get("retrieval_sources", []) and c.get("similarity_score") is not None and nid:
                raw_s = float(c["similarity_score"])
                norm_s = (raw_s - s_min) / score_range if score_range > 1e-6 else 1.0
                if is_test_candidate(c):
                    test_seeds.append((nid, norm_s))
                else:
                    production_seeds.append((nid, norm_s))

        production_seeds.sort(key=lambda s: s[1], reverse=True)
        test_seeds.sort(key=lambda s: s[1], reverse=True)

        if has_test_intent:
            semantic_seeds = test_seeds + production_seeds
        else:
            semantic_seeds = production_seeds if production_seeds else test_seeds

        top_seed_ids = {s[0] for s in semantic_seeds[:3]}

        # Collect node IDs of all production candidates in the candidate pool
        pool_prod_node_ids = {
            candidate_node_map[i] for i, c in enumerate(processed_candidates)
            if candidate_node_map[i] and not is_test_candidate(c)
        }

        # Step 4: Score each candidate
        scored_candidates: List[Tuple[float, Dict[str, Any]]] = []

        for idx, cand in enumerate(processed_candidates):
            cand_copy = dict(cand)
            nid = candidate_node_map.get(idx)
            is_test = is_test_candidate(cand_copy)

            # 1. Semantic relevance (normalized or decayed from seed)
            raw_sim = cand_copy.get("similarity_score")
            if raw_sim is not None:
                norm_sim = (float(raw_sim) - s_min) / score_range if score_range > 1e-6 else 1.0
                sem_internal = norm_sim
            else:
                # Structural candidate: inherit decayed semantic relevance if connected to seed or pool node
                inherited = 0.0
                if nid and semantic_seeds:
                    for seed_id, seed_score in semantic_seeds:
                        if seed_id in self.call_edges.get(nid, set()) or seed_id in self.struct_edges.get(nid, set()):
                            inherited = max(inherited, seed_score * STRUCTURAL_SEED_DECAY)
                sem_internal = inherited

            # 2. Retrieval agreement: for operational queries, only production candidates earn agreement validation
            sources = cand_copy.get("retrieval_sources", [])
            has_agreement = ("semantic" in sources and "structural" in sources)
            if is_test and not has_test_intent:
                agreement_val = 0.0
            else:
                agreement_val = 1.0 if has_agreement else 0.0

            # 3. Structural relationship (call vs struct)
            has_call_rel = False
            has_struct_rel = False
            if nid:
                cand_call_neighbors = self.call_edges.get(nid, set())
                cand_struct_neighbors = self.struct_edges.get(nid, set())

                # For operational questions, only production candidates earn execution call credit
                if not is_test or has_test_intent:
                    if bool(top_seed_ids & cand_call_neighbors):
                        has_call_rel = True
                    elif bool(pool_prod_node_ids & cand_call_neighbors):
                        # Mutual call relationship with another candidate in the pool
                        has_call_rel = True

                if not has_call_rel:
                    if bool(top_seed_ids & cand_struct_neighbors) or bool(pool_prod_node_ids & cand_struct_neighbors):
                        has_struct_rel = True

            # 4. Identifier relevance
            id_rel = self._compute_identifier_relevance(cand_copy, query_terms, raw_query_lower)

            # 5. Granularity signal
            gran_val = self._compute_granularity_signal(cand_copy, query_intent)

            # 6. Test intent adjustment
            test_adj = self._compute_test_adjustment(cand_copy, query_intent)

            # Final symbolic combination
            final_score = (
                W_SEMANTIC * sem_internal
                + W_AGREEMENT * agreement_val
                + (W_CALL_REL if has_call_rel else (W_STRUCT_REL if has_struct_rel else 0.0))
                + W_IDENTIFIER * id_rel
                + gran_val
                + test_adj
            )

            # Store ranking score internally without modifying similarity_score or reranker_score
            cand_copy["_evidence_score"] = round(final_score, 4)
            scored_candidates.append((final_score, cand_copy))

        # Deterministic sorting: highest score first, then file_path, symbol_name, start_line
        scored_candidates.sort(
            key=lambda item: (
                -item[0],
                item[1].get("file_path", ""),
                item[1].get("symbol_name", ""),
                item[1].get("start_line", 0),
            )
        )

        ranked_results = [item[1] for item in scored_candidates]
        if top_k is not None and top_k > 0:
            return ranked_results[:top_k]
        return ranked_results
