"""AI Analysis endpoints — Phase 4."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.ai_analysis import AIAnalysis
from backend.models.base import new_uuid
from backend.models.finding import Finding
from backend.models.host import Host
from backend.models.port import Port
from backend.models.scan import Scan, ScanResult
from backend.models.project import Project
from backend.services.ai_service import AIService
from backend.api.routes.app_settings import _load_user_settings

logger = logging.getLogger("zeronyx.ai")

router = APIRouter(prefix="/ai", tags=["ai"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_ai_service() -> AIService:
    settings = _load_user_settings()
    ai_cfg = settings.get("ai", {})
    return AIService(ai_cfg)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

PromptType = Literal["analyse", "false_positive", "exploits", "report"]


class AnalyseRequest(BaseModel):
    project_id: str
    context_type: Literal["scan", "finding", "host", "project"]
    context_id: str | None = None
    prompt_type: PromptType = "analyse"


class AnalysisResponse(BaseModel):
    id: str
    project_id: str
    context_type: str
    context_id: str | None
    provider: str | None
    model: str | None
    prompt_type: str | None
    response: str | None
    tokens_used: int | None
    sanitized: bool
    created_at: str


class AISettingsSchema(BaseModel):
    provider: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-6"
    sanitize_before_cloud: bool = True
    enabled: bool = True


# ---------------------------------------------------------------------------
# AI Settings endpoints
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=AISettingsSchema)
def get_ai_settings():
    """Return AI provider settings."""
    s = _load_user_settings()
    ai = s.get("ai", {})
    return AISettingsSchema(
        provider=ai.get("provider", "ollama"),
        ollama_url=ai.get("ollama_url", "http://localhost:11434"),
        ollama_model=ai.get("ollama_model", "llama3.2"),
        openai_api_key=ai.get("openai_api_key", ""),
        openai_model=ai.get("openai_model", "gpt-4o"),
        anthropic_api_key=ai.get("anthropic_api_key", ""),
        anthropic_model=ai.get("anthropic_model", "claude-opus-4-6"),
        sanitize_before_cloud=ai.get("sanitize_before_cloud", True),
        enabled=ai.get("enabled", True),
    )


@router.patch("/settings", response_model=AISettingsSchema)
def update_ai_settings(payload: AISettingsSchema):
    """Update AI provider settings."""
    from backend.api.routes.app_settings import _save_user_settings
    s = _load_user_settings()
    s["ai"] = payload.model_dump()
    _save_user_settings(s)
    return payload


# ---------------------------------------------------------------------------
# Connection test
# ---------------------------------------------------------------------------

class TestConnectionResponse(BaseModel):
    success: bool
    provider: str
    model: str
    message: str


@router.post("/test", response_model=TestConnectionResponse)
async def test_ai_connection():
    """Ping the configured AI provider with a minimal request."""
    svc = _get_ai_service()
    try:
        resp, _tokens, _san = await svc.analyse_scan({
            "tool": "test",
            "target": "test",
            "findings": [],
            "hosts": [],
            "ports": [],
        })
        return TestConnectionResponse(
            success=True,
            provider=svc.provider,
            model=svc.get_model_name(),
            message=f"Connected. Response preview: {resp[:80]}...",
        )
    except Exception as exc:
        return TestConnectionResponse(
            success=False,
            provider=svc.provider,
            model=svc.get_model_name(),
            message=str(exc),
        )


# ---------------------------------------------------------------------------
# Core analysis endpoint
# ---------------------------------------------------------------------------

def _row_to_response(row: AIAnalysis) -> AnalysisResponse:
    return AnalysisResponse(
        id=row.id,
        project_id=row.project_id,
        context_type=row.context_type,
        context_id=row.context_id,
        provider=row.provider,
        model=row.model,
        prompt_type=row.prompt_type,
        response=row.response,
        tokens_used=row.tokens_used,
        sanitized=row.sanitized,
        created_at=row.created_at.isoformat() if hasattr(row.created_at, "isoformat") else str(row.created_at),
    )


@router.post("/analyse", response_model=AnalysisResponse)
async def run_analysis(payload: AnalyseRequest, db: Session = Depends(get_db)):
    """Run an AI analysis.

    The endpoint builds the context from the DB (scan data, finding, host),
    calls the configured AI provider, persists the result, and returns it.
    """
    svc = _get_ai_service()

    # ---- Verify project exists ----
    project = db.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # ---- Build context data from DB ----
    ai_settings = _load_user_settings().get("ai", {})
    if not ai_settings.get("enabled", True):
        raise HTTPException(status_code=400, detail="AI is disabled in settings")

    try:
        if payload.context_type == "scan":
            response, tokens, sanitized = await _analyse_scan(svc, payload.context_id, db)
        elif payload.context_type == "finding":
            response, tokens, sanitized = await _analyse_finding(
                svc, payload.context_id, payload.prompt_type, db
            )
        elif payload.context_type == "host":
            response, tokens, sanitized = await _analyse_host(svc, payload.context_id, db)
        elif payload.context_type == "project":
            response, tokens, sanitized = await _analyse_project(svc, payload.project_id, db)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown context_type: {payload.context_type}")
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    # ---- Persist ----
    row = AIAnalysis(
        id=new_uuid(),
        project_id=payload.project_id,
        context_type=payload.context_type,
        context_id=payload.context_id,
        provider=svc.provider,
        model=svc.get_model_name(),
        prompt_type=payload.prompt_type,
        response=response,
        tokens_used=tokens,
        sanitized=sanitized,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------

async def _analyse_scan(svc: AIService, scan_id: str | None, db: Session):
    if not scan_id:
        raise HTTPException(status_code=400, detail="context_id (scan_id) required")
    scan = db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Gather ports & findings linked to this scan
    findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()
    ports    = db.query(Port).filter(Port.scan_id == scan_id).all()
    hosts    = db.query(Host).filter(Host.project_id == scan.project_id).all()

    scan_data = {
        "tool": scan.tool,
        "target": scan.target.value if scan.target else "",
        "findings": [
            {"title": f.title, "severity": f.severity, "cve": f.cve, "description": f.description}
            for f in findings
        ],
        "hosts": [
            {"ip": h.ip, "hostname": h.hostname, "os": h.os}
            for h in hosts[:30]
        ],
        "ports": [
            {"number": p.number, "protocol": p.protocol, "service": p.service, "version": p.version}
            for p in ports[:50]
        ],
    }
    return await svc.analyse_scan(scan_data)


async def _analyse_finding(svc: AIService, finding_id: str | None, prompt_type: str, db: Session):
    if not finding_id:
        raise HTTPException(status_code=400, detail="context_id (finding_id) required")
    finding = db.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding_data = {
        "title": finding.title,
        "severity": finding.severity,
        "cve": finding.cve,
        "description": finding.description,
        "tool_source": finding.tool_source,
        "remediation": finding.remediation,
    }

    if prompt_type == "false_positive":
        return await svc.analyse_finding(finding_data)
    return await svc.analyse_finding(finding_data)


async def _analyse_host(svc: AIService, host_id: str | None, db: Session):
    if not host_id:
        raise HTTPException(status_code=400, detail="context_id (host_id) required")
    host = db.get(Host, host_id)
    if not host:
        raise HTTPException(status_code=404, detail="Host not found")

    ports    = db.query(Port).filter(Port.host_id == host_id).all()
    findings = db.query(Finding).filter(Finding.host_id == host_id).all()

    host_data = {
        "ip": host.ip,
        "os": host.os,
        "ports": [
            {"number": p.number, "protocol": p.protocol, "service": p.service, "version": p.version}
            for p in ports
        ],
        "findings": [
            {"title": f.title, "severity": f.severity, "cve": f.cve}
            for f in findings
        ],
    }
    return await svc.suggest_exploits(host_data)


async def _analyse_project(svc: AIService, project_id: str, db: Session):
    project  = db.get(Project, project_id)
    hosts    = db.query(Host).filter(Host.project_id == project_id).all()
    findings = db.query(Finding).filter(Finding.project_id == project_id).all()

    sev_counts: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1

    # Top findings by severity
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    top = sorted(findings, key=lambda f: sev_order.get(f.severity, 5))[:20]

    # Build host IP lookup
    host_map = {h.id: h.ip for h in hosts}

    project_data = {
        "name": project.name if project else project_id,
        "total_findings": len(findings),
        "critical": sev_counts["critical"],
        "high": sev_counts["high"],
        "medium": sev_counts["medium"],
        "low": sev_counts["low"],
        "hosts": [{"ip": h.ip} for h in hosts],
        "top_findings": [
            {
                "title": f.title,
                "severity": f.severity,
                "host": host_map.get(f.host_id or "", "?"),
                "description": (f.description or "")[:200],
            }
            for f in top
        ],
    }
    return await svc.generate_report(project_data)


# ---------------------------------------------------------------------------
# List stored analyses
# ---------------------------------------------------------------------------

@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses(
    project_id: str,
    context_id: str | None = None,
    context_type: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Return stored AI analyses for a project."""
    q = db.query(AIAnalysis).filter(AIAnalysis.project_id == project_id)
    if context_id:
        q = q.filter(AIAnalysis.context_id == context_id)
    if context_type:
        q = q.filter(AIAnalysis.context_type == context_type)
    rows = q.order_by(AIAnalysis.created_at.desc()).limit(limit).all()
    return [_row_to_response(r) for r in rows]


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    row = db.get(AIAnalysis, analysis_id)
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return _row_to_response(row)


@router.delete("/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: str, db: Session = Depends(get_db)):
    row = db.get(AIAnalysis, analysis_id)
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found")
    db.delete(row)
    db.commit()
