"""Shodan passive recon routes — Task 3.7.

Endpoints
---------
GET  /shodan/status                 — connection status + plan info
POST /shodan/connect                — save key + test connection
POST /shodan/disconnect             — clear live connection (keeps saved key)
DELETE /shodan/key                  — remove saved key + disconnect
GET  /shodan/host/{ip}              — full host lookup
POST /shodan/host/{ip}/save         — save host findings to a project
GET  /shodan/search?q=&page=&limit= — search query (costs credits)
GET  /shodan/count?q=               — count query (free)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.shodan_service import shodan_service

logger = logging.getLogger("zeronyx.shodan")

router = APIRouter(prefix="/shodan", tags=["shodan"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConnectRequest(BaseModel):
    api_key: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_status():
    """Return current connection state and API plan info."""
    return shodan_service.get_status()


@router.post("/connect")
async def connect(payload: ConnectRequest):
    """Save and validate a Shodan API key."""
    key = payload.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="api_key must not be empty")
    try:
        info = await shodan_service.connect(key)
        return {"ok": True, "plan": info.get("plan"), "query_credits": info.get("query_credits")}
    except Exception as exc:
        logger.warning("Shodan connect failed: %s", exc)
        # Don't expose raw library errors
        msg = str(exc)
        if "Invalid API key" in msg or "403" in msg or "401" in msg:
            raise HTTPException(status_code=401, detail="Invalid API key")
        raise HTTPException(status_code=502, detail=f"Shodan API error: {msg}")


@router.post("/disconnect")
async def disconnect():
    """Drop the live connection (saved key is preserved)."""
    shodan_service.disconnect()
    return {"ok": True}


@router.delete("/key")
async def remove_key():
    """Delete the saved API key and disconnect."""
    shodan_service.remove_key()
    return {"ok": True}


@router.get("/host/{ip}")
async def get_host(ip: str, history: bool = False):
    """Full host lookup — open ports, services, vulns, location."""
    if not shodan_service.is_connected():
        # Try auto-connect with saved key on first use
        ok = await shodan_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Shodan")
    try:
        return await shodan_service.get_host(ip, history=history)
    except Exception as exc:
        msg = str(exc)
        if "No information available" in msg or "404" in msg:
            raise HTTPException(status_code=404, detail=f"No Shodan data for {ip}")
        logger.warning("Shodan host lookup failed for %s: %s", ip, exc)
        raise HTTPException(status_code=502, detail=f"Shodan API error: {msg}")


@router.get("/search")
async def search(q: str = "", page: int = 1, limit: int = 100):
    """Search Shodan — requires query credits."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="q (query) is required")
    if not shodan_service.is_connected():
        ok = await shodan_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Shodan")
    try:
        return await shodan_service.search(q, page=page, limit=min(limit, 100))
    except Exception as exc:
        msg = str(exc)
        logger.warning("Shodan search failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Shodan API error: {msg}")


@router.get("/count")
async def count(q: str = ""):
    """Count results for a query — does NOT consume credits."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="q (query) is required")
    if not shodan_service.is_connected():
        ok = await shodan_service.auto_connect()
        if not ok:
            raise HTTPException(status_code=400, detail="Not connected to Shodan")
    try:
        return await shodan_service.count(q)
    except Exception as exc:
        msg = str(exc)
        raise HTTPException(status_code=502, detail=f"Shodan API error: {msg}")
