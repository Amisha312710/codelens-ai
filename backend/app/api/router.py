from fastapi import APIRouter

from app.api.routes import (
    repositories,
    analysis,
    search,
    flows,
    walkthroughs,
)

api_router = APIRouter()

# Include feature route modules
api_router.include_router(repositories.router)
api_router.include_router(analysis.router)
api_router.include_router(search.router)
api_router.include_router(flows.router)
api_router.include_router(walkthroughs.router)
