from fastapi import APIRouter
from backend.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings():
    # Stub — exposes non-sensitive config, expanded in task 1.13
    return {
        "env": settings.env,
        "version": "0.1.0",
    }
