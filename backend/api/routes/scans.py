from fastapi import APIRouter

router = APIRouter(prefix="/scans", tags=["scans"])


@router.get("")
def list_scans():
    # Stub — implemented in task 1.10+
    return []
