"""Scans REST API — Task 1.10.

Endpoints
---------
GET    /scans                    — list scans (filter by project_id)
POST   /scans                    — create a scan record
GET    /scans/{id}               — get scan + result detail
POST   /scans/{id}/start         — start a pending scan (background task)
POST   /scans/{id}/cancel        — cancel a running scan
DELETE /scans/{id}               — delete scan record
GET    /tools/{tool}/profiles    — default scan profiles for a tool
GET    /tools                    — list all registered tools + install status
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.adapters import get_adapter, list_adapters
from backend.api.deps import Pagination, get_db
from backend.api.schemas import PaginatedResponse
from backend.models.base import new_uuid
from backend.models.scan import Scan, ScanResult
from backend.services import task_registry
from backend.services.scan_service import ScanService

logger = logging.getLogger("zeronyx.scans")

router = APIRouter(tags=["scans"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScanCreate(BaseModel):
    project_id: str
    tool: str
    target_id: str | None = None
    profile: str | None = None
    config: dict[str, Any] = {}


class ScanResponse(BaseModel):
    id: str
    project_id: str
    target_id: str | None
    tool: str
    profile: str | None
    config: dict[str, Any] | None
    status: str
    started_at: str | None
    finished_at: str | None
    error: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm(cls, obj: Scan) -> "ScanResponse":
        return cls(
            id=obj.id,
            project_id=obj.project_id,
            target_id=obj.target_id,
            tool=obj.tool,
            profile=obj.profile,
            config=json.loads(obj.config) if obj.config else None,
            status=obj.status,
            started_at=obj.started_at.isoformat() if obj.started_at else None,
            finished_at=obj.finished_at.isoformat() if obj.finished_at else None,
            error=obj.error,
            created_at=obj.created_at.isoformat(),
            updated_at=obj.updated_at.isoformat(),
        )


class ScanDetailResponse(ScanResponse):
    raw_output: str | None = None
    parsed: dict[str, Any] | None = None

    @classmethod
    def from_orm_with_result(cls, obj: Scan) -> "ScanDetailResponse":
        base = ScanResponse.from_orm(obj)
        raw_output = None
        parsed = None
        if obj.result:
            raw_output = obj.result.raw_output
            if obj.result.parsed:
                try:
                    parsed = json.loads(obj.result.parsed)
                except (json.JSONDecodeError, TypeError):
                    pass
        return cls(
            **base.model_dump(),
            raw_output=raw_output,
            parsed=parsed,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_scan_or_404(scan_id: str, db: Session) -> Scan:
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


# ---------------------------------------------------------------------------
# Endpoints — Scans
# ---------------------------------------------------------------------------

@router.get("/scans", response_model=PaginatedResponse[ScanResponse])
def list_scans(
    p: Annotated[Pagination, Depends()],
    db: Session = Depends(get_db),
    project_id: str = Query(..., description="Filter by project"),
    target_id: str | None = Query(None),
    tool: str | None = Query(None),
):
    q = db.query(Scan).filter(Scan.project_id == project_id)
    if target_id:
        q = q.filter(Scan.target_id == target_id)
    if tool:
        q = q.filter(Scan.tool == tool)
    total = q.count()
    items = q.order_by(Scan.created_at.desc()).offset(p.skip).limit(p.limit).all()
    return PaginatedResponse(
        items=[ScanResponse.from_orm(s) for s in items],
        total=total,
        skip=p.skip,
        limit=p.limit,
    )


@router.post("/scans", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
def create_scan(payload: ScanCreate, db: Session = Depends(get_db)):
    # Validate tool is registered
    try:
        get_adapter(payload.tool)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown tool: '{payload.tool}'")

    scan = Scan(
        id=new_uuid(),
        project_id=payload.project_id,
        target_id=payload.target_id,
        tool=payload.tool,
        profile=payload.profile,
        config=json.dumps(payload.config),
        status="pending",
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ScanResponse.from_orm(scan)


@router.get("/scans/{scan_id}", response_model=ScanDetailResponse)
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = _get_scan_or_404(scan_id, db)
    return ScanDetailResponse.from_orm_with_result(scan)


@router.post("/scans/{scan_id}/start", response_model=ScanResponse)
async def start_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = _get_scan_or_404(scan_id, db)

    if scan.status == "running":
        raise HTTPException(status_code=409, detail="Scan is already running")
    if scan.status in ("completed", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Scan already finished with status '{scan.status}'. Create a new scan.",
        )
    if task_registry.is_running(scan_id):
        raise HTTPException(status_code=409, detail="Scan task is already active")

    config: dict[str, Any] = json.loads(scan.config) if scan.config else {}

    async def _run() -> None:
        try:
            service = ScanService(db)
            await service.run(scan_id=scan_id, tool=scan.tool, config=config)
        except Exception as exc:
            logger.exception("Unhandled error in scan task scan=%s: %s", scan_id, exc)
        finally:
            task_registry.remove(scan_id)

    task = asyncio.create_task(_run(), name=f"scan:{scan_id}")
    task_registry.register(scan_id, task)

    db.refresh(scan)
    return ScanResponse.from_orm(scan)


@router.post("/scans/{scan_id}/cancel", response_model=ScanResponse)
async def cancel_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = _get_scan_or_404(scan_id, db)

    if scan.status not in ("pending", "running"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel a scan with status '{scan.status}'",
        )

    cancelled = task_registry.cancel(scan_id)
    if not cancelled:
        # No live task — mark directly
        scan.status = "cancelled"
        db.commit()
        db.refresh(scan)

    db.refresh(scan)
    return ScanResponse.from_orm(scan)


@router.get("/scans/{scan_id}/results")
def get_scan_results(scan_id: str, db: Session = Depends(get_db)):
    """Return hosts and ports discovered by this scan."""
    from backend.models.host import Host
    from backend.models.port import Port

    _get_scan_or_404(scan_id, db)

    ports_q = db.query(Port).filter(Port.scan_id == scan_id).all()
    host_ids = {p.host_id for p in ports_q}
    hosts_q = db.query(Host).filter(Host.id.in_(host_ids)).all() if host_ids else []

    def _host(h: Host) -> dict:
        return {
            "id": h.id,
            "ip": h.ip,
            "hostname": h.hostname,
            "os": h.os,
            "os_accuracy": h.os_accuracy,
            "mac": h.mac,
            "vendor": h.vendor,
            "state": h.state,
        }

    def _port(p: Port) -> dict:
        return {
            "id": p.id,
            "host_id": p.host_id,
            "number": p.number,
            "protocol": p.protocol,
            "state": p.state,
            "service": p.service,
            "version": p.version,
        }

    return {
        "hosts": [_host(h) for h in hosts_q],
        "ports": [_port(p) for p in ports_q],
    }


@router.delete("/scans/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = _get_scan_or_404(scan_id, db)
    if task_registry.is_running(scan_id):
        task_registry.cancel(scan_id)
    db.delete(scan)
    db.commit()


# ---------------------------------------------------------------------------
# Endpoints — Tools
# ---------------------------------------------------------------------------

@router.get("/tools")
def list_tools():
    """Return all registered tool adapters with install status."""
    result = []
    for name, cls in list_adapters():
        adapter = cls()
        result.append({
            "name": name,
            "installed": adapter.is_installed(),
            "binary_path": adapter.get_binary_path(),
        })
    return {"tools": result}


@router.get("/tools/{tool}/profiles")
def get_tool_profiles(tool: str):
    """Return default scan profiles for a tool."""
    try:
        adapter = get_adapter(tool)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown tool: '{tool}'")
    return {
        "tool": tool,
        "installed": adapter.is_installed(),
        "profiles": adapter.get_default_profiles(),
    }
