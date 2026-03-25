"""Shared Pydantic response schemas."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated list wrapper.

    Example response::

        {
            "items": [...],
            "total": 42,
            "skip": 0,
            "limit": 50
        }
    """

    items: list[T]
    total: int
    skip: int
    limit: int


class ErrorResponse(BaseModel):
    """Standard error body returned on 4xx/5xx responses."""

    detail: str
