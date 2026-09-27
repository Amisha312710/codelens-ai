"""
Flow Service
Business logic layer for AST-based code flow and call hierarchy tracing.
Derives static function call relationships directly from the repository's
existing AST and architecture graph without runtime execution or LLM invention.
"""

from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException

from app.services.analysis_service import AnalysisService


class FlowService:
    def __init__(self, db_session=None):
        self.db = db_session
        self.analysis_service = AnalysisService(db_session=self.db)

    def trace_flow(
        self,
        repo_url: str,
        root_function: str,
        max_depth: int = 3,
    ) -> Dict[str, Any]:
        """
        Traces the static call flow starting from a root function up to max_depth (1–3).
        Reuses existing architecture graph call relationships.
        Avoids cycles, avoids duplicates, and ignores unresolved external calls.
        """
        clean_url = (repo_url or "").strip()
        if not clean_url:
            raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

        clean_func = (root_function or "").strip()
        if not clean_func:
            raise HTTPException(status_code=400, detail="Root function cannot be empty.")

        # Strict depth enforcement (1–3 only, default 3)
        if max_depth < 1 or max_depth > 3:
            raise HTTPException(
                status_code=400,
                detail=f"Call depth must be strictly between 1 and 3 (received {max_depth}).",
            )

        # 1. Acquire existing architecture graph
        graph = self.analysis_service.build_architecture_graph(repo_url=clean_url)

        all_nodes = graph.get("nodes", [])
        all_edges = graph.get("edges", [])

        # 2. Filter to function nodes and index by ID
        func_nodes = [n for n in all_nodes if n.get("type") == "function"]
        func_nodes_by_id: Dict[str, Dict[str, Any]] = {n["id"]: n for n in func_nodes}

        if not func_nodes:
            raise HTTPException(
                status_code=404,
                detail="No Python functions were discovered in this repository.",
            )

        # 3. Locate root function
        root_node = self._find_root_function(clean_func, func_nodes)
        if not root_node:
            raise HTTPException(
                status_code=404,
                detail=f"We couldn't find function '{clean_func}' in this repository.",
            )

        # 4. Build deterministic adjacency list from existing 'calls' edges
        outgoing_calls: Dict[str, List[str]] = {}
        for edge in all_edges:
            if edge.get("type") == "calls":
                src = edge.get("source")
                tgt = edge.get("target")
                # Strict Rule: Only include edges where both source and target are internal repo functions
                if src in func_nodes_by_id and tgt in func_nodes_by_id:
                    outgoing_calls.setdefault(src, []).append(tgt)

        # Deterministic sorting of targets (by name, file path, line)
        for src in outgoing_calls:
            outgoing_calls[src].sort(
                key=lambda tid: (
                    func_nodes_by_id[tid].get("name", ""),
                    func_nodes_by_id[tid].get("file_path", ""),
                    func_nodes_by_id[tid].get("start_line", 0),
                )
            )

        # 5. Breadth-First Traversal bounded by max_depth
        visited_ids: Set[str] = {root_node["id"]}
        queue: List[tuple] = [(root_node["id"], 1)]  # (node_id, depth)

        collected_nodes: List[Dict[str, Any]] = [root_node]
        collected_edges: List[Dict[str, Any]] = []
        seen_edges: Set[tuple] = set()

        while queue:
            curr_id, curr_depth = queue.pop(0)

            # Do not traverse past max_depth
            if curr_depth >= max_depth:
                continue

            for target_id in outgoing_calls.get(curr_id, []):
                # Ignore self-recursion edge or cycle
                if curr_id == target_id:
                    continue

                edge_key = (curr_id, target_id)
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    src_node = func_nodes_by_id[curr_id]
                    tgt_node = func_nodes_by_id[target_id]
                    collected_edges.append({
                        "source": curr_id,
                        "target": target_id,
                        "type": "CALLS",
                        "source_name": src_node.get("name"),
                        "target_name": tgt_node.get("name"),
                    })

                if target_id not in visited_ids:
                    visited_ids.add(target_id)
                    collected_nodes.append(func_nodes_by_id[target_id])
                    queue.append((target_id, curr_depth + 1))

        # 6. Format nodes containing only useful source information
        formatted_nodes = [
            {
                "id": n["id"],
                "name": n["name"],
                "type": n.get("type", "function"),
                "file_path": n.get("file_path", ""),
                "start_line": n.get("start_line"),
                "end_line": n.get("end_line"),
            }
            for n in collected_nodes
        ]

        return {
            "repository_url": clean_url,
            "root_function": root_node.get("name", clean_func),
            "nodes": formatted_nodes,
            "edges": collected_edges,
            "total_nodes": len(formatted_nodes),
            "total_edges": len(collected_edges),
        }

    def list_repository_functions(self, repo_url: str) -> List[Dict[str, Any]]:
        """
        Returns a sorted, compact list of all functions discovered in the repository
        to populate the Code Flow search selector.
        """
        clean_url = (repo_url or "").strip()
        if not clean_url:
            raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

        graph = self.analysis_service.build_architecture_graph(repo_url=clean_url)
        funcs = [n for n in graph.get("nodes", []) if n.get("type") == "function"]

        funcs.sort(
            key=lambda x: (
                x.get("file_path", ""),
                x.get("start_line", 0),
                x.get("name", ""),
            )
        )

        return [
            {
                "id": f["id"],
                "name": f["name"],
                "type": "function",
                "file_path": f["file_path"],
                "start_line": f.get("start_line"),
                "end_line": f.get("end_line"),
            }
            for f in funcs
        ]

    def _find_root_function(
        self,
        query: str,
        function_nodes: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        """
        Deterministically matches a requested root function identifier against
        discovered function nodes in the repository.
        """
        clean = query.strip()
        if clean.endswith("()"):
            clean = clean[:-2].strip()

        # 1. Exact node ID match
        for n in function_nodes:
            if n["id"] == clean:
                return n

        # 2. Exact function name match (e.g. "hmm", "get_answer")
        exact_matches = [n for n in function_nodes if n["name"] == clean]
        if len(exact_matches) == 1:
            return exact_matches[0]
        elif len(exact_matches) > 1:
            # If multiple functions have the same name in different files, pick first
            return exact_matches[0]

        # 3. File-qualified match (e.g. "sample/core.py:hmm" or "core.py:hmm")
        for n in function_nodes:
            path_plus_name = f"{n['file_path']}:{n['name']}"
            if clean in path_plus_name or path_plus_name.endswith(clean):
                return n

        # 4. Scoped/method name match (e.g. "AdvancedTestSuite.test_thoughts")
        for n in function_nodes:
            if "." in clean and n["name"].endswith(clean):
                return n

        # 5. Case-insensitive exact name match
        lower_clean = clean.lower()
        for n in function_nodes:
            if n["name"].lower() == lower_clean:
                return n

        return None

