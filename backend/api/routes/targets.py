import ipaddress
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from backend.api.deps import Pagination, get_db
from backend.api.schemas import PaginatedResponse
from backend.models.base import new_uuid
from backend.models.target import Target

router = APIRouter(prefix="/targets", tags=["targets"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9]"
    r"(?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+"
    r"[a-zA-Z]{2,}$"
)


def _infer_type(value: str) -> str:
    """Detect target type from value string."""
    v = value.strip()
    if "://" in v:
        return "url"
    if "/" in v:
        try:
            ipaddress.ip_network(v, strict=False)
            return "cidr"
        except ValueError:
            return "url"
    try:
        ipaddress.ip_address(v)
        return "ip"
    except ValueError:
        pass
    if _DOMAIN_RE.match(v):
        return "domain"
    return "url"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

VALID_TYPES = {"ip", "domain", "cidr", "url"}


class TargetCreate(BaseModel):
    project_id: str
    value: str
    type: str | None = None  # auto-detected if omitted
    notes: str | None = None
    tags: str | None = None  # JSON array string

    @field_validator("value")
    @classmethod
    def value_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("value must not be empty")
        return v.strip()

    @field_validator("type")
    @classmethod
    def type_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_TYPES)}")
        return v


class TargetUpdate(BaseModel):
    value: str | None = None
    type: str | None = None
    notes: str | None = None
    tags: str | None = None

    @field_validator("type")
    @classmethod
    def type_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"type must be one of {sorted(VALID_TYPES)}")
        return v


class TargetResponse(BaseModel):
    id: str
    project_id: str
    value: str
    type: str
    notes: str | None
    tags: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_str_dates(cls, obj: Target) -> "TargetResponse":
        return cls(
            id=obj.id,
            project_id=obj.project_id,
            value=obj.value,
            type=obj.type,
            notes=obj.notes,
            tags=obj.tags,
            created_at=obj.created_at.isoformat(),
            updated_at=obj.updated_at.isoformat(),
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedResponse[TargetResponse])
def list_targets(
    p: Annotated[Pagination, Depends()],
    db: Session = Depends(get_db),
    project_id: str = Query(..., description="Filter targets by project"),
):
    q = db.query(Target).filter(Target.project_id == project_id)
    total = q.count()
    items = q.order_by(Target.created_at.asc()).offset(p.skip).limit(p.limit).all()
    return PaginatedResponse(
        items=[TargetResponse.from_orm_str_dates(t) for t in items],
        total=total,
        skip=p.skip,
        limit=p.limit,
    )


@router.post("", response_model=TargetResponse, status_code=status.HTTP_201_CREATED)
def create_target(payload: TargetCreate, db: Session = Depends(get_db)):
    target_type = payload.type or _infer_type(payload.value)
    target = Target(
        id=new_uuid(),
        project_id=payload.project_id,
        value=payload.value,
        type=target_type,
        notes=payload.notes,
        tags=payload.tags,
    )
    db.add(target)
    db.commit()
    db.refresh(target)
    return TargetResponse.from_orm_str_dates(target)


@router.get("/{target_id}", response_model=TargetResponse)
def get_target(target_id: str, db: Session = Depends(get_db)):
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return TargetResponse.from_orm_str_dates(target)


@router.patch("/{target_id}", response_model=TargetResponse)
def update_target(target_id: str, payload: TargetUpdate, db: Session = Depends(get_db)):
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    updates = payload.model_dump(exclude_unset=True)
    if "value" in updates and "type" not in updates:
        updates["type"] = _infer_type(updates["value"])
    for field, value in updates.items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return TargetResponse.from_orm_str_dates(target)


@router.delete("/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_target(target_id: str, db: Session = Depends(get_db)):
    target = db.query(Target).filter(Target.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    db.delete(target)
    db.commit()
