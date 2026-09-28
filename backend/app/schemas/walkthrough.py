from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class WalkthroughRequest(BaseModel):
    """
    Request payload to retrieve or generate walkthroughs for an analyzed repository.
    Supports either public repository URL or internal repository ID.
    """
    url: Optional[str] = Field(
        None,
        description="Public GitHub repository URL (e.g. https://github.com/owner/repo)",
        json_schema_extra={"example": "https://github.com/owner/repo"},
    )
    repository_id: Optional[int] = Field(
        None,
        description="Database repository ID if already persisted",
        json_schema_extra={"example": 1},
    )


class WalkthroughImplementation(BaseModel):
    """
    Pointer to real source code implementation backing the walkthrough concept.
    Reused directly by Monaco CodeViewer for line-range highlighting.
    """
    file_path: str = Field(..., description="Relative file path in repository")
    symbol: str = Field(..., description="Function or class name")
    start_line: int = Field(..., description="1-indexed starting line number")
    end_line: int = Field(..., description="1-indexed ending line number")


class WalkthroughStep(BaseModel):
    """
    Individual pedagogical step in a walkthrough animation sequence.
    """
    step_number: int = Field(1, description="Step order index (1-indexed)")
    title: str = Field(..., description="Short title of what happens in this step")
    description: str = Field(..., description="Beginner-friendly explanation of the transformation")
    visual: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured data defining input, transformation, or output for frontend rendering",
    )


class WalkthroughConcept(BaseModel):
    """
    A grounded, educational walkthrough concept supported by repository evidence.
    Type must strictly be one of the 5 approved V1 visual types.
    """
    id: str = Field(..., description="Unique concept identifier")
    title: str = Field(..., description="Human-readable concept name")
    type: str = Field(
        ...,
        description="Strictly one of: document_to_chunks, text_to_vector, query_to_results, request_flow, data_to_prediction",
    )
    description: str = Field(..., description="Overall concept summary")
    steps: List[WalkthroughStep] = Field(..., description="Ordered 4-step pedagogical explanation")
    implementation: WalkthroughImplementation = Field(
        ...,
        description="Concrete source code reference backing this concept",
    )


class WalkthroughWorkflowNode(BaseModel):
    id: str = Field(..., description="Unique node identifier")
    name: str = Field(..., description="Function or stage name")
    signature: str = Field(..., description="Display signature (e.g. func())")
    file_path: Optional[str] = Field(None, description="Source file path")
    start_line: Optional[int] = Field(None, description="Starting line")
    end_line: Optional[int] = Field(None, description="Ending line")
    role: str = Field(..., description="Role in execution flow")
    badge: str = Field("INVOKED CALL", description="Visual badge label")
    is_terminal: bool = Field(False, description="Whether node represents flow termination")


class WalkthroughWorkflowEdge(BaseModel):
    source: str = Field(..., description="Source node id")
    target: str = Field(..., description="Target node id")
    label: Optional[str] = Field(None, description="Edge label or description")


class WalkthroughWorkflow(BaseModel):
    workflow_title: str = Field(..., description="Title of the detected workflow")
    summary: str = Field(..., description="Educational summary of how the workflow executes")
    nodes: List[Dict[str, Any]] = Field(default_factory=list, description="Ordered nodes representing actual functions/stages in the workflow")
    edges: List[Dict[str, Any]] = Field(default_factory=list, description="Connections between nodes")
    source_locations: List[Dict[str, Any]] = Field(default_factory=list, description="Real source file locations for the nodes")


class EvidenceItem(BaseModel):
    file_path: str = Field(..., description="Relative file path in repository")
    symbol: Optional[str] = Field(None, description="Function, method, class, or component symbol")
    start_line: Optional[int] = Field(None, description="Starting line in source file")
    end_line: Optional[int] = Field(None, description="Ending line in source file")
    confidence: str = Field("high", description="Evidence confidence: high or medium")
    detail: Optional[str] = Field(None, description="Factual detail string (e.g. route POST /api/x)")


# Backward compatibility alias
SourceEvidence = EvidenceItem


class StoryStage(BaseModel):
    id: str = Field(..., description="Unique stage identifier")
    stage_index: int = Field(..., description="1-indexed stage order")
    title: str = Field(..., description="Human-readable title for the logical stage")
    subtitle: str = Field("", description="Short descriptive tagline for the stage")
    explanation: str = Field(..., description="Plain-English explanation of what happens in this stage")
    stage_type: str = Field("processing", description="Generic visual primitive type: ingress, interaction, request, routing, processing, transformation, external_call, storage, generation, response, output")
    role_badge: str = Field("STAGE", description="Badge label (e.g. INGRESS, LOGIC, INFERENCE)")
    concept_title: Optional[str] = Field(None, description="Plain-language concept headline for this stage")
    concept_explanation: Optional[str] = Field(None, description="1-2 plain-language sentences explaining the step to a new developer")
    narration: Optional[str] = Field(None, description="One-line audio narration script for the scene")
    provenance_chip: Optional[str] = Field(None, description="Subtle chip formatted as symbol · file:start-end")
    evidence_ids: List[str] = Field(default_factory=list, description="Cited dossier evidence IDs (e.g. ['E1', 'E2'])")
    slots: Dict[str, Any] = Field(default_factory=dict, description="Typed slot payload for the specific scene kind")
    precondition_status: Dict[str, Any] = Field(default_factory=dict, description="Precondition validation result")
    illustrative_data: Dict[str, Any] = Field(default_factory=dict, description="Sample illustrative data with is_example flag")
    evidence: Optional[EvidenceItem] = Field(None, description="Primary verified source code evidence")
    evidence_items: List[EvidenceItem] = Field(default_factory=list, description="All verified evidence items for this stage")
    data_in: Optional[Dict[str, Any]] = Field(None, description="Representation of incoming data payload")
    data_out: Optional[Dict[str, Any]] = Field(None, description="Representation of outgoing data payload")
    visual_data: Dict[str, Any] = Field(default_factory=dict, description="Stage-specific visual layout hints (fan_out_fan_in, etc.)")
    duration_seconds: int = Field(8, description="Recommended display duration in seconds")


class ProjectStory(BaseModel):
    repo_url: str = Field(..., description="Normalized repository URL")
    commit_sha: Optional[str] = Field(None, description="Repository commit SHA or branch identifier")
    generated_at: str = Field(..., description="ISO 8601 generation timestamp")
    project_title: str = Field(..., description="Title of the analyzed project")
    project_summary: str = Field(..., description="1-2 sentence core purpose of the project")
    archetype: str = Field("general_application", description="Derived project archetype (rag_pipeline, fullstack_application, web_api, modular_library, general_application, unknown)")
    input_description: str = Field(..., description="What enters the system")
    output_description: str = Field(..., description="What comes out of the system")
    overall_flow: List[str] = Field(default_factory=list, description="Ordered names of the major stages")
    stages: List[StoryStage] = Field(default_factory=list, description="Coherent set of proven major logical stages")
    total_duration_seconds: int = Field(60, description="Calculated total video duration in seconds")
    confidence: str = Field("high", description="Story-level confidence: high or medium")
    closing_recap: Optional[str] = Field(None, description="Closing one-line technical recap derived from the story")
    evidence_summary: Dict[str, Any] = Field(default_factory=dict, description="Provenance summary metrics")
    dossier: List[Dict[str, Any]] = Field(default_factory=list, description="Compact list of verified evidence facts with source snippets")
    proven_chain: List[str] = Field(default_factory=list, description="Ordered chain of dossier IDs")
    validation_report: Dict[str, Any] = Field(default_factory=dict, description="Deterministic validation outcome")


class WalkthroughResponse(BaseModel):
    """
    Top-level response for Visual Walkthrough v1.
    """
    repository_url: str = Field(..., description="Analyzed repository URL")
    project_title: str = Field(..., description="Repository or project title")
    project_summary: str = Field(..., description="High-level project purpose")
    overview_flow: List[str] = Field(
        ...,
        description="Sequential stages of the overall project flow derived from repository evidence",
    )
    walkthroughs: List[WalkthroughConcept] = Field(
        ...,
        description="Supported walkthrough concepts grounded in repository evidence",
    )
    project_story: Optional[ProjectStory] = Field(
        None,
        description="Evidence-backed pedagogical project story for the Walkthrough Video",
    )
    reason_code: Optional[str] = Field(
        None,
        description="Machine-readable reason code when project_story is null",
    )
    status_message: Optional[str] = Field(
        None,
        description="Human-readable status message for UI presentation",
    )


