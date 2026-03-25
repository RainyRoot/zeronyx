"""Shared FastAPI dependency classes and functions."""
from __future__ import annotations

from fastapi import Query
from sqlalchemy.orm import Session

from backend.database import get_db as _get_db  # noqa: F401 — re-exported

# Re-export so routes can import from a single place
get_db = _get_db


class Pagination:
    """Query-parameter dependency for list endpoints.

    Usage::

        @router.get("")
        def list_things(p: Annotated[Pagination, Depends()], db: Session = Depends(get_db)):
            items = db.query(Thing).offset(p.skip).limit(p.limit).all()
    """

    def __init__(
        self,
        skip: int = Query(0, ge=0, description="Number of records to skip"),
        limit: int = Query(50, ge=1, le=500, description="Max records to return"),
    ) -> None:
        self.skip = skip
        self.limit = limit
