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
        # Maps dotted module strings to relative file paths
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
                        # Ascend num_dots - 1 directory levels
                        levels_up = num_dots - 1
                        if len(source_dir_parts) >= levels_up:
                            base_parts = source_dir_parts[:len(source_dir_parts) - levels_up] if levels_up > 0 else list(source_dir_parts)
                        else:
                            base_parts = []

                        if remainder:
                            candidate_dotted = ".".join(base_parts + remainder.split("."))
                        else:
                            candidate_dotted = ".".join(base_parts)

                        if candidate_dotted in module_to_file:
                            target_file = module_to_file[candidate_dotted]
                            is_internal = True
                        else:
                            # If from . import sibling_module, check if sibling_module matches a file
                            for name in names:
                                sibling_candidate = ".".join(base_parts + [name])
                                if sibling_candidate in module_to_file:
                                    target_file = module_to_file[sibling_candidate]
                                    is_internal = True
                                    break
                    else:
                        # Absolute import candidate
                        if mod_str in module_to_file:
                            target_file = module_to_file[mod_str]
                            is_internal = True
                        else:
                            # Check if local relative to current package
                            local_candidate = ".".join(source_dir_parts + [mod_str])
                            if local_candidate in module_to_file:
                                target_file = module_to_file[local_candidate]
                                is_internal = True
                            else:
                                # Check if symbol imported from a file module (e.g. from app.database import Base)
                                # where mod_str is already checked, but what if from module import symbol?
                                # If mod_str was not found, check parent modules
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

    def start_analysis(self, repository_id: int):
        raise NotImplementedError("AnalysisService.start_analysis is scheduled for future implementation.")

    def get_analysis_status(self, analysis_id: int):
        raise NotImplementedError("AnalysisService.get_analysis_status is scheduled for future implementation.")
