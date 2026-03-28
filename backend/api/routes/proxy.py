"""Proxy management — REST + WebSocket."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.proxy_request import ProxyRequest
from backend.services.proxy_service import proxy_manager

logger = logging.getLogger("zeronyx.proxy")
router = APIRouter(prefix="/proxy", tags=["proxy"])


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class ProxyStartRequest(BaseModel):
    port: int = 8080
    project_id: str


class InterceptToggleRequest(BaseModel):
    enabled: bool
    filter: str = ""


class InterceptForwardRequest(BaseModel):
    modifications: dict[str, Any] | None = None


class ReplayRequest(BaseModel):
    project_id: str
    method: str
    url: str
    headers: dict[str, str] = {}
    body: str | None = None


class ProxyRequestOut(BaseModel):
    id: str
    project_id: str
    method: str
    scheme: str
    host: str
    port: int
    path: str
    url: str
    request_headers: dict[str, str] | None = None
    request_body: str | None = None
    status_code: int | None = None
    response_headers: dict[str, str] | None = None
    response_body: str | None = None
    content_type: str | None = None
    response_size: int | None = None
    duration_ms: int | None = None
    timestamp: str
    tags: list[str] | None = None
    notes: str | None = None

    @classmethod
    def from_orm(cls, row: ProxyRequest) -> "ProxyRequestOut":
        return cls(
            id=row.id,
            project_id=row.project_id,
            method=row.method,
            scheme=row.scheme,
            host=row.host,
            port=row.port,
            path=row.path,
            url=row.url,
            request_headers=json.loads(row.request_headers) if row.request_headers else None,
            request_body=row.request_body,
            status_code=row.status_code,
            response_headers=json.loads(row.response_headers) if row.response_headers else None,
            response_body=row.response_body,
            content_type=row.content_type,
            response_size=row.response_size,
            duration_ms=row.duration_ms,
            timestamp=row.timestamp.isoformat(),
            tags=json.loads(row.tags) if row.tags else None,
            notes=row.notes,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Lifecycle
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/start")
def start_proxy(body: ProxyStartRequest) -> dict[str, Any]:
    return proxy_manager.start(port=body.port, project_id=body.project_id)


@router.post("/stop")
def stop_proxy() -> dict[str, Any]:
    return proxy_manager.stop()


@router.get("/status")
def proxy_status() -> dict[str, Any]:
    return proxy_manager.status()


# ──────────────────────────────────────────────────────────────────────────────
# Intercept
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/intercept/toggle")
def toggle_intercept(body: InterceptToggleRequest) -> dict[str, Any]:
    return proxy_manager.set_intercept(enabled=body.enabled, filter_str=body.filter)


@router.get("/intercept/pending")
def get_pending() -> list[dict[str, Any]]:
    return proxy_manager.get_pending()


@router.post("/intercept/{flow_id}/forward")
def forward_flow(flow_id: str, body: InterceptForwardRequest) -> dict[str, Any]:
    result = proxy_manager.forward_flow(flow_id=flow_id, modifications=body.modifications)
    if not result["ok"]:
        raise HTTPException(404, result["error"])
    return result


@router.post("/intercept/{flow_id}/drop")
def drop_flow(flow_id: str) -> dict[str, Any]:
    result = proxy_manager.drop_flow(flow_id=flow_id)
    if not result["ok"]:
        raise HTTPException(404, result["error"])
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Replay
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/replay")
async def replay_request(body: ReplayRequest) -> dict[str, Any]:
    return await proxy_manager.replay(
        project_id=body.project_id,
        method=body.method,
        url=body.url,
        headers=body.headers,
        body=body.body,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Traffic list
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/requests/{project_id}")
def list_requests(
    project_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    method: str | None = Query(None),
    host: str | None = Query(None),
    status_min: int | None = Query(None),
    status_max: int | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    q = db.query(ProxyRequest).filter(ProxyRequest.project_id == project_id)
    if method:
        q = q.filter(ProxyRequest.method == method.upper())
    if host:
        q = q.filter(ProxyRequest.host.ilike(f"%{host}%"))
    if status_min is not None:
        q = q.filter(ProxyRequest.status_code >= status_min)
    if status_max is not None:
        q = q.filter(ProxyRequest.status_code <= status_max)
    if search:
        q = q.filter(ProxyRequest.url.ilike(f"%{search}%"))

    total = q.with_entities(func.count()).scalar()
    rows = q.order_by(desc(ProxyRequest.timestamp)).offset(skip).limit(limit).all()

    return {
        "items": [ProxyRequestOut.from_orm(r) for r in rows],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/requests/{project_id}/{request_id}")
def get_request(
    project_id: str,
    request_id: str,
    db: Session = Depends(get_db),
) -> ProxyRequestOut:
    row = (
        db.query(ProxyRequest)
        .filter(ProxyRequest.id == request_id, ProxyRequest.project_id == project_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Request not found")
    return ProxyRequestOut.from_orm(row)


@router.delete("/requests/{project_id}")
def clear_requests(
    project_id: str,
    db: Session = Depends(get_db),
) -> dict[str, int]:
    deleted = (
        db.query(ProxyRequest)
        .filter(ProxyRequest.project_id == project_id)
        .delete()
    )
    db.commit()
    return {"deleted": deleted}


@router.delete("/requests/{project_id}/{request_id}")
def delete_request(
    project_id: str,
    request_id: str,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    row = (
        db.query(ProxyRequest)
        .filter(ProxyRequest.id == request_id, ProxyRequest.project_id == project_id)
        .first()
    )
    if not row:
        raise HTTPException(404, "Request not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket live stream
# ──────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def proxy_ws(websocket: WebSocket) -> None:
    """Push stream: proxy_request, intercept_request, intercept_forwarded, intercept_dropped."""
    await proxy_manager.ws_connect(websocket)
    try:
        while True:
            await websocket.receive_json()  # drain pongs
    except WebSocketDisconnect:
        pass
    finally:
        await proxy_manager.ws_disconnect(websocket)
