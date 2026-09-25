from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AnalysisBase(BaseModel):
    repository_id: int
    status: str = "pending"


class AnalysisCreate(AnalysisBase):
    pass


class AnalysisResponse(AnalysisBase):
    id: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FunctionInfo(BaseModel):
    name: str
    start_line: int
    end_line: int
    is_async: bool = False


class ClassInfo(BaseModel):
    name: str
    start_line: int
    end_line: int


class ImportInfo(BaseModel):
    module: Optional[str] = None
    name: str
    alias: Optional[str] = None
    line_number: int


class FunctionCallInfo(BaseModel):
    caller: str
    called_function: str
    line_number: int


class SyntaxErrorInfo(BaseModel):
    message: str
    line_number: Optional[int] = None
    offset: Optional[int] = None


class FileASTAnalysisResult(BaseModel):
    file_path: Optional[str] = None
    functions: List[FunctionInfo] = []
    classes: List[ClassInfo] = []
    imports: List[ImportInfo] = []
    function_calls: List[FunctionCallInfo] = []
    syntax_error: Optional[SyntaxErrorInfo] = None


class AnalyzeCodeRequest(BaseModel):
    source_code: str
    file_path: Optional[str] = None


class FileDependencyInfo(BaseModel):
    source_file: str
    target_file: Optional[str] = None
    imported_module: str
    imported_names: List[str] = []
    line_number: int
    is_internal: bool = False


class RepositoryAnalysisRequest(BaseModel):
    url: str


class RepositoryAnalysisResponse(BaseModel):
    repository_url: str
    repository_name: str
    total_files: int
    python_files_analyzed: int
    total_functions: int
    total_classes: int
    files: List[FileASTAnalysisResult]
    dependencies: List[FileDependencyInfo]


class GraphNode(BaseModel):
    id: str
    type: str  # "file" | "class" | "function"
    name: str
    file_path: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str  # "contains" | "imports" | "calls"


class ArchitectureGraphResponse(BaseModel):
    repository_url: str
    repository_name: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    total_nodes: int
    total_edges: int


class FileSourceCodeRequest(BaseModel):
    url: str
    file_path: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None


class FileSourceCodeResponse(BaseModel):
    file_path: str
    language: Optional[str] = "Python"
    source_code: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None

