"""Censys passive recon routes — Task 3.8.

Endpoints
---------
GET  /censys/status
POST /censys/connect
POST /censys/disconnect
DELETE /censys/credentials
GET  /censys/host/{ip}
GET  /censys/search?q=&per_page=&pages=
GET  /censys/aggregate?q=&field=&buckets=
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.censys_service import censys_service

logger = logging.getLogger("zeronyx.censys")

router = APIRouter(prefix="/censys", tags=["censys"])


class ConnectRequest(BaseModel):
    api_id: str
    api_secret: str


@router.get("/status")
async def get_status():
    return censys_service.get_status()


@router.post("/connect")
async def connect(payload: ConnectRequest):
    api_id     = payload.api_id.strip()
    api_secret = payload.api_secret.strip()
    if not api_id or not api_secret:
        raise HTTPException(status_code=400, detail="api_id and api_secret are required")
    try:
        account = await censys_service.connect(api_id, api_secret)
        return {"ok": True, "email": account.get("email")}
    except PermissionError:
        raise HTTPException(status_code=401, detail="Invalid Censys credentials")
    except Exception as exc:
        msg = str(exc)
        logger.warning("Censys connect failed: %s", msg)
        raise HTTPException(status_code=502, detail=f"Censys API error: {msg}")


@router.post("/disconnect")
async def disconnect():
    censys_service.disconnect()
    return {"ok": True}


@router.delete("/credentials")
async def remove_credentials():
    censys_service.remove_credentials()
    return {"ok": True}


@router.get("/host/{ip}")
async def view_host(ip: str):
    if not censys_service.is_connected():
        ok = await censys_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Censys")
    try:
        return await censys_service.view_host(ip)
    except Exception as exc:
        msg = str(exc)
        if "404" in msg or "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=f"No Censys data for {ip}")
        logger.warning("Censys host view failed for %s: %s", ip, exc)
        raise HTTPException(status_code=502, detail=f"Censys API error: {msg}")


@router.get("/search")
async def search_hosts(q: str = "", per_page: int = 100, pages: int = 1):
    if not q.strip():
        raise HTTPException(status_code=400, detail="q (query) is required")
    if not censys_service.is_connected():
        ok = await censys_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Censys")
    try:
        return await censys_service.search_hosts(q, per_page=per_page, pages=pages)
    except Exception as exc:
        msg = str(exc)
        logger.warning("Censys search failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Censys API error: {msg}")


@router.get("/aggregate")
async def aggregate(q: str = "", field: str = "services.port", buckets: int = 50):
    if not q.strip():
        raise HTTPException(status_code=400, detail="q (query) is required")
    if not censys_service.is_connected():
        ok = await censys_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Censys")
    try:
        return await censys_service.aggregate(q, field, num_buckets=buckets)
    except Exception as exc:
        msg = str(exc)
        raise HTTPException(status_code=502, detail=f"Censys API error: {msg}")
