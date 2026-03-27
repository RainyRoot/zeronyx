"""Credential Store API — Task 2.10.

Endpoints
---------
GET    /api/credentials               — list credentials (filter by project_id)
POST   /api/credentials               — create credential manually
PATCH  /api/credentials/{id}          — update (edit / verify)
DELETE /api/credentials/{id}          — delete
POST   /api/credentials/import/{scan_id} — import all credentials from a completed scan
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import Pagination, get_db
from backend.api.schemas import PaginatedResponse
from backend.models.base import new_uuid
from backend.models.credential import Credential
from backend.models.scan import Scan, ScanResult

router = APIRouter(prefix="/credentials", tags=["credentials"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CredentialCreate(BaseModel):
    project_id: str
    service: str | None = None
    username: str | None = None
    password: str | None = None
    hash: str | None = None
    hash_type: str | None = None
    verified: bool = False


class CredentialUpdate(BaseModel):
    service: str | None = None
    username: str | None = None
    password: str | None = None
    hash: str | None = None
    hash_type: str | None = None
    verified: bool | None = None


class CredentialResponse(BaseModel):
    id: str
    project_id: str
    source_scan: str | None
    service: str | None
    username: str | None
    password: str | None
    hash: str | None
    hash_type: str | None
    verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    imported: int
    skipped: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedResponse[CredentialResponse])
def list_credentials(
    p: Annotated[Pagination, Depends()],
    db: Session = Depends(get_db),
    project_id: str = Query(..., description="Filter by project"),
    service: str | None = Query(None),
    verified: bool | None = Query(None),
):
    q = db.query(Credential).filter(Credential.project_id == project_id)
    if service:
        q = q.filter(Credential.service == service)
    if verified is not None:
        q = q.filter(Credential.verified == verified)
    total = q.count()
    items = q.order_by(Credential.created_at.desc()).offset(p.skip).limit(p.limit).all()
    return PaginatedResponse(items=items, total=total, skip=p.skip, limit=p.limit)


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
def create_credential(payload: CredentialCreate, db: Session = Depends(get_db)):
    cred = Credential(id=new_uuid(), **payload.model_dump())
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


@router.patch("/{cred_id}", response_model=CredentialResponse)
def update_credential(cred_id: str, payload: CredentialUpdate, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cred, field, value)
    db.commit()
    db.refresh(cred)
    return cred


@router.delete("/{cred_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credential(cred_id: str, db: Session = Depends(get_db)):
    cred = db.query(Credential).filter(Credential.id == cred_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    db.delete(cred)
    db.commit()


@router.post("/import/{scan_id}", response_model=ImportResult)
def import_from_scan(
    scan_id: str,
    project_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Import credentials from a completed scan's parsed results into the store."""
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.project_id == project_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    if scan.status != "completed":
        raise HTTPException(status_code=400, detail="Scan is not completed yet")

    result = db.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()
    if not result or not result.parsed:
        raise HTTPException(status_code=404, detail="No parsed results for this scan")

    try:
        parsed = json.loads(result.parsed)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not parse scan result JSON")

    raw_creds: list[dict] = parsed.get("credentials", [])
    imported = 0
    skipped = 0

    for c in raw_creds:
        username = c.get("username")
        password = c.get("password")
        service = c.get("service")

        # Skip duplicates (same project + service + username + password)
        exists = (
            db.query(Credential)
            .filter(
                Credential.project_id == project_id,
                Credential.service == service,
                Credential.username == username,
                Credential.password == password,
            )
            .first()
        )
        if exists:
            skipped += 1
            continue

        cred = Credential(
            id=new_uuid(),
            project_id=project_id,
            source_scan=scan_id,
            service=service,
            username=username,
            password=password,
            verified=True,
        )
        db.add(cred)
        imported += 1

    db.commit()
    return ImportResult(imported=imported, skipped=skipped)
