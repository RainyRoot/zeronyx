"""Findings REST API — Task 3.9.

Endpoints
---------
GET    /findings              — list findings (project_id required)
GET    /findings/stats        — severity + tool breakdown counts
GET    /findings/{id}         — get single finding
POST   /findings              — create manual finding
PATCH  /findings/{id}         — update status / description / remediation
DELETE /findings/{id}         — delete finding
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.deps import Pagination, get_db
from backend.models.base import new_uuid
from backend.models.finding import Finding
from backend.models.host import Host
from backend.models.scan import Scan

router = APIRouter(prefix="/findings", tags=["findings"])

VALID_SEVERITIES = {"critical", "high", "medium", "low", "info"}
VALID_STATUSES   = {"open", "confirmed", "false_positive", "resolved"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FindingOut(BaseModel):
    id: str
    project_id: str
    scan_id: str | None
    host_id: str | None
    title: str
    severity: str
    cvss: float | None
    cve: str | None
    description: str | None
    remediation: str | None
    tool_source: str | None
    status: str
    created_at: str
    updated_at: str
    # Denormalised extras (joined from related tables)
    host_ip: str | None = None
    scan_tool: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, f: Finding, host_ip: str | None = None, scan_tool: str | None = None) -> "FindingOut":
        return cls(
            id=f.id,
            project_id=f.project_id,
            scan_id=f.scan_id,
            host_id=f.host_id,
            title=f.title,
            severity=f.severity,
            cvss=f.cvss,
            cve=f.cve,
            description=f.description,
            remediation=f.remediation,
            tool_source=f.tool_source,
            status=f.status,
            created_at=f.created_at.isoformat(),
            updated_at=f.updated_at.isoformat(),
            host_ip=host_ip,
            scan_tool=scan_tool,
        )


class FindingCreate(BaseModel):
    project_id: str
    scan_id: str | None = None
    title: str
    severity: str = "info"
    cvss: float | None = None
    cve: str | None = None
    description: str | None = None
    remediation: str | None = None
    tool_source: str | None = None


class FindingPatch(BaseModel):
    title: str | None = None
    severity: str | None = None
    status: str | None = None
    cvss: float | None = None
    cve: str | None = None
    description: str | None = None
    remediation: str | None = None


class FindingStatsOut(BaseModel):
    total: int
    by_severity: dict[str, int]
    by_tool: dict[str, int]
    by_status: dict[str, int]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_404(finding_id: str, db: Session) -> Finding:
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return f


def _enrich(f: Finding, db: Session) -> FindingOut:
    host_ip = None
    if f.host_id:
        h = db.query(Host).filter(Host.id == f.host_id).first()
        if h:
            host_ip = h.ip
    scan_tool = f.tool_source  # already stored; scan lookup only if missing
    return FindingOut.from_orm(f, host_ip=host_ip, scan_tool=scan_tool)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=FindingStatsOut)
def get_stats(
    project_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Return severity / tool / status breakdown for a project's findings."""
    base = db.query(Finding).filter(Finding.project_id == project_id)
    total = base.count()

    def _count_by(col: Any) -> dict[str, int]:
        rows = (
            db.query(col, func.count(Finding.id))
            .filter(Finding.project_id == project_id)
            .group_by(col)
            .all()
        )
        return {str(k): v for k, v in rows if k is not None}

    return FindingStatsOut(
        total=total,
        by_severity=_count_by(Finding.severity),
        by_tool=_count_by(Finding.tool_source),
        by_status=_count_by(Finding.status),
    )


@router.get("")
def list_findings(
    project_id: str = Query(...),
    severity: str | None = Query(None),
    tool: str | None = Query(None),
    status: str | None = Query(None),
    q: str | None = Query(None),
    p: Annotated[Pagination, Depends()] = ...,
    db: Session = Depends(get_db),
):
    """List findings for a project with optional filters."""
    query = db.query(Finding).filter(Finding.project_id == project_id)

    if severity:
        query = query.filter(Finding.severity == severity)
    if tool:
        query = query.filter(Finding.tool_source == tool)
    if status:
        query = query.filter(Finding.status == status)
    if q:
        term = f"%{q.lower()}%"
        query = query.filter(
            Finding.title.ilike(term) |
            Finding.description.ilike(term) |
            Finding.cve.ilike(term)
        )

    # Severity order: critical > high > medium > low > info
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings = query.all()
    findings.sort(key=lambda f: sev_order.get(f.severity, 5))

    total = len(findings)
    page  = findings[p.skip : p.skip + p.limit]

    return {
        "items": [_enrich(f, db) for f in page],
        "total": total,
        "skip": p.skip,
        "limit": p.limit,
    }


@router.get("/{finding_id}")
def get_finding(finding_id: str, db: Session = Depends(get_db)):
    return _enrich(_get_or_404(finding_id, db), db)


@router.post("", status_code=201)
def create_finding(payload: FindingCreate, db: Session = Depends(get_db)):
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"severity must be one of {sorted(VALID_SEVERITIES)}")
    f = Finding(
        id=new_uuid(),
        project_id=payload.project_id,
        scan_id=payload.scan_id,
        title=payload.title,
        severity=payload.severity,
        cvss=payload.cvss,
        cve=payload.cve,
        description=payload.description,
        remediation=payload.remediation,
        tool_source=payload.tool_source or "manual",
        status="open",
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _enrich(f, db)


@router.patch("/{finding_id}")
def update_finding(finding_id: str, payload: FindingPatch, db: Session = Depends(get_db)):
    f = _get_or_404(finding_id, db)
    updates = payload.model_dump(exclude_unset=True)

    if "severity" in updates and updates["severity"] not in VALID_SEVERITIES:
        raise HTTPException(status_code=400, detail=f"Invalid severity")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status")

    for k, v in updates.items():
        setattr(f, k, v)

    db.commit()
    db.refresh(f)
    return _enrich(f, db)


@router.delete("/{finding_id}", status_code=204)
def delete_finding(finding_id: str, db: Session = Depends(get_db)):
    f = _get_or_404(finding_id, db)
    db.delete(f)
    db.commit()
