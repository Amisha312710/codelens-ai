from typing import List, Optional
from pydantic import BaseModel, Field


class FlowNode(BaseModel):
    id: str = Field(..., description="Unique node identifier (e.g. func:path:name)")
    name: str = Field(..., description="Function or method name")
    type: str = Field(default="function", description="Node type: 'function'")
    file_path: str = Field(..., description="Relative file path containing the function")
    start_line: Optional[int] = Field(None, description="Function declaration start line")
    end_line: Optional[int] = Field(None, description="Function declaration end line")


class FlowEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    type: str = Field(default="CALLS", description="Relationship type: 'CALLS'")
    source_name: Optional[str] = Field(None, description="Source function display name")
    target_name: Optional[str] = Field(None, description="Target function display name")


class FlowRequest(BaseModel):
    url: Optional[str] = Field(None, description="Public GitHub repository URL")
    root_function: Optional[str] = Field(None, description="Root function name or identifier to trace")
    max_depth: int = Field(default=3, ge=1, le=3, description="Call depth to trace (strictly 1 to 3, default 3)")

    # Legacy / alias fields for backwards compatibility
    entry_point: Optional[str] = Field(None, description="Alias for root_function")
    repository_id: Optional[int] = Field(None, description="Legacy repository identifier")


class FlowResponse(BaseModel):
    repository_url: str = Field(..., description="Analyzed repository URL")
    root_function: str = Field(..., description="Root function name or identifier")
    nodes: List[FlowNode] = Field(default_factory=list, description="Ordered nodes in call flow")
    edges: List[FlowEdge] = Field(default_factory=list, description="Directed function call edges")
    total_nodes: int = Field(..., description="Count of nodes in flow")
    total_edges: int = Field(..., description="Count of edges in flow")


class FunctionsListResponse(BaseModel):
    repository_url: str = Field(..., description="Analyzed repository URL")
    functions: List[FlowNode] = Field(default_factory=list, description="All functions discovered in repository")

