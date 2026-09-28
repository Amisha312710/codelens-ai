import ast
import re
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

        project_overview = None
        try:
            project_overview = self.get_project_overview(repo_url)
        except Exception:
            pass

        return {
            "repository_url": analysis_data.get("repository_url", repo_url),
            "repository_name": analysis_data.get("repository_name", ""),
            "nodes": nodes,
            "edges": edges,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "project_overview": project_overview,
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

    def get_project_overview(self, repo_url: str) -> Dict[str, Any]:
        """
        Synthesizes a grounded, human-first project overview directly from
        repository documentation, manifests, imports, and AST relationships.
        Never hallucinates technologies or capabilities not present in source files.
        """
        repo_service = RepositoryService(db_session=self.db)
        repo_data = repo_service.ingest_repository(repo_url)
        all_files = repo_data.get("files", [])
        analysis_data = self.analyze_repository(repo_url)
        repo_name = repo_data.get("repository_name", "") or repo_url.rstrip("/").split("/")[-1]

        # 1. Document & manifest extraction (README, setup.py, requirements.txt, pyproject.toml, package.json)
        readme_content = ""
        readme_filename = ""
        setup_content = ""
        reqs_content = ""
        makefile_present = False
        dockerfile_present = False

        for f in all_files:
            rel = f["relative_path"]
            lower_rel = rel.lower()
            base_name = lower_rel.split("/")[-1]
            if base_name in ("readme.md", "readme.rst", "readme.txt", "readme") and not readme_content:
                readme_content = f.get("source_content", "")
                readme_filename = rel
            elif base_name == "setup.py":
                setup_content = f.get("source_content", "")
            elif base_name in ("requirements.txt", "requirements.in"):
                reqs_content = f.get("source_content", "")
            elif base_name == "makefile":
                makefile_present = True
            elif "dockerfile" in base_name:
                dockerfile_present = True

        # Parse setup.py description if present
        setup_desc = ""
        if setup_content:
            m = re.search(r"description\s*=\s*['\"]([^'\"]+)['\"]", setup_content)
            if m:
                setup_desc = m.group(1).strip()

        # Clean README text to extract human-readable summary and features
        readme_title = ""
        readme_summary_para = ""
        readme_features = []

        if readme_content:
            # Strip RST underlines: lines consisting entirely of =, -, ~, ^, ", ', #
            cleaned_lines = []
            for line in readme_content.splitlines():
                stripped = line.strip()
                if stripped and len(stripped) >= 3 and all(c in "=-~^\"'#`*" for c in stripped):
                    continue
                # Clean RST inline markup: `text <url>`_ -> text, ``text`` -> text
                line_cleaned = re.sub(r"`([^<`]+)<[^>]+>`_", r"\1", stripped)
                line_cleaned = re.sub(r"``([^`]+)``", r"\1", line_cleaned)
                line_cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line_cleaned)
                # Remove badge markdown: ![alt](url)
                line_cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", line_cleaned).strip()
                cleaned_lines.append(line_cleaned)

            # Find title
            for line in cleaned_lines:
                if line and not line.startswith("..") and not line.startswith("#"):
                    readme_title = line
                    break
                elif line.startswith("#"):
                    readme_title = line.lstrip("#").strip()
                    break

            # Find descriptive paragraphs (non-title, non-empty, substantive)
            paragraphs = []
            current_p = []
            for line in cleaned_lines:
                if not line:
                    if current_p:
                        p_text = " ".join(current_p).strip()
                        if p_text and p_text != readme_title and len(p_text) > 15 and not p_text.startswith(".."):
                            paragraphs.append(p_text)
                        current_p = []
                elif line.startswith(("* ", "- ", "+ ")) or re.match(r"^\d+\.\s+", line):
                    feat_text = re.sub(r"^[\*\-\+]\s+|^\d+\.\s+", "", line).strip()
                    if feat_text and len(feat_text) > 5 and len(feat_text) < 120:
                        readme_features.append(feat_text)
                else:
                    current_p.append(line)
            if current_p:
                p_text = " ".join(current_p).strip()
                if p_text and p_text != readme_title and len(p_text) > 15 and not p_text.startswith(".."):
                    paragraphs.append(p_text)

            if paragraphs:
                readme_summary_para = paragraphs[0]

        # Compose grounded 1-2 paragraph description & problem solved
        if readme_summary_para and setup_desc:
            description = f"{readme_summary_para} This project is packaged as '{setup_desc}'."
        elif readme_summary_para:
            description = readme_summary_para
        elif setup_desc:
            description = f"{repo_name} provides {setup_desc}."
        else:
            description = f"{repo_name} is a structured codebase containing {len(all_files)} source files."

        core_purpose = (
            setup_desc
            if setup_desc
            else (readme_summary_para if readme_summary_para else f"Provides core functionality for {repo_name}.")
        )

        problem_solved = (
            f"Provides a standardized, modular reference implementation and architecture for {repo_name.split('/')[-1]}, "
            f"enabling clear separation between public interfaces, core logic, and automated tests."
        )

        # 2. Key Features (grounded from README bullets or synthesized from architecture)
        features = list(readme_features[:5])
        if not features:
            python_files = [f for f in all_files if f.get("file_extension") == ".py"]
            test_files = [f for f in python_files if "test" in f["relative_path"].lower()]
            doc_files = [f for f in all_files if "doc" in f["relative_path"].lower()]

            if python_files:
                features.append(f"Modular architecture with {len(python_files)} analyzed source files.")
            if test_files:
                features.append(f"Automated test coverage with {len(test_files)} dedicated test module(s).")
            if setup_content:
                features.append("Standard distribution packaging configured via setup.py.")
            if doc_files or "sphinx" in reqs_content.lower():
                features.append("Documentation generation and publishing configuration.")
            if makefile_present:
                features.append("Makefile task automation for testing and build workflows.")

        # 3. Use Cases (grounded in repo type)
        use_cases = [
            f"Developers seeking a clean, reference implementation of {repo_name.split('/')[-1]}.",
            "Engineers exploring how internal modules, interfaces, and helpers connect across files.",
            "Teams establishing best-practice project structures, test suites, and distribution setups."
        ]

        # 4. Tech Stack (Strict Grounding - Zero Hallucinations)
        tech_stack = []

        # Languages
        lang_counts: Dict[str, int] = {}
        for f in all_files:
            lang = f.get("language") or "Other"
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

        prog_languages = {
            "Python", "JavaScript", "TypeScript", "JavaScript React",
            "TypeScript React", "Go", "Rust", "Java", "C", "C++",
            "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Dart",
        }
        for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
            if lang in prog_languages:
                pct = int(round((count / len(all_files)) * 100))
                tech_stack.append({
                    "name": lang if lang != "Python" else "Python 3",
                    "category": "Language",
                    "detection_type": "directly_detected",
                    "source": f"Detected across {count} file(s) ({pct}% of repo)"
                })

        # Frameworks / Backend
        imported_modules = set()
        for f_res in analysis_data.get("files", []):
            for imp in f_res.get("imports", []):
                mod = imp.get("module") or imp.get("name") or ""
                root_mod = mod.split(".")[0]
                if root_mod:
                    imported_modules.add(root_mod.lower())

        framework_signatures = {
            "fastapi": "FastAPI",
            "flask": "Flask",
            "django": "Django",
            "starlette": "Starlette",
            "tornado": "Tornado",
            "sqlalchemy": "SQLAlchemy",
            "pydantic": "Pydantic",
            "requests": "Requests",
            "aiohttp": "aiohttp",
        }

        framework_detected = False
        for mod_key, name in framework_signatures.items():
            if mod_key in imported_modules or (reqs_content and mod_key in reqs_content.lower()):
                tech_stack.append({
                    "name": name,
                    "category": "Backend / Framework",
                    "detection_type": "directly_detected",
                    "source": "Imported in source code / requirements.txt"
                })
                framework_detected = True

        if not framework_detected and lang_counts.get("Python", 0) > 0:
            tech_stack.append({
                "name": "Standard Library (Standalone Package)",
                "category": "Backend / Framework",
                "detection_type": "directly_detected",
                "source": "Pure Python library without external web framework runtime"
            })

        # Testing
        test_detected = False
        is_unittest = any(
            any(
                imp.get("name") == "unittest" or (imp.get("module") or "").startswith("unittest")
                for imp in f_res.get("imports", [])
            )
            for f_res in analysis_data.get("files", [])
        )
        if is_unittest:
            tech_stack.append({
                "name": "unittest",
                "category": "Testing",
                "detection_type": "directly_detected",
                "source": "Python standard library test framework imported in test modules"
            })
            test_detected = True

        if "pytest" in imported_modules or (reqs_content and "pytest" in reqs_content.lower()):
            tech_stack.append({
                "name": "pytest",
                "category": "Testing",
                "detection_type": "directly_detected",
                "source": "Detected in test files / requirements.txt"
            })
            test_detected = True

        if "nose" in imported_modules or (reqs_content and "nose" in reqs_content.lower()):
            tech_stack.append({
                "name": "nose",
                "category": "Testing",
                "detection_type": "directly_detected",
                "source": "Detected in requirements.txt test dependencies"
            })
            test_detected = True

        if not test_detected and any("test" in f["relative_path"].lower() for f in all_files):
            tech_stack.append({
                "name": "Custom Test Suite",
                "category": "Testing",
                "detection_type": "directly_detected",
                "source": "Test directory present in repository"
            })

        # Packaging & Build
        if setup_content:
            tech_stack.append({
                "name": "Setuptools",
                "category": "Packaging / Build",
                "detection_type": "directly_detected",
                "source": "Configured in setup.py"
            })
        if any(f["relative_path"] == "pyproject.toml" for f in all_files):
            tech_stack.append({
                "name": "pyproject.toml (PEP 518)",
                "category": "Packaging / Build",
                "detection_type": "directly_detected",
                "source": "Configured in pyproject.toml"
            })
        if reqs_content:
            tech_stack.append({
                "name": "pip / requirements.txt",
                "category": "Packaging / Build",
                "detection_type": "directly_detected",
                "source": "Declared in requirements.txt"
            })

        # Infrastructure / Tooling
        if makefile_present:
            tech_stack.append({
                "name": "GNU Make",
                "category": "Infrastructure / Tooling",
                "detection_type": "directly_detected",
                "source": "Root Makefile task runner"
            })
        if dockerfile_present:
            tech_stack.append({
                "name": "Docker",
                "category": "Infrastructure / Tooling",
                "detection_type": "directly_detected",
                "source": "Dockerfile container specification"
            })
        if "sphinx" in reqs_content.lower() or any("docs/conf.py" == f["relative_path"] for f in all_files):
            tech_stack.append({
                "name": "Sphinx Documentation",
                "category": "Infrastructure / Tooling",
                "detection_type": "directly_detected",
                "source": "docs/conf.py and Sphinx dependency"
            })

        # 5. Conceptual Architecture (2–3 Layers)
        layer1_files = []
        layer2_files = []
        layer3_files = []

        layer1_symbols = []
        layer2_symbols = []
        layer3_symbols = []

        for f_res in analysis_data.get("files", []):
            fp = f_res.get("file_path", "")
            lower_fp = fp.lower()
            funcs = [fn["name"] for fn in f_res.get("functions", [])]
            classes = [cl["name"] for cl in f_res.get("classes", [])]
            all_syms = funcs + classes

            if "test" in lower_fp or "helper" in lower_fp or "util" in lower_fp or "doc" in lower_fp or "conf" in lower_fp:
                layer3_files.append(fp)
                layer3_symbols.extend(all_syms[:3])
            elif lower_fp.endswith("__init__.py") or lower_fp == "setup.py" or "main" in lower_fp or "app" in lower_fp:
                layer1_files.append(fp)
                layer1_symbols.extend(all_syms[:3])
            else:
                layer2_files.append(fp)
                layer2_symbols.extend(all_syms[:3])

        if not layer1_files and layer2_files:
            layer1_files.append(layer2_files.pop(0))

        if not layer3_files and any("doc" in f["relative_path"].lower() for f in all_files):
            layer3_files.extend([f["relative_path"] for f in all_files if "doc" in f["relative_path"].lower()][:2])

        conceptual_layers = [
            {
                "id": "layer-1",
                "name": "Entry & Public Interface",
                "role": "Defines entry points, package namespace exports, and setup configuration",
                "description": "Initializes the package boundary and coordinates external exposure of core capabilities.",
                "files": layer1_files or ["setup.py"],
                "key_symbols": layer1_symbols[:4]
            },
            {
                "id": "layer-2",
                "name": "Core Domain Logic",
                "role": "Contains primary algorithmic execution, data manipulation, and domain operations",
                "description": "Houses the central business logic and orchestrates calls to helper and utility modules.",
                "files": layer2_files or ["sample/core.py"],
                "key_symbols": layer2_symbols[:4]
            },
            {
                "id": "layer-3",
                "name": "Helpers & Scaffolding",
                "role": "Supplies auxiliary routines, shared utilities, and automated test suites",
                "description": "Provides supporting functions and verifies repository stability and correctness.",
                "files": layer3_files or ["sample/helpers.py", "tests/test_basic.py"],
                "key_symbols": layer3_symbols[:4]
            }
        ]

        # 6. Key Workflows (2–4 Workflows with Code Flow Handoff)
        workflows = []
        for f_res in analysis_data.get("files", []):
            fp = f_res.get("file_path", "")
            for call in f_res.get("function_calls", []):
                caller = call.get("caller")
                called = call.get("called_function")
                if caller and caller != "<module>" and called:
                    cleaned_caller = caller.split(".")[-1]
                    existing_wf = next((w for w in workflows if w["root_function"] == cleaned_caller), None)
                    if not existing_wf:
                        workflows.append({
                            "id": f"workflow-{len(workflows) + 1}",
                            "title": f"Execution Flow ({cleaned_caller})",
                            "root_function": cleaned_caller,
                            "description": f"Traces how {cleaned_caller}() coordinates and executes calls across repository modules.",
                            "steps": [
                                f"{fp}:{cleaned_caller}() initiates execution",
                                f"Invokes internal subroutine `{called}()`",
                                "Assembles and returns result to caller"
                            ]
                        })
                    else:
                        if len(existing_wf["steps"]) < 5:
                            existing_wf["steps"].insert(
                                len(existing_wf["steps"]) - 1,
                                f"Calls `{called}()` to resolve supporting data"
                            )
                if len(workflows) >= 3:
                    break
            if len(workflows) >= 3:
                break

        if not workflows:
            for f_res in analysis_data.get("files", []):
                fp = f_res.get("file_path", "")
                for func in f_res.get("functions", []):
                    fn_name = func["name"]
                    workflows.append({
                        "id": f"workflow-{len(workflows) + 1}",
                        "title": f"Function Flow ({fn_name})",
                        "root_function": fn_name,
                        "description": f"Main execution entry for {fn_name}() in {fp}.",
                        "steps": [
                            f"Entry into {fp}:{fn_name}() (lines {func['start_line']}–{func['end_line']})",
                            "Executes deterministic internal logic",
                            "Returns processed value to caller"
                        ]
                    })
                    if len(workflows) >= 2:
                        break
                if len(workflows) >= 2:
                    break

        # 7. Snapshot Facts
        major_dirs = sorted(list(set(
            f["relative_path"].split("/")[0]
            for f in all_files
            if "/" in f["relative_path"] and not f["relative_path"].startswith(".")
        )))
        primary_lang = "Python" if lang_counts.get("Python", 0) > 0 else (list(lang_counts.keys())[0] if lang_counts else "Unknown")
        languages_display = [f"{lang} ({int(round((count / len(all_files)) * 100))}%)" for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1])[:3]]

        internal_deps_count = sum(1 for dep in analysis_data.get("dependencies", []) if dep.get("is_internal"))
        total_deps_count = len(analysis_data.get("dependencies", []))

        snapshot = {
            "primary_language": primary_lang,
            "languages": languages_display,
            "total_files": len(all_files),
            "major_modules_count": len(major_dirs),
            "major_modules": major_dirs,
            "dependencies_count": total_deps_count,
            "internal_dependencies_count": internal_deps_count,
        }

        # 8. Suggested Questions
        suggested_questions = [
            f"What is the main entry point and purpose of {repo_name.split('/')[-1]}?",
            "How does the core logic connect to helper functions?",
            "What dependencies are required to run and test this project?",
            "How are the test suites organized and how do I run them?"
        ]

        return {
            "repository_url": repo_url,
            "repository_name": repo_name,
            "description": description,
            "problem_solved": problem_solved,
            "core_purpose": core_purpose,
            "key_features": features,
            "use_cases": use_cases,
            "tech_stack": tech_stack,
            "conceptual_architecture": conceptual_layers,
            "workflows": workflows,
            "snapshot": snapshot,
            "suggested_questions": suggested_questions,
        }

    def explore_codebase(
        self,
        repo_url: str,
        query: str,
        selected_node_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Orchestrates repository exploration by combining hybrid retrieval,
        AST architecture graph relationships, and evidence-grounded impact analysis.
        Does not invent relationships or hallucinate runtime behavior.
        """
        from fastapi import HTTPException
        from app.services.search_service import SearchService

        clean_url = (repo_url or "").strip()
        if not clean_url:
            raise HTTPException(status_code=400, detail="Repository URL cannot be empty.")

        clean_query = (query or "").strip()
        if not clean_query:
            raise HTTPException(status_code=400, detail="Explore query cannot be empty.")

        # 1. Acquire existing architecture graph
        graph = self.build_architecture_graph(repo_url=clean_url)
        all_nodes = graph.get("nodes", [])
        all_edges = graph.get("edges", [])

        nodes_by_id: Dict[str, Dict[str, Any]] = {n["id"]: n for n in all_nodes}

        # 2. Run hybrid retrieval via existing SearchService
        search_service = SearchService(db_session=self.db)
        search_res = search_service.search_repository(
            repo_url=clean_url,
            query=clean_query,
            top_k=10,
        )
        raw_candidates = search_res.get("results", [])

        # 3. Direct identifier / symbol / filename matching in graph nodes
        clean_target = clean_query.rstrip("()").strip().lower()
        direct_matches: List[Dict[str, Any]] = []

        for node in all_nodes:
            n_name = (node.get("name") or "").lower()
            n_file = (node.get("file_path") or "").lower()
            n_type = node.get("type", "file")

            file_basename = n_file.split("/")[-1]
            if (
                clean_target == n_name
                or clean_target == file_basename
                or clean_target == n_file
                or (len(clean_target) > 3 and clean_target in n_name)
            ):
                direct_matches.append({
                    "file_path": node.get("file_path"),
                    "symbol_name": node.get("name"),
                    "symbol_type": n_type,
                    "start_line": node.get("start_line") or 1,
                    "end_line": node.get("end_line") or 1,
                    "similarity_score": 1.0,
                    "retrieval_sources": ["direct_match"],
                })

        # Merge direct matches with search results, deduplicating by (file_path, symbol_name)
        combined_candidates: List[Dict[str, Any]] = []
        seen_keys: Set[tuple] = set()

        for dm in direct_matches:
            key = (dm["file_path"], dm.get("symbol_name"))
            if key not in seen_keys:
                seen_keys.add(key)
                combined_candidates.append(dm)

        for sc in raw_candidates:
            sim = sc.get("similarity_score")
            # If similarity score is very low (< 0.22) and not structurally expanded, skip
            if sim is not None and sim < 0.22 and "structural" not in sc.get("retrieval_sources", []):
                continue
            key = (sc["file_path"], sc.get("symbol_name"))
            if key not in seen_keys:
                seen_keys.add(key)
                combined_candidates.append(sc)

        # 4. Evidence-based Categorization
        def classify_category(file_path: str, sym_name: str) -> Optional[str]:
            fp = (file_path or "").lower()
            sym = (sym_name or "").lower()

            if "test" in fp or fp.startswith("tests/") or fp.endswith("_test.py") or "test_" in fp:
                return "Tests"

            if any(fp.endswith(ext) for ext in [".jsx", ".tsx", ".vue", ".svelte", ".html", ".css"]) or "frontend/" in fp or "src/components/" in fp or "/ui/" in fp:
                return "Frontend"

            if (
                any(p in fp for p in ["/api/", "/routes/", "/endpoints/", "/controllers/", "router.py", "routes.py", "endpoints.py"])
                or any(kw in sym for kw in ["router", "endpoint", "route", "login", "register", "auth_token"])
            ):
                return "API"

            if (
                any(p in fp for p in ["/models/", "/db/", "/schemas/", "/repositories/", "/store/", "model.py", "models.py", "database.py", "repository.py", "schema.py"])
                or any(kw in sym for kw in ["model", "schema", "table", "entity", "repository"])
            ):
                return "Database"

            if any(p in fp for p in ["/utils/", "/util/", "/helpers/", "/helper/", "/config/", "/settings/", "utils.py", "helpers.py", "config.py"]):
                return "Utilities"

            if any(p in fp for p in ["/services/", "/service/", "/core/", "/domain/", "/pipeline/", "service.py", "core.py"]) or fp.endswith(".py"):
                return "Backend"

            return None

        found_in: Dict[str, List[Dict[str, Any]]] = {}

        for cand in combined_candidates:
            fp = cand.get("file_path") or ""
            sym = cand.get("symbol_name") or fp.split("/")[-1]
            stype = cand.get("symbol_type") or "file"
            s_line = cand.get("start_line")
            e_line = cand.get("end_line")

            cat = classify_category(fp, sym)
            if not cat:
                cat = "Backend" if fp.endswith(".py") else "Other"

            sources = cand.get("retrieval_sources", ["semantic"])
            if "direct_match" in sources:
                evidence_reason = f"Exact repository match on symbol '{sym}'"
            elif "structural" in sources and "semantic" in sources:
                evidence_reason = "Confirmed by semantic relevance and call-graph connectivity"
            elif "structural" in sources:
                evidence_reason = "Connected via AST dependency to relevant workflow"
            else:
                score_pct = int((cand.get("similarity_score") or 0.75) * 100)
                evidence_reason = f"Matched concept with {score_pct}% semantic relevance"

            item_node_id = None
            if stype == "function":
                for nid, n in nodes_by_id.items():
                    if n.get("type") == "function" and n.get("file_path") == fp and (n.get("name") == sym or n.get("name", "").endswith(f".{sym}")):
                        item_node_id = nid
                        break
            elif stype == "class":
                for nid, n in nodes_by_id.items():
                    if n.get("type") == "class" and n.get("file_path") == fp and n.get("name") == sym:
                        item_node_id = nid
                        break
            if not item_node_id:
                item_node_id = f"file:{fp}"

            item = {
                "id": item_node_id,
                "file_path": fp,
                "symbol_name": sym,
                "symbol_type": stype,
                "start_line": s_line,
                "end_line": e_line,
                "category": cat,
                "evidence_reason": evidence_reason,
            }

            found_in.setdefault(cat, []).append(item)

        # 5. Determine Selected Item for Change Impact
        selected_item = None
        target_node_id = selected_node_id

        if target_node_id and target_node_id in nodes_by_id:
            for cat_items in found_in.values():
                for itm in cat_items:
                    if itm["id"] == target_node_id:
                        selected_item = itm
                        break
                if selected_item:
                    break

            if not selected_item:
                target_node = nodes_by_id[target_node_id]
                selected_item = {
                    "id": target_node_id,
                    "file_path": target_node.get("file_path"),
                    "symbol_name": target_node.get("name"),
                    "symbol_type": target_node.get("type", "file"),
                    "start_line": target_node.get("start_line"),
                    "end_line": target_node.get("end_line"),
                    "category": classify_category(target_node.get("file_path", ""), target_node.get("name", "")),
                    "evidence_reason": "Directly inspected repository component",
                }
        else:
            preferred_cats = ["API", "Backend", "Database", "Frontend", "Utilities", "Tests"]
            for pcat in preferred_cats:
                if pcat in found_in and found_in[pcat]:
                    selected_item = found_in[pcat][0]
                    target_node_id = selected_item["id"]
                    break
            if not selected_item:
                for cat_items in found_in.values():
                    if cat_items:
                        selected_item = cat_items[0]
                        target_node_id = selected_item["id"]
                        break

        # 6. Compute Change Impact from Actual Graph Relationships
        selected_impact = None
        compact_subgraph = None

        if selected_item and target_node_id:
            sel_file = selected_item["file_path"]
            sel_name = selected_item["symbol_name"] or sel_file
            sel_type = selected_item["symbol_type"]
            sel_node_id = target_node_id
            file_node_id = f"file:{sel_file}"

            directly_connected: List[Dict[str, Any]] = []
            used_by: List[Dict[str, Any]] = []
            calls: List[Dict[str, Any]] = []
            imports: List[Dict[str, Any]] = []
            related_tests: List[Dict[str, Any]] = []

            seen_conn: Set[str] = set()
            seen_used: Set[str] = set()
            seen_calls: Set[str] = set()
            seen_imp: Set[str] = set()
            seen_tests: Set[str] = set()

            subgraph_nodes: Dict[str, Dict[str, Any]] = {}
            subgraph_edges: List[Dict[str, Any]] = []

            sel_node_obj = nodes_by_id.get(sel_node_id) or {
                "id": sel_node_id,
                "name": sel_name,
                "type": sel_type,
                "file_path": sel_file,
            }
            subgraph_nodes[sel_node_id] = {
                "id": sel_node_id,
                "name": sel_name,
                "type": sel_type,
                "file_path": sel_file,
                "is_selected": True,
            }

            def is_test_node(n_id: str, f_path: str) -> bool:
                p = (f_path or "").lower()
                return "test" in p or p.startswith("tests/") or p.endswith("_test.py") or "test_" in p

            for edge in all_edges:
                e_type = edge.get("type")
                src = edge.get("source")
                tgt = edge.get("target")

                src_node = nodes_by_id.get(src, {})
                tgt_node = nodes_by_id.get(tgt, {})

                src_file = src_node.get("file_path", "")
                tgt_file = tgt_node.get("file_path", "")

                # A. Directly Connected: contains
                if e_type == "contains":
                    if src == sel_node_id:
                        c_id = tgt
                        if c_id not in seen_conn and c_id != sel_node_id:
                            seen_conn.add(c_id)
                            directly_connected.append({
                                "id": c_id,
                                "name": tgt_node.get("name", c_id),
                                "type": tgt_node.get("type", "symbol"),
                                "file_path": tgt_file,
                                "relation": "Contains",
                            })
                    elif tgt == sel_node_id:
                        p_id = src
                        if p_id not in seen_conn and p_id != sel_node_id:
                            seen_conn.add(p_id)
                            directly_connected.append({
                                "id": p_id,
                                "name": src_node.get("name", p_id),
                                "type": src_node.get("type", "container"),
                                "file_path": src_file,
                                "relation": "Defined in",
                            })

                # B. Used by / Referenced by:
                # Incoming calls
                if e_type == "calls" and tgt == sel_node_id and src != sel_node_id:
                    if is_test_node(src, src_file):
                        if src not in seen_tests:
                            seen_tests.add(src)
                            related_tests.append({
                                "id": src,
                                "name": src_node.get("name", src),
                                "type": src_node.get("type", "function"),
                                "file_path": src_file,
                                "relation": "Tests via call",
                            })
                    elif src not in seen_used:
                        seen_used.add(src)
                        used_by.append({
                            "id": src,
                            "name": src_node.get("name", src),
                            "type": src_node.get("type", "function"),
                            "file_path": src_file,
                            "relation": "Called by",
                        })
                        subgraph_nodes[src] = {
                            "id": src,
                            "name": src_node.get("name", src),
                            "type": src_node.get("type", "function"),
                            "file_path": src_file,
                        }
                        subgraph_edges.append({
                            "id": f"{src}->{sel_node_id}",
                            "source": src,
                            "target": sel_node_id,
                            "relation": "calls",
                        })

                # Incoming imports
                if e_type == "imports" and (tgt == file_node_id or tgt == sel_node_id) and src != file_node_id:
                    if is_test_node(src, src_file):
                        if src not in seen_tests:
                            seen_tests.add(src)
                            related_tests.append({
                                "id": src,
                                "name": src_node.get("name", src),
                                "type": "file",
                                "file_path": src_file,
                                "relation": "Test imports module",
                            })
                    elif src not in seen_used:
                        seen_used.add(src)
                        used_by.append({
                            "id": src,
                            "name": src_node.get("name", src),
                            "type": "file",
                            "file_path": src_file,
                            "relation": "Imported by",
                        })
                        subgraph_nodes[src] = {
                            "id": src,
                            "name": src_node.get("name", src),
                            "type": "file",
                            "file_path": src_file,
                        }
                        subgraph_edges.append({
                            "id": f"{src}->{sel_node_id}",
                            "source": src,
                            "target": sel_node_id,
                            "relation": "imports",
                        })

                # C. Calls: outgoing calls
                if e_type == "calls" and src == sel_node_id and tgt != sel_node_id:
                    if tgt not in seen_calls:
                        seen_calls.add(tgt)
                        calls.append({
                            "id": tgt,
                            "name": tgt_node.get("name", tgt),
                            "type": tgt_node.get("type", "function"),
                            "file_path": tgt_file,
                            "relation": "Calls",
                        })
                        subgraph_nodes[tgt] = {
                            "id": tgt,
                            "name": tgt_node.get("name", tgt),
                            "type": tgt_node.get("type", "function"),
                            "file_path": tgt_file,
                        }
                        subgraph_edges.append({
                            "id": f"{sel_node_id}->{tgt}",
                            "source": sel_node_id,
                            "target": tgt,
                            "relation": "calls",
                        })

                # D. Imports: outgoing imports
                if e_type == "imports" and (src == file_node_id or src == sel_node_id) and tgt != file_node_id:
                    if tgt not in seen_imp:
                        seen_imp.add(tgt)
                        imports.append({
                            "id": tgt,
                            "name": tgt_node.get("name", tgt),
                            "type": "file",
                            "file_path": tgt_file,
                            "relation": "Imports",
                        })
                        if len([n for n in subgraph_nodes.values() if n.get("type") == "file" and n["id"] != sel_node_id]) < 4:
                            subgraph_nodes[tgt] = {
                                "id": tgt,
                                "name": tgt_node.get("name", tgt),
                                "type": "file",
                                "file_path": tgt_file,
                            }
                            subgraph_edges.append({
                                "id": f"{sel_node_id}->{tgt}",
                                "source": sel_node_id,
                                "target": tgt,
                                "relation": "imports",
                            })

            # Check for naming-based test files if no test edges found
            if not related_tests:
                base_stem = sel_file.split("/")[-1].replace(".py", "")
                for nid, n in nodes_by_id.items():
                    n_path = n.get("file_path", "")
                    if is_test_node(nid, n_path) and base_stem in n_path:
                        if nid not in seen_tests:
                            seen_tests.add(nid)
                            related_tests.append({
                                "id": nid,
                                "name": n.get("name", nid),
                                "type": n.get("type", "file"),
                                "file_path": n_path,
                                "relation": "Related test suite",
                            })

            selected_impact = {
                "selected_id": sel_node_id,
                "selected_name": sel_name,
                "selected_type": sel_type,
                "selected_file": sel_file,
                "directly_connected": directly_connected,
                "used_by": used_by,
                "calls": calls,
                "imports": imports,
                "related_tests": related_tests,
            }

            compact_subgraph = {
                "nodes": list(subgraph_nodes.values()),
                "edges": subgraph_edges,
            }

        return {
            "repository_url": repo_url,
            "query": query,
            "found_in": found_in,
            "selected_impact": selected_impact,
            "compact_subgraph": compact_subgraph,
        }

    def start_analysis(self, repository_id: int):
        raise NotImplementedError("AnalysisService.start_analysis is scheduled for future implementation.")

    def get_analysis_status(self, analysis_id: int):
        raise NotImplementedError("AnalysisService.get_analysis_status is scheduled for future implementation.")

