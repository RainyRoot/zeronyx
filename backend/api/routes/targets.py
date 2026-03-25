from fastapi import APIRouter

router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("")
def list_targets():
    # Stub — implemented in task 1.8
    return []
