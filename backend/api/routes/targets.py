from typing import Annotated

from fastapi import APIRouter, Depends

from backend.api.deps import Pagination

router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("")
def list_targets(p: Annotated[Pagination, Depends()]):
    # Stub — full implementation in task 1.8
    return {"items": [], "total": 0, "skip": p.skip, "limit": p.limit}
