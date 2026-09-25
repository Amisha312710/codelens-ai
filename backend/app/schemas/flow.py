from pydantic import BaseModel


class FlowRequest(BaseModel):
    repository_id: int
    entry_point: str


class FlowResponse(BaseModel):
    entry_point: str
    status: str = "unimplemented"
