"""REST routes for the Plugin Marketplace."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.api.routes.plugins import PluginResponse
from backend.services import marketplace_service

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MarketplacePlugin(BaseModel):
    id: str
    name: str
    version: str
    description: str
    author: str
    tags: list[str]
    stars: int
    downloads: int
    download_url: str
    homepage: str
    requires_pro: bool
    plugin_type: str
    permissions: list[str]


class MarketplaceResponse(BaseModel):
    total: int
    page: int
    per_page: int
    plugins: list[MarketplacePlugin]
    registry_updated_at: str


class InstallFromMarketplaceRequest(BaseModel):
    download_url: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=MarketplaceResponse)
async def browse_marketplace(
    q: str = Query("", description="Search query"),
    tag: str = Query("", description="Filter by tag"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
):
    """Browse and search the plugin marketplace."""
    result = await marketplace_service.search_plugins(
        query=q, tag=tag, page=page, per_page=per_page
    )
    # Normalize plugins to ensure all fields are present
    normalized: list[dict[str, Any]] = []
    for p in result["plugins"]:
        normalized.append({
            "id": p.get("id", ""),
            "name": p.get("name", ""),
            "version": p.get("version", "0.0.0"),
            "description": p.get("description", ""),
            "author": p.get("author", ""),
            "tags": p.get("tags", []),
            "stars": p.get("stars", 0),
            "downloads": p.get("downloads", 0),
            "download_url": p.get("download_url", ""),
            "homepage": p.get("homepage", ""),
            "requires_pro": p.get("requires_pro", False),
            "plugin_type": p.get("plugin_type", "both"),
            "permissions": p.get("permissions", []),
        })
    return MarketplaceResponse(
        total=result["total"],
        page=result["page"],
        per_page=result["per_page"],
        plugins=normalized,
        registry_updated_at=result["registry_updated_at"],
    )


@router.get("/tags")
async def get_tags():
    """Return all available marketplace tags."""
    tags = await marketplace_service.get_all_tags()
    return {"tags": tags}


@router.post("/refresh")
async def refresh_registry():
    """Force-refresh the marketplace registry cache."""
    registry = await marketplace_service.fetch_registry(force_refresh=True)
    return {
        "ok": True,
        "plugin_count": len(registry.get("plugins", [])),
        "updated_at": registry.get("updated_at", ""),
    }


@router.post("/install", response_model=PluginResponse)
async def install_from_marketplace(
    body: InstallFromMarketplaceRequest,
    db: Session = Depends(get_db),
):
    """Download and install a plugin from the marketplace."""
    if not body.download_url:
        raise HTTPException(400, "download_url is required")
    try:
        plugin = await marketplace_service.install_from_marketplace(body.download_url, db)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Installation failed: {exc}") from exc
    return PluginResponse.from_model(plugin)
