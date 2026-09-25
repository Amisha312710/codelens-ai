import ast
from typing import Any, Dict, List, Optional, Set

from app.services.repository_service import RepositoryService


def _get_call_name(node: ast.AST) -> Optional[str]:
    """
    Extracts the syntactic call expression name without runtime resolution.
    Examples:
      calculate() -> "calculate"
      service.process() -> "service.process"
      self.logger.info() -> "self.logger.info"
    """
    if isinstance(node, ast.Name):
        return node.id
    elif isinstance(node, ast.Attribute):
        value_name = _get_call_name(node.value)
        if value_name:
            return f"{value_name}.{node.attr}"
        return node.attr
    elif isinstance(node, ast.Call):
        value_name = _get_call_name(node.func)
        if value_name:
            return value_name
    return None


class CodeASTVisitor(ast.NodeVisitor):
    """
    Traverses the Python AST to extract functions, classes, imports,
    and syntactic function calls with their enclosing caller context.
    """

    def __init__(self):
        self.functions: List[Dict[str, Any]] = []
        self.classes: List[Dict[str, Any]] = []
        self.imports: List[Dict[str, Any]] = []
        self.function_calls: List[Dict[str, Any]] = []
        self.scope_stack: List[str] = []

    def _current_caller(self) -> str:
        """Returns the immediate enclosing function/method name or '<module>'."""
        if self.scope_stack:
            return self.scope_stack[-1]
        return "<module>"

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.functions.append({
            "name": node.name,
            "start_line": node.lineno,
            "end_line": node.end_lineno or node.lineno,
            "is_async": False,
        })
        self.scope_stack.append(node.name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self.functions.append({
            "name": node.name,
            "start_line": node.lineno,
            "end_line": node.end_lineno or node.lineno,
            "is_async": True,
        })
        self.scope_stack.append(node.name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_ClassDef(self, node: ast.ClassDef):
        self.classes.append({
            "name": node.name,
            "start_line": node.lineno,
            "end_line": node.end_lineno or node.lineno,
        })
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({
                "module": None,
                "name": alias.name,
                "alias": alias.asname,
                "line_number": node.lineno,
            })
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        module_name = node.module
        if node.level and node.level > 0:
            prefix = "." * node.level
            module_name = f"{prefix}{node.module}" if node.module else prefix

        for alias in node.names:
            self.imports.append({
                "module": module_name,
                "name": alias.name,
                "alias": alias.asname,
                "line_number": node.lineno,
            })
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        called_name = _get_call_name(node.func)
        if called_name:
            self.function_calls.append({
                "caller": self._current_caller(),
                "called_function": called_name,
                "line_number": node.lineno,
            })
        self.generic_visit(node)


class AnalysisService:
    def __init__(self, db_session=None):
        self.db = db_session

    def analyze_python_code(self, source_code: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Parses and analyzes Python source code using the built-in ast module.
        Extracts functions, classes, imports, function calls, line ranges,
        and syntax errors without executing any repository code.
        """
        try:
            tree = ast.parse(source_code, filename=file_path or "<source>")
        except SyntaxError as e:
            return {
                "file_path": file_path,
                "functions": [],
                "classes": [],
                "imports": [],
                "function_calls": [],
                "syntax_error": {
                    "message": str(e.msg),
                    "line_number": e.lineno,
                    "offset": e.offset,
                },
            }

        visitor = CodeASTVisitor()
        visitor.visit(tree)

        return {
            "file_path": file_path,
            "functions": visitor.functions,
            "classes": visitor.classes,
            "imports": visitor.imports,
            "function_calls": visitor.function_calls,
            "syntax_error": None,
        }

    def analyze_repository(self, repo_url: str) -> Dict[str, Any]:
        """
        Safely ingests a public GitHub repository, runs AST analysis across all Python files,
        and syntactically resolves file-to-file import dependencies.
        """
        # 1. Safely acquire repository source files via existing ingestion
        repo_service = RepositoryService(db_session=self.db)
        repo_data = repo_service.ingest_repository(repo_url)

        all_files = repo_data.get("files", [])
        python_files = [
            f for f in all_files
            if f.get("file_extension") == ".py" or f.get("language") == "Python"
        ]

        # 2. Build internal module lookup index from relative file paths
        module_to_file: Dict[str, str] = {}
        for f in python_files:
            rel_path = f["relative_path"]
            if rel_path.endswith(".py"):
                path_without_ext = rel_path[:-3]
                dotted = path_without_ext.replace("/", ".")
                if dotted.endswith(".__init__"):
                    pkg_dotted = dotted[:-9]
                    module_to_file[pkg_dotted] = rel_path
                    module_to_file[dotted] = rel_path
                else:
                    module_to_file[dotted] = rel_path

                # Handle common src/ directory prefix
                if rel_path.startswith("src/"):
                    src_stripped = rel_path[4:-3]
                    src_dotted = src_stripped.replace("/", ".")
                    if src_dotted.endswith(".__init__"):
                        module_to_file[src_dotted[:-9]] = rel_path
                        module_to_file[src_dotted] = rel_path
                    else:
                        module_to_file[src_dotted] = rel_path

        # 3. Analyze each Python file using the existing AST analyzer
        analyzed_files: List[Dict[str, Any]] = []
        total_functions = 0
        total_classes = 0

        for f in python_files:
            file_result = self.analyze_python_code(
                source_code=f["source_content"],
                file_path=f["relative_path"],
            )
            analyzed_files.append(file_result)
            total_functions += len(file_result.get("functions", []))
            total_classes += len(file_result.get("classes", []))

        # 4. Syntactically resolve file dependencies from imports
        dependencies: List[Dict[str, Any]] = []

        for file_res in analyzed_files:
            source_file = file_res["file_path"] or ""
            source_parts = source_file.split("/")
            source_dir_parts = source_parts[:-1]

            # Group imports by (module_str, line_number)
            grouped_imports: Dict[tuple, List[str]] = {}
            for imp in file_res.get("imports", []):
                mod_str = imp.get("module") or imp.get("name")
                key = (mod_str, imp.get("line_number", 0))
                grouped_imports.setdefault(key, []).append(imp["name"])

            for (mod_str, line_no), names in grouped_imports.items():
                target_file: Optional[str] = None
                is_internal = False

                if mod_str:
                    # Check for relative import (leading dots)
                    if mod_str.startswith("."):
                        num_dots = len(mod_str) - len(mod_str.lstrip("."))
                        remainder = mod_str.lstrip(".")
                        levels_up = num_dots - 1
                        if len(source_dir_parts) >= levels_up:
                            base_parts = source_dir_parts[:len(source_dir_parts) - levels_up] if levels_up > 0 else list(source_dir_parts)
                        else:
                            base_parts = []

                        if remainder:
                            candidate_dotted = ".".join(base_parts + remainder.split("."))
                            if candidate_dotted in module_to_file:
                                target_file = module_to_file[candidate_dotted]
                                is_internal = True
                        else:
                            # e.g., 'from . import foo' where foo is in names
                            for name in names:
                                sibling_candidate = ".".join(base_parts + [name])
                                if sibling_candidate in module_to_file:
                                    target_file = module_to_file[sibling_candidate]
                                    is_internal = True
                                    break
                            if not target_file:
                                candidate_dotted = ".".join(base_parts)
                                if candidate_dotted in module_to_file:
                                    target_file = module_to_file[candidate_dotted]
                                    is_internal = True
                    else:
                        # Absolute import candidate
                        if mod_str in module_to_file:
                            target_file = module_to_file[mod_str]
                            is_internal = True
                        else:
                            local_candidate = ".".join(source_dir_parts + [mod_str])
                            if local_candidate in module_to_file:
                                target_file = module_to_file[local_candidate]
                                is_internal = True
                            else:
                                parts = mod_str.split(".")
                                for i in range(len(parts) - 1, 0, -1):
                                    parent_mod = ".".join(parts[:i])
                                    if parent_mod in module_to_file:
                                        target_file = module_to_file[parent_mod]
                                        is_internal = True
                                        break

                dependencies.append({
                    "source_file": source_file,
                    "target_file": target_file,
                    "imported_module": mod_str or "",
                    "imported_names": names,
                    "line_number": line_no,
                    "is_internal": is_internal,
                })

        return {
            "repository_url": repo_data.get("repository_url", repo_url),
            "repository_name": repo_data.get("repository_name", ""),
            "total_files": repo_data.get("total_files", len(all_files)),
            "python_files_analyzed": len(python_files),
            "total_functions": total_functions,
            "total_classes": total_classes,
            "files": analyzed_files,
            "dependencies": dependencies,
        }

    def build_architecture_graph(self, repo_url: str) -> Dict[str, Any]:
        """
        Constructs a source-derived architecture graph representation of the repository.
        Nodes: file, class, function
        Edges: contains, imports, calls
        Uses strictly unambiguous, source-derived AST relationships.
        """
        analysis_data = self.analyze_repository(repo_url)

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        seen_node_ids: Set[str] = set()
        seen_edge_ids: Set[str] = set()

        file_functions: Dict[str, Dict[str, str]] = {}
        function_nodes_by_scope: Dict[str, Dict[str, str]] = {}

        # 1. Build Nodes (file, class, function) and 'contains' Edges
        for f_res in analysis_data.get("files", []):
            file_path = f_res.get("file_path") or ""
            if not file_path:
                continue

            file_node_id = f"file:{file_path}"
            if file_node_id not in seen_node_ids:
                nodes.append({
                    "id": file_node_id,
                    "type": "file",
                    "name": file_path,
                    "file_path": file_path,
                    "start_line": None,
                    "end_line": None,
                })
                seen_node_ids.add(file_node_id)

            file_classes = f_res.get("classes", [])
            file_funcs = f_res.get("functions", [])

            # Class nodes
            for cls in file_classes:
                class_node_id = f"class:{file_path}:{cls['name']}"
                if class_node_id not in seen_node_ids:
                    nodes.append({
                        "id": class_node_id,
                        "type": "class",
                        "name": cls["name"],
                        "file_path": file_path,
                        "start_line": cls.get("start_line"),
                        "end_line": cls.get("end_line"),
                    })
                    seen_node_ids.add(class_node_id)

                # contains: file -> class
                c_edge_id = f"contains:{file_node_id}->{class_node_id}"
                if c_edge_id not in seen_edge_ids:
                    edges.append({
                        "id": c_edge_id,
                        "source": file_node_id,
                        "target": class_node_id,
                        "type": "contains",
                    })
                    seen_edge_ids.add(c_edge_id)

            # Function nodes (distinguishing methods and top-level functions)
            for func in file_funcs:
                func_name = func["name"]
                f_start = func.get("start_line", 0)
                f_end = func.get("end_line", 0)

                # Check if enclosed in any class in this file
                enclosing_class = None
                for cls in file_classes:
                    if cls.get("start_line", 0) <= f_start and f_end <= cls.get("end_line", 0):
                        enclosing_class = cls["name"]
                        break

                if enclosing_class:
                    func_node_id = f"func:{file_path}:{enclosing_class}.{func_name}"
                    display_name = f"{enclosing_class}.{func_name}"
                    class_node_id = f"class:{file_path}:{enclosing_class}"
                    # contains: class -> method
                    c_edge_id = f"contains:{class_node_id}->{func_node_id}"
                    if c_edge_id not in seen_edge_ids:
                        edges.append({
                            "id": c_edge_id,
                            "source": class_node_id,
                            "target": func_node_id,
                            "type": "contains",
                        })
                        seen_edge_ids.add(c_edge_id)
                else:
                    func_node_id = f"func:{file_path}:{func_name}"
                    display_name = func_name
                    # contains: file -> top-level function
                    c_edge_id = f"contains:{file_node_id}->{func_node_id}"
                    if c_edge_id not in seen_edge_ids:
                        edges.append({
                            "id": c_edge_id,
                            "source": file_node_id,
                            "target": func_node_id,
                            "type": "contains",
                        })
                        seen_edge_ids.add(c_edge_id)

                if func_node_id not in seen_node_ids:
                    nodes.append({
                        "id": func_node_id,
                        "type": "function",
                        "name": display_name,
                        "file_path": file_path,
                        "start_line": f_start,
                        "end_line": f_end,
                    })
                    seen_node_ids.add(func_node_id)

                file_functions.setdefault(file_path, {})[func_name] = func_node_id
                function_nodes_by_scope.setdefault(file_path, {})[func_name] = func_node_id
                if enclosing_class:
                    function_nodes_by_scope[file_path][f"{enclosing_class}.{func_name}"] = func_node_id

        # 2. Build 'imports' Edges (file -> file)
        for dep in analysis_data.get("dependencies", []):
            if dep.get("is_internal") and dep.get("target_file"):
                src_node = f"file:{dep['source_file']}"
                tgt_node = f"file:{dep['target_file']}"
                if src_node in seen_node_ids and tgt_node in seen_node_ids and src_node != tgt_node:
                    imp_edge_id = f"imports:{src_node}->{tgt_node}"
                    if imp_edge_id not in seen_edge_ids:
                        edges.append({
                            "id": imp_edge_id,
                            "source": src_node,
                            "target": tgt_node,
                            "type": "imports",
                        })
                        seen_edge_ids.add(imp_edge_id)

        # 3. Build 'calls' Edges (function -> function)
        # Strict Rule: Only create an edge when the target can be resolved unambiguously
        # from existing AST and repository-level import information.
        for f_res in analysis_data.get("files", []):
            file_path = f_res.get("file_path") or ""
            calls = f_res.get("function_calls", [])
            imports = f_res.get("imports", [])

            # Index internal imports for this file
            imported_symbols_to_file: Dict[str, str] = {}
            imported_modules_to_file: Dict[str, str] = {}

            for dep in analysis_data.get("dependencies", []):
                if dep.get("source_file") == file_path and dep.get("is_internal") and dep.get("target_file"):
                    tgt = dep["target_file"]
                    mod_str = dep.get("imported_module", "")
                    if mod_str:
                        imported_modules_to_file[mod_str] = tgt
                        last_part = mod_str.rstrip(".").split(".")[-1]
                        if last_part:
                            imported_modules_to_file[last_part] = tgt
                    for name in dep.get("imported_names", []):
                        imported_symbols_to_file[name] = tgt
                        if tgt.endswith(f"/{name}.py") or tgt == f"{name}.py":
                            imported_modules_to_file[name] = tgt

            for imp in imports:
                alias = imp.get("alias")
                name = imp.get("name")
                if alias and name in imported_symbols_to_file:
                    imported_symbols_to_file[alias] = imported_symbols_to_file[name]
                if alias and name in imported_modules_to_file:
                    imported_modules_to_file[alias] = imported_modules_to_file[name]

            for call in calls:
                caller = call.get("caller")
                called_func = call.get("called_function", "")

                if not caller or caller == "<module>":
                    continue

                source_id = function_nodes_by_scope.get(file_path, {}).get(caller)
                if not source_id:
                    continue

                target_id = None

                # Case A: Same-file call to a uniquely defined function
                if "." not in called_func:
                    if called_func in file_functions.get(file_path, {}):
                        target_id = file_functions[file_path][called_func]
                elif called_func.startswith("self."):
                    method_name = called_func[5:]
                    if "." in caller:
                        cls_name = caller.split(".")[0]
                        scoped_name = f"{cls_name}.{method_name}"
                        if scoped_name in function_nodes_by_scope.get(file_path, {}):
                            target_id = function_nodes_by_scope[file_path][scoped_name]

                # Case B: Cross-file call via unambiguous internal import
                if not target_id:
                    # B1. Directly imported function name: from module import func; func()
                    if "." not in called_func and called_func in imported_symbols_to_file:
                        target_file = imported_symbols_to_file[called_func]
                        if called_func in file_functions.get(target_file, {}):
                            target_id = file_functions[target_file][called_func]

                    # B2. Module-prefixed call: import module; module.func()
                    elif "." in called_func and not called_func.startswith("self."):
                        parts = called_func.split(".")
                        if len(parts) == 2:
                            mod_prefix, fn_name = parts[0], parts[1]
                            target_file = imported_modules_to_file.get(mod_prefix) or imported_symbols_to_file.get(mod_prefix)
                            if target_file and fn_name in file_functions.get(target_file, {}):
                                target_id = file_functions[target_file][fn_name]

                # Create edge only if target_id resolved to a known function node
                if target_id and target_id in seen_node_ids and source_id != target_id:
                    call_edge_id = f"calls:{source_id}->{target_id}"
                    if call_edge_id not in seen_edge_ids:
                        edges.append({
                            "id": call_edge_id,
                            "source": source_id,
                            "target": target_id,
                            "type": "calls",
                        })
                        seen_edge_ids.add(call_edge_id)

        return {
            "repository_url": analysis_data.get("repository_url", repo_url),
            "repository_name": analysis_data.get("repository_name", ""),
            "nodes": nodes,
            "edges": edges,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
        }

    def get_file_source(
        self,
        repo_url: str,
        file_path: str,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Safely retrieves source code for a specific repository file,
        attaching requested line boundaries for code viewer navigation.
        """
        repo_service = RepositoryService(db_session=self.db)
        result = repo_service.get_file_source(repo_url=repo_url, file_path=file_path)
        result["start_line"] = start_line
        result["end_line"] = end_line
        return result

    def start_analysis(self, repository_id: int):
        raise NotImplementedError("AnalysisService.start_analysis is scheduled for future implementation.")

    def get_analysis_status(self, analysis_id: int):
        raise NotImplementedError("AnalysisService.get_analysis_status is scheduled for future implementation.")

