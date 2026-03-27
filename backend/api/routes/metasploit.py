"""Metasploit RPC connection + module browser endpoints — Task 3.4."""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.services.metasploit_service import msf_service

logger = logging.getLogger("zeronyx.metasploit")
router = APIRouter(prefix="/metasploit", tags=["metasploit"])


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class ConnectRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int = 55553
    password: str
    ssl: bool = True


# ──────────────────────────────────────────────────────────────────────────────
# Connection management
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/status")
def msf_status() -> dict[str, Any]:
    return msf_service.status()


@router.post("/connect")
def msf_connect(body: ConnectRequest) -> dict[str, Any]:
    return msf_service.connect(
        host=body.host,
        port=body.port,
        password=body.password,
        ssl=body.ssl,
    )


@router.post("/disconnect")
def msf_disconnect() -> dict[str, Any]:
    return msf_service.disconnect()


# ──────────────────────────────────────────────────────────────────────────────
# Module browser
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/search")
async def search_modules(
    q: str = Query("", description="Search query"),
    type: str | None = Query(None, description="Module type filter"),
    limit: int = Query(200, ge=1, le=500),
) -> list[dict[str, Any]]:
    if not msf_service.is_connected():
        raise HTTPException(503, "Not connected to msfrpcd")
    return await msf_service.search(query=q, mod_type=type or None, limit=limit)


@router.get("/module/{mod_type}/{mod_name:path}")
async def get_module_info(mod_type: str, mod_name: str) -> dict[str, Any]:
    if not msf_service.is_connected():
        raise HTTPException(503, "Not connected to msfrpcd")
    info = await msf_service.module_info(mod_type, mod_name)
    if not info:
        raise HTTPException(404, f"Module {mod_type}/{mod_name} not found")
    return info
