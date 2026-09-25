from pydantic import BaseModel


class WalkthroughRequest(BaseModel):
    repository_id: int


class WalkthroughResponse(BaseModel):
    repository_id: int
    status: str = "unimplemented"
