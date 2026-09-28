from datetime import datetime
from typing import Any, Dict, List, Optional
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


class TechStackItem(BaseModel):
    name: str
    category: str  # "Language" | "Backend / Framework" | "Testing" | "Packaging / Build" | "Infrastructure / Tooling"
    detection_type: str = "directly_detected"  # "directly_detected" | "inferred"
    source: str  # e.g. "setup.py", "requirements.txt", "Makefile", "imports"


class ConceptualLayer(BaseModel):
    id: str
    name: str
    role: str  # "Entry & Interface" | "Core Logic" | "Helpers & Scaffolding"
    description: str
    files: List[str] = []
    key_symbols: List[str] = []


class KeyWorkflow(BaseModel):
    id: str
    title: str
    root_function: str
    description: str
    steps: List[str] = []


class ProjectSnapshot(BaseModel):
    primary_language: str
    languages: List[str] = []
    total_files: int
    major_modules_count: int
    major_modules: List[str] = []
    dependencies_count: int
    internal_dependencies_count: int


class ProjectOverview(BaseModel):
    repository_url: str
    repository_name: str
    description: str
    problem_solved: str
    core_purpose: str
    key_features: List[str] = []
    use_cases: List[str] = []
    tech_stack: List[TechStackItem] = []
    conceptual_architecture: List[ConceptualLayer] = []
    workflows: List[KeyWorkflow] = []
    snapshot: ProjectSnapshot
    suggested_questions: List[str] = []


class ArchitectureGraphResponse(BaseModel):
    repository_url: str
    repository_name: str
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    total_nodes: int
    total_edges: int
    project_overview: Optional[ProjectOverview] = None


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


class ExploreRequest(BaseModel):
    url: str
    query: str
    selected_node_id: Optional[str] = None


class FoundItem(BaseModel):
    id: str
    file_path: str
    symbol_name: Optional[str] = None
    symbol_type: str = "file"  # "function" | "class" | "file"
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    category: Optional[str] = None
    evidence_reason: Optional[str] = None


class ChangeImpact(BaseModel):
    selected_id: str
    selected_name: str
    selected_type: str
    selected_file: str
    directly_connected: List[Dict[str, Any]] = []
    used_by: List[Dict[str, Any]] = []
    calls: List[Dict[str, Any]] = []
    imports: List[Dict[str, Any]] = []
    related_tests: List[Dict[str, Any]] = []


class ExploreResponse(BaseModel):
    repository_url: str
    query: str
    found_in: Dict[str, List[FoundItem]] = {}
    selected_impact: Optional[ChangeImpact] = None
    compact_subgraph: Optional[Dict[str, Any]] = None


