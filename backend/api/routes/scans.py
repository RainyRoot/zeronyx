from typing import Annotated

from fastapi import APIRouter, Depends

from backend.api.deps import Pagination

router = APIRouter(prefix="/scans", tags=["scans"])


@router.get("")
def list_scans(p: Annotated[Pagination, Depends()]):
    # Stub — full implementation in task 1.10+
    return {"items": [], "total": 0, "skip": p.skip, "limit": p.limit}
