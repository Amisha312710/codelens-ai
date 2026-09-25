from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class CodeChunk:
    repository_url: str
    file_path: str
    symbol_name: str
    symbol_type: str  # "FILE" | "CLASS" | "FUNCTION" | "ASYNC_FUNCTION"
    start_line: int
    end_line: int
    source_code: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "repository_url": self.repository_url,
            "file_path": self.file_path,
            "symbol_name": self.symbol_name,
            "symbol_type": self.symbol_type,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "source_code": self.source_code,
        }

    def get_embedding_text(self) -> str:
        """
        Creates semantic representation incorporating file path, symbol name,
        type, and source code for optimal retrieval.
        """
        return f"File: {self.file_path}\nSymbol: {self.symbol_name} ({self.symbol_type})\n{self.source_code.strip()}"


def create_code_chunks(
    repository_url: str,
    files: List[Dict[str, Any]],
    ast_analyses: List[Dict[str, Any]],
) -> List[CodeChunk]:
    """
    Transforms ingested source files and AST analysis results into code-aware chunks.
    Extracts functions, async functions, classes, and file/module overview chunks.
    Avoids arbitrary character splitting or redundant duplicate representations.
    """
    chunks: List[CodeChunk] = []

    # Map ast analysis by relative_path
    ast_map: Dict[str, Dict[str, Any]] = {}
    for analysis in ast_analyses:
        fp = analysis.get("file_path")
        if fp:
            ast_map[fp] = analysis

    for file_obj in files:
        rel_path = file_obj.get("relative_path") or ""
        source_content = file_obj.get("source_content") or ""
        if not source_content.strip():
            continue

        source_lines = source_content.splitlines(keepends=True)
        total_lines = len(source_lines)

        ast_res = ast_map.get(rel_path, {})
        functions = ast_res.get("functions", [])
        classes = ast_res.get("classes", [])

        # 1. Class Chunks
        for cls in classes:
            c_name = cls.get("name")
            start = max(1, cls.get("start_line", 1))
            end = min(total_lines, max(start, cls.get("end_line", start)))
            code = "".join(source_lines[start - 1 : end])
            if code.strip():
                chunks.append(
                    CodeChunk(
                        repository_url=repository_url,
                        file_path=rel_path,
                        symbol_name=c_name,
                        symbol_type="CLASS",
                        start_line=start,
                        end_line=end,
                        source_code=code,
                    )
                )

        # 2. Function & Async Function Chunks
        for fn in functions:
            f_name = fn.get("name")
            is_async = fn.get("is_async", False)
            sym_type = "ASYNC_FUNCTION" if is_async else "FUNCTION"
            start = max(1, fn.get("start_line", 1))
            end = min(total_lines, max(start, fn.get("end_line", start)))
            code = "".join(source_lines[start - 1 : end])
            if code.strip():
                chunks.append(
                    CodeChunk(
                        repository_url=repository_url,
                        file_path=rel_path,
                        symbol_name=f_name,
                        symbol_type=sym_type,
                        start_line=start,
                        end_line=end,
                        source_code=code,
                    )
                )

        # 3. File / Module Level Chunk
        # If the file has no inner symbols (e.g. __init__.py, context.py, setup.py),
        # always create a FILE chunk.
        # If it has symbols, include a FILE chunk unless a single symbol already covers the whole file.
        has_symbols = bool(classes or functions)
        is_exact_single_symbol = (
            len(classes) + len(functions) == 1
            and chunks
            and (chunks[-1].end_line - chunks[-1].start_line + 1) >= (total_lines * 0.9)
        )

        if not has_symbols or (not is_exact_single_symbol and total_lines <= 200):
            chunks.append(
                CodeChunk(
                    repository_url=repository_url,
                    file_path=rel_path,
                    symbol_name=rel_path,
                    symbol_type="FILE",
                    start_line=1,
                    end_line=total_lines,
                    source_code=source_content,
                )
            )

    return chunks
