"""Host correlation API — Task 3.10.

Endpoints
---------
GET  /hosts              — list hosts for a project (enriched summary)
GET  /hosts/{id}         — full host detail: ports, findings, credentials, scans
POST /hosts              — create host manually
PATCH /hosts/{id}        — update hostname / os / notes
DELETE /hosts/{id}       — delete host
POST /hosts/{id}/enrich  — enrich with Shodan data if connected
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.base import new_uuid
from backend.models.credential import Credential
from backend.models.finding import Finding
from backend.models.host import Host
from backend.models.port import Port
from backend.models.scan import Scan

logger = logging.getLogger("zeronyx.hosts")

router = APIRouter(prefix="/hosts", tags=["hosts"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class HostSummary(BaseModel):
    id: str
    project_id: str
    ip: str
    hostname: str | None
    os: str | None
    mac: str | None
    vendor: str | None
    state: str
    last_seen: str | None
    port_count: int
    open_port_numbers: list[int]
    finding_counts: dict[str, int]          # severity → count
    finding_total: int
    credential_count: int
    tool_sources: list[str]                  # tools that produced findings for this host
    scan_count: int


class PortOut(BaseModel):
    id: str
    number: int
    protocol: str
    state: str
    service: str | None
    version: str | None
    banner: str | None


class FindingSummary(BaseModel):
    id: str
    title: str
    severity: str
    status: str
    cvss: float | None
    cve: str | None
    tool_source: str | None
    description: str | None
    created_at: str


class CredSummary(BaseModel):
    id: str
    service: str | None
    username: str | None
    password: str | None
    verified: bool


class ScanSummary(BaseModel):
    id: str
    tool: str
    status: str
    started_at: str | None
    finished_at: str | None


class HostDetail(BaseModel):
    id: str
    project_id: str
    ip: str
    hostname: str | None
    os: str | None
    os_accuracy: int | None
    mac: str | None
    vendor: str | None
    state: str
    last_seen: str | None
    ports: list[PortOut]
    findings: list[FindingSummary]
    credentials: list[CredSummary]
    scans: list[ScanSummary]
    finding_counts: dict[str, int]
    tool_sources: list[str]


class HostCreate(BaseModel):
    project_id: str
    ip: str
    hostname: str | None = None
    os: str | None = None


class HostPatch(BaseModel):
    hostname: str | None = None
    os: str | None = None
    state: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_404(host_id: str, db: Session) -> Host:
    h = db.query(Host).filter(Host.id == host_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Host not found")
    return h


def _finding_counts(findings: list[Finding]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    return counts


def _tool_sources(findings: list[Finding]) -> list[str]:
    seen: set[str] = set()
    result = []
    for f in findings:
        if f.tool_source and f.tool_source not in seen:
            seen.add(f.tool_source)
            result.append(f.tool_source)
    return result


def _build_summary(h: Host, db: Session) -> HostSummary:
    open_ports = [p for p in h.ports if p.state == "open"]
    open_nums  = sorted(p.number for p in open_ports)[:20]  # cap for display

    # Scans that produced findings for this host
    scan_ids = {f.scan_id for f in h.findings if f.scan_id}
    scan_count = len(scan_ids)

    return HostSummary(
        id=h.id,
        project_id=h.project_id,
        ip=h.ip,
        hostname=h.hostname,
        os=h.os,
        mac=h.mac,
        vendor=h.vendor,
        state=h.state,
        last_seen=h.last_seen.isoformat() if h.last_seen else None,
        port_count=len(open_ports),
        open_port_numbers=open_nums,
        finding_counts=_finding_counts(h.findings),
        finding_total=len(h.findings),
        credential_count=len(h.credentials),
        tool_sources=_tool_sources(h.findings),
        scan_count=scan_count,
    )


def _build_detail(h: Host, db: Session) -> HostDetail:
    # Related scans (via findings)
    scan_ids = {f.scan_id for f in h.findings if f.scan_id}
    scans = db.query(Scan).filter(Scan.id.in_(scan_ids)).all() if scan_ids else []

    # Sort findings by severity
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    sorted_findings = sorted(h.findings, key=lambda f: sev_order.get(f.severity, 5))

    # Sort ports by number
    sorted_ports = sorted(h.ports, key=lambda p: p.number)

    return HostDetail(
        id=h.id,
        project_id=h.project_id,
        ip=h.ip,
        hostname=h.hostname,
        os=h.os,
        os_accuracy=h.os_accuracy,
        mac=h.mac,
        vendor=h.vendor,
        state=h.state,
        last_seen=h.last_seen.isoformat() if h.last_seen else None,
        ports=[
            PortOut(
                id=p.id, number=p.number, protocol=p.protocol,
                state=p.state, service=p.service, version=p.version,
                banner=(p.banner or "")[:300] or None,
            )
            for p in sorted_ports
        ],
        findings=[
            FindingSummary(
                id=f.id, title=f.title, severity=f.severity, status=f.status,
                cvss=f.cvss, cve=f.cve, tool_source=f.tool_source,
                description=f.description, created_at=f.created_at.isoformat(),
            )
            for f in sorted_findings
        ],
        credentials=[
            CredSummary(
                id=c.id, service=c.service, username=c.username,
                password=c.password, verified=c.verified,
            )
            for c in h.credentials
        ],
        scans=[
            ScanSummary(
                id=s.id, tool=s.tool, status=s.status,
                started_at=s.started_at.isoformat() if s.started_at else None,
                finished_at=s.finished_at.isoformat() if s.finished_at else None,
            )
            for s in sorted(scans, key=lambda s: s.started_at or s.created_at, reverse=True)
        ],
        finding_counts=_finding_counts(h.findings),
        tool_sources=_tool_sources(h.findings),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_hosts(
    project_id: str = Query(...),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """List all hosts for a project with enriched summary."""
    query = db.query(Host).filter(Host.project_id == project_id)
    if q:
        term = f"%{q.lower()}%"
        query = query.filter(
            Host.ip.ilike(term) |
            Host.hostname.ilike(term) |
            Host.os.ilike(term)
        )

    hosts = query.order_by(Host.ip).all()
    return {
        "items": [_build_summary(h, db) for h in hosts],
        "total": len(hosts),
    }


@router.get("/{host_id}")
def get_host(host_id: str, db: Session = Depends(get_db)):
    """Full host detail with all correlated data."""
    h = _get_or_404(host_id, db)
    return _build_detail(h, db)


@router.post("", status_code=201)
def create_host(payload: HostCreate, db: Session = Depends(get_db)):
    """Manually add a host to a project."""
    existing = db.query(Host).filter(
        Host.project_id == payload.project_id, Host.ip == payload.ip
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Host with this IP already exists in project")

    from datetime import datetime, timezone
    h = Host(
        id=new_uuid(),
        project_id=payload.project_id,
        ip=payload.ip.strip(),
        hostname=payload.hostname,
        os=payload.os,
        state="unknown",
        last_seen=datetime.now(timezone.utc),
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _build_summary(h, db)


@router.patch("/{host_id}")
def update_host(host_id: str, payload: HostPatch, db: Session = Depends(get_db)):
    h = _get_or_404(host_id, db)
    updates = payload.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return _build_summary(h, db)


@router.delete("/{host_id}", status_code=204)
def delete_host(host_id: str, db: Session = Depends(get_db)):
    h = _get_or_404(host_id, db)
    db.delete(h)
    db.commit()


@router.post("/{host_id}/enrich")
async def enrich_host(host_id: str, db: Session = Depends(get_db)):
    """Pull Shodan data for this host and create/update port records."""
    h = _get_or_404(host_id, db)

    from backend.services.shodan_service import shodan_service

    if not shodan_service.is_connected():
        ok = await shodan_service.auto_connect()
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="Shodan not connected. Open the Shodan page and connect first."
            )

    try:
        data = await shodan_service.get_host(h.ip)
    except Exception as exc:
        msg = str(exc)
        if "No information available" in msg or "404" in msg:
            raise HTTPException(status_code=404, detail=f"No Shodan data for {h.ip}")
        raise HTTPException(status_code=502, detail=f"Shodan error: {msg}")

    added_ports = 0
    from datetime import datetime, timezone

    for svc in data.get("services", []):
        port_num = svc.get("port")
        if not port_num:
            continue
        proto = svc.get("transport", "tcp").lower()
        existing = db.query(Port).filter(
            Port.host_id == h.id,
            Port.number == port_num,
            Port.protocol == proto,
        ).first()
        if not existing:
            product = svc.get("product")
            version = svc.get("version")
            new_port = Port(
                id=new_uuid(),
                host_id=h.id,
                number=port_num,
                protocol=proto,
                state="open",
                service=product,
                version=version,
                banner=svc.get("banner") or None,
            )
            db.add(new_port)
            added_ports += 1

    # Update host metadata from Shodan
    if data.get("os") and not h.os:
        h.os = data["os"]
    if data.get("hostnames") and not h.hostname:
        h.hostname = data["hostnames"][0]
    h.last_seen = datetime.now(timezone.utc)

    db.commit()
    db.refresh(h)
    logger.info("Enriched host %s from Shodan: +%d ports", h.ip, added_ports)
    return {**_build_summary(h, db).model_dump(), "shodan_ports_added": added_ports}
