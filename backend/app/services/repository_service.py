import os
import re
import shutil
import stat
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Tuple

from fastapi import HTTPException


class RepositoryService:
    # Directories strictly excluded from analysis
    EXCLUDED_DIRS = {
        ".git",
        "node_modules",
        ".venv",
        "venv",
        "__pycache__",
        "dist",
        "build",
        "coverage",
        ".pytest_cache",
        ".idea",
        ".vscode",
        ".mypy_cache",
        ".tox",
        ".eggs",
    }

    # Binary file extensions to exclude
    BINARY_EXTENSIONS = {
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".tiff",
        ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz",
        ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".class", ".pyc", ".pyd",
        ".whl", ".egg", ".wasm", ".iso", ".dmg", ".parquet", ".db", ".sqlite", ".sqlite3",
        ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".flac",
        ".ttf", ".otf", ".woff", ".woff2", ".eot",
    }

    # Secret / sensitive filenames to exclude
    SECRET_FILENAMES = {
        ".env",
        ".env.local",
        ".env.production",
        ".env.development",
        ".env.test",
        "id_rsa",
        "id_dsa",
        "id_ecdsa",
        "id_ed25519",
    }

    # Secret file extensions to exclude
    SECRET_EXTENSIONS = {
        ".pem",
        ".key",
        ".pkcs12",
        ".pfx",
        ".p12",
        ".keystore",
        ".jks",
    }

    # Maximum individual source file size (512 KB)
    MAX_FILE_SIZE_BYTES = 512 * 1024

    # Language mapping by file extension
    EXTENSION_LANGUAGE_MAP: Dict[str, str] = {
        ".py": "Python",
        ".js": "JavaScript",
        ".jsx": "JavaScript React",
        ".ts": "TypeScript",
        ".tsx": "TypeScript React",
        ".html": "HTML",
        ".htm": "HTML",
        ".css": "CSS",
        ".scss": "SCSS",
        ".sass": "SASS",
        ".less": "Less",
        ".json": "JSON",
        ".yaml": "YAML",
        ".yml": "YAML",
        ".toml": "TOML",
        ".md": "Markdown",
        ".markdown": "Markdown",
        ".rst": "reStructuredText",
        ".sql": "SQL",
        ".sh": "Shell",
        ".bash": "Shell",
        ".zsh": "Shell",
        ".ps1": "PowerShell",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".c": "C",
        ".h": "C/C++ Header",
        ".cpp": "C++",
        ".cc": "C++",
        ".cxx": "C++",
        ".hpp": "C++ Header",
        ".cs": "C#",
        ".rb": "Ruby",
        ".php": "PHP",
        ".swift": "Swift",
        ".kt": "Kotlin",
        ".kts": "Kotlin",
        ".scala": "Scala",
        ".lua": "Lua",
        ".r": "R",
        ".dart": "Dart",
        ".xml": "XML",
        ".svg": "SVG",
        ".dockerfile": "Dockerfile",
    }

    # In-memory cache for recent ingestion results by normalized repo URL (5 min TTL)
    _ingest_cache: Dict[str, Tuple[float, dict]] = {}
    CACHE_TTL_SECONDS = 300

    def __init__(self, db_session=None):
        self.db = db_session

    @staticmethod
    def validate_github_url(url: str) -> Tuple[str, str]:
        """
        Validates that the provided URL is a valid GitHub repository URL.
        Returns the normalized clone URL and repository name (owner/repo).
        """
        cleaned_url = url.strip()
        pattern = r"^https?://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$"
        match = re.match(pattern, cleaned_url)
        if not match:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid GitHub repository URL: '{url}'. Must be a public GitHub repository (e.g., https://github.com/owner/repo)."
            )
        owner, repo = match.group(1), match.group(2)
        normalized_url = f"https://github.com/{owner}/{repo}.git"
        repo_name = f"{owner}/{repo}"
        return normalized_url, repo_name

    @staticmethod
    def is_binary_file(file_path: Path) -> bool:
        """Checks for presence of null bytes to identify binary content."""
        try:
            with open(file_path, "rb") as f:
                chunk = f.read(1024)
                return b"\x00" in chunk
        except Exception:
            return True

    @staticmethod
    def _handle_remove_readonly(func, path, exc_info):
        """Error handler for shutil.rmtree on Windows read-only git files."""
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass

    def ingest_repository(self, repo_url: str) -> dict:
        """
        Acquires a public GitHub repository using git clone --depth 1,
        processes source files without executing any code, extracts metadata,
        and safely deletes the temporary clone.
        """
        normalized_url, repo_name = self.validate_github_url(repo_url)

        now = time.time()
        if normalized_url in self._ingest_cache:
            cached_time, cached_data = self._ingest_cache[normalized_url]
            if now - cached_time < self.CACHE_TTL_SECONDS:
                return cached_data

        temp_dir = tempfile.mkdtemp(prefix="codelens_ingest_")
        try:
            # Clone with --depth 1 and disabled hooks to prevent any script execution
            clone_cmd = [
                "git",
                "clone",
                "--depth", "1",
                "--config", "core.hooksPath=/dev/null",
                normalized_url,
                temp_dir,
            ]
            try:
                result = subprocess.run(
                    clone_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=90,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                raise HTTPException(status_code=408, detail="Repository clone timed out.")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to execute clone command: {str(e)}")

            if result.returncode != 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to clone GitHub repository. Ensure it is public and accessible. Error: {result.stderr.strip()}"
                )

            source_files: List[dict] = []
            base_path = Path(temp_dir)

            for root, dirs, files in os.walk(temp_dir):
                # Filter out excluded directories in-place to avoid descending into them
                dirs[:] = [d for d in dirs if d not in self.EXCLUDED_DIRS]

                for file_name in files:
                    file_path = Path(root) / file_name

                    # 1. Skip secret and sensitive files
                    lower_name = file_name.lower()
                    if lower_name in self.SECRET_FILENAMES or lower_name.startswith(".env"):
                        continue

                    extension = file_path.suffix.lower()
                    if extension in self.SECRET_EXTENSIONS:
                        continue

                    # 2. Skip binary files by extension
                    if extension in self.BINARY_EXTENSIONS:
                        continue

                    # 3. Check file size limits
                    try:
                        file_size = file_path.stat().st_size
                    except OSError:
                        continue

                    if file_size == 0 or file_size > self.MAX_FILE_SIZE_BYTES:
                        continue

                    # 4. Check for binary file content
                    if self.is_binary_file(file_path):
                        continue

                    # 5. Read source content safely
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                    except Exception:
                        continue

                    # Capture relative path with POSIX forward slashes
                    rel_path = file_path.relative_to(base_path).as_posix()

                    # Detect language
                    language = self.EXTENSION_LANGUAGE_MAP.get(extension)
                    if not language:
                        if lower_name == "dockerfile":
                            language = "Dockerfile"
                        elif lower_name == "makefile":
                            language = "Makefile"

                    source_files.append({
                        "relative_path": rel_path,
                        "file_extension": extension,
                        "language": language,
                        "file_size": file_size,
                        "source_content": content,
                    })

            # Sort source files predictably by path
            source_files.sort(key=lambda x: x["relative_path"])

            result_data = {
                "repository_url": repo_url,
                "repository_name": repo_name,
                "total_files": len(source_files),
                "files": source_files,
            }
            self._ingest_cache[normalized_url] = (time.time(), result_data)
            return result_data

        finally:
            # Always cleanly delete the temporary clone directory
            shutil.rmtree(temp_dir, onerror=self._handle_remove_readonly)

    def get_file_source(self, repo_url: str, file_path: str) -> dict:
        """
        Safely retrieves source code for a specific file path from a repository.
        Validates GitHub URL, protects against path traversal, and reuses
        existing repository ingestion security filters.
        """
        if not file_path or not file_path.strip():
            raise HTTPException(status_code=400, detail="file_path cannot be empty.")

        clean_path = file_path.strip().replace("\\", "/")
        if clean_path.startswith("/") or ":" in clean_path:
            raise HTTPException(
                status_code=400,
                detail="Invalid file path: absolute paths are not permitted.",
            )

        parts = [p for p in clean_path.split("/") if p]
        if ".." in parts:
            raise HTTPException(
                status_code=400,
                detail="Invalid file path: path traversal ('..') is not permitted.",
            )

        normalized_clean_path = "/".join(parts)

        # Ingest repository safely (uses cache if available)
        repo_data = self.ingest_repository(repo_url)

        for f in repo_data.get("files", []):
            if f.get("relative_path") == normalized_clean_path:
                return {
                    "file_path": f["relative_path"],
                    "language": f.get("language") or "Python",
                    "source_code": f.get("source_content", ""),
                }

        raise HTTPException(
            status_code=404,
            detail=f"File '{file_path}' was not found in repository or was excluded by security filters.",
        )

    def get_repository(self, repository_id: int):
        raise NotImplementedError("RepositoryService.get_repository is scheduled for future implementation.")

    def create_repository(self, data):
        raise NotImplementedError("RepositoryService.create_repository is scheduled for future implementation.")
