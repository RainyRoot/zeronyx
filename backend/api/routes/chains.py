"""Chain Engine REST API — Phase 4.5/4.6."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.base import new_uuid
from backend.models.chain import Chain, ChainRun
from backend.services.chain_service import ChainEngine, STANDARD_CHAINS

logger = logging.getLogger("zeronyx.chains")

router = APIRouter(prefix="/chains", tags=["chains"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChainStepSchema(BaseModel):
    id: str
    type: str = "scan"
    tool: str | None = None
    label: str | None = None
    config: dict[str, Any] = {}
    depends_on: str | None = None
    condition: str | None = None
    continue_on_error: bool = False


class ChainCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    steps: list[ChainStepSchema] = []
    trigger_on: str = "manual"


class ChainUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list[ChainStepSchema] | None = None
    trigger_on: str | None = None
    enabled: bool | None = None


class ChainResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    steps: list[dict]
    trigger_on: str
    enabled: bool
    last_run: str | None
    last_status: str | None
    created_at: str


class ChainRunResponse(BaseModel):
    id: str
    chain_id: str
    project_id: str
    status: str
    step_results: dict[str, Any]
    error: str | None
    started_at: str | None
    finished_at: str | None
    created_at: str


class RunChainRequest(BaseModel):
    target_id: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chain_to_resp(c: Chain) -> ChainResponse:
    return ChainResponse(
        id=c.id,
        project_id=c.project_id,
        name=c.name,
        description=c.description,
        steps=json.loads(c.steps or "[]"),
        trigger_on=c.trigger_on,
        enabled=c.enabled,
        last_run=c.last_run,
        last_status=c.last_status,
        created_at=c.created_at.isoformat() if hasattr(c.created_at, "isoformat") else str(c.created_at),
    )


def _run_to_resp(r: ChainRun) -> ChainRunResponse:
    return ChainRunResponse(
        id=r.id,
        chain_id=r.chain_id,
        project_id=r.project_id,
        status=r.status,
        step_results=json.loads(r.step_results or "{}"),
        error=r.error,
        started_at=r.started_at,
        finished_at=r.finished_at,
        created_at=r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
    )


# ---------------------------------------------------------------------------
# Standard chains endpoint (read-only templates)
# ---------------------------------------------------------------------------

@router.get("/templates")
def list_templates():
    """Return built-in standard chain templates."""
    return {"templates": STANDARD_CHAINS}


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ChainResponse])
def list_chains(project_id: str, db: Session = Depends(get_db)):
    rows = db.query(Chain).filter(Chain.project_id == project_id).order_by(Chain.created_at).all()
    return [_chain_to_resp(r) for r in rows]


@router.post("", response_model=ChainResponse, status_code=201)
def create_chain(payload: ChainCreate, db: Session = Depends(get_db)):
    chain = Chain(
        id=new_uuid(),
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        steps=json.dumps([s.model_dump() for s in payload.steps]),
        trigger_on=payload.trigger_on,
        enabled=True,
    )
    db.add(chain)
    db.commit()
    db.refresh(chain)
    return _chain_to_resp(chain)


@router.post("/from-template", response_model=ChainResponse, status_code=201)
def create_from_template(project_id: str, template_name: str, db: Session = Depends(get_db)):
    """Create a chain from a standard template."""
    tmpl = next((t for t in STANDARD_CHAINS if t["name"] == template_name), None)
    if not tmpl:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")

    chain = Chain(
        id=new_uuid(),
        project_id=project_id,
        name=tmpl["name"],
        description=tmpl.get("description"),
        steps=json.dumps(tmpl.get("steps", [])),
        trigger_on=tmpl.get("trigger_on", "manual"),
        enabled=True,
    )
    db.add(chain)
    db.commit()
    db.refresh(chain)
    return _chain_to_resp(chain)


@router.get("/{chain_id}", response_model=ChainResponse)
def get_chain(chain_id: str, db: Session = Depends(get_db)):
    chain = db.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    return _chain_to_resp(chain)


@router.patch("/{chain_id}", response_model=ChainResponse)
def update_chain(chain_id: str, payload: ChainUpdate, db: Session = Depends(get_db)):
    chain = db.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")

    if payload.name is not None:
        chain.name = payload.name
    if payload.description is not None:
        chain.description = payload.description
    if payload.steps is not None:
        chain.steps = json.dumps([s.model_dump() for s in payload.steps])
    if payload.trigger_on is not None:
        chain.trigger_on = payload.trigger_on
    if payload.enabled is not None:
        chain.enabled = payload.enabled

    db.commit()
    db.refresh(chain)
    return _chain_to_resp(chain)


@router.delete("/{chain_id}", status_code=204)
def delete_chain(chain_id: str, db: Session = Depends(get_db)):
    chain = db.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    db.delete(chain)
    db.commit()


# ---------------------------------------------------------------------------
# Run a chain
# ---------------------------------------------------------------------------

@router.post("/{chain_id}/run", response_model=ChainRunResponse, status_code=202)
async def run_chain(
    chain_id: str,
    payload: RunChainRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger a chain execution (runs in background)."""
    chain = db.get(Chain, chain_id)
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")

    run_id = new_uuid()
    # Create the run record immediately
    run = ChainRun(
        id=run_id,
        chain_id=chain_id,
        project_id=chain.project_id,
        status="pending",
        step_results="{}",
    )
    db.add(run)
    db.commit()

    async def _bg():
        engine = ChainEngine(db)
        await engine.run(chain_id, chain.project_id, payload.target_id, run_id=run_id)

    background_tasks.add_task(_bg)
    db.refresh(run)
    return _run_to_resp(run)


# ---------------------------------------------------------------------------
# Chain run history
# ---------------------------------------------------------------------------

@router.get("/{chain_id}/runs", response_model=list[ChainRunResponse])
def list_chain_runs(chain_id: str, limit: int = 20, db: Session = Depends(get_db)):
    rows = (
        db.query(ChainRun)
        .filter(ChainRun.chain_id == chain_id)
        .order_by(ChainRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_run_to_resp(r) for r in rows]


@router.get("/{chain_id}/runs/{run_id}", response_model=ChainRunResponse)
def get_chain_run(chain_id: str, run_id: str, db: Session = Depends(get_db)):
    run = db.get(ChainRun, run_id)
    if not run or run.chain_id != chain_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_resp(run)
