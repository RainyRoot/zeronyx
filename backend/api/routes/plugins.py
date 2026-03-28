"""REST routes for plugin management."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.plugin import Plugin
from backend.services.plugin_manager import get_plugin_manager

router = APIRouter(prefix="/plugins", tags=["plugins"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PluginResponse(BaseModel):
    id: str
    name: str
    version: str
    description: str
    author: str
    plugin_type: str
    permissions: list[str]
    ui_slots: list[str]
    hooks: list[str]
    settings: dict[str, Any]
    settings_values: dict[str, Any]
    enabled: bool
    permissions_granted: bool
    installed_at: str
    updated_at: str
    error: str | None

    @classmethod
    def from_model(cls, p: Plugin) -> "PluginResponse":
        return cls(
            id=p.id,
            name=p.name,
            version=p.version,
            description=p.description,
            author=p.author,
            plugin_type=p.plugin_type,
            permissions=json.loads(p.permissions or "[]"),
            ui_slots=json.loads(p.ui_slots or "[]"),
            hooks=json.loads(p.hooks or "[]"),
            settings=json.loads(p.settings or "{}"),
            settings_values=json.loads(p.settings_values or "{}"),
            enabled=p.enabled,
            permissions_granted=p.permissions_granted,
            installed_at=p.installed_at.isoformat(),
            updated_at=p.updated_at.isoformat(),
            error=p.error,
        )


class PluginSettingsUpdate(BaseModel):
    values: dict[str, Any]


class PluginToggle(BaseModel):
    enabled: bool


class PermissionGrant(BaseModel):
    granted: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[PluginResponse])
def list_plugins(db: Session = Depends(get_db)):
    """List all installed plugins."""
    plugins = db.query(Plugin).order_by(Plugin.name).all()
    return [PluginResponse.from_model(p) for p in plugins]


@router.post("/install", response_model=PluginResponse, status_code=201)
async def install_plugin(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Install a plugin from a .zeronyx-plugin zip file."""
    if not file.filename or not file.filename.endswith(".zeronyx-plugin"):
        raise HTTPException(400, "File must be a .zeronyx-plugin archive")

    manager = get_plugin_manager()

    # Save upload to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        plugin = manager.install_from_zip(tmp_path, db)
    except Exception as exc:
        raise HTTPException(400, f"Failed to install plugin: {exc}") from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    return PluginResponse.from_model(plugin)


@router.post("/install-dir", response_model=PluginResponse, status_code=201)
def install_plugin_dir(
    body: dict,
    db: Session = Depends(get_db),
):
    """Install a plugin from a local directory path (dev/debug use)."""
    path = body.get("path")
    if not path:
        raise HTTPException(400, "path required")

    plugin_dir = Path(path)
    if not plugin_dir.exists() or not plugin_dir.is_dir():
        raise HTTPException(400, f"Directory not found: {path}")

    manager = get_plugin_manager()
    try:
        plugin = manager.install_from_dir(plugin_dir, db, permissions_granted=False)
    except Exception as exc:
        raise HTTPException(400, f"Failed to install plugin: {exc}") from exc

    return PluginResponse.from_model(plugin)


@router.get("/{plugin_id}", response_model=PluginResponse)
def get_plugin(plugin_id: str, db: Session = Depends(get_db)):
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(404, "Plugin not found")
    return PluginResponse.from_model(plugin)


@router.delete("/{plugin_id}", status_code=204)
def uninstall_plugin(plugin_id: str, db: Session = Depends(get_db)):
    manager = get_plugin_manager()
    try:
        manager.uninstall(plugin_id, db)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.patch("/{plugin_id}/toggle", response_model=PluginResponse)
def toggle_plugin(plugin_id: str, body: PluginToggle, db: Session = Depends(get_db)):
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(404, "Plugin not found")
    plugin.enabled = body.enabled
    db.commit()
    db.refresh(plugin)
    return PluginResponse.from_model(plugin)


@router.patch("/{plugin_id}/permissions", response_model=PluginResponse)
def grant_permissions(plugin_id: str, body: PermissionGrant, db: Session = Depends(get_db)):
    """Grant or revoke permission approval for a plugin."""
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(404, "Plugin not found")

    plugin.permissions_granted = body.granted
    db.commit()
    db.refresh(plugin)

    # If granted, attempt to load backend module now
    if body.granted and plugin.enabled:
        manager = get_plugin_manager()
        ok = manager.load_backend_module(plugin)
        if not ok:
            plugin.error = "Backend module failed to load — check plugin files"
            db.commit()
            db.refresh(plugin)

    return PluginResponse.from_model(plugin)


@router.patch("/{plugin_id}/settings", response_model=PluginResponse)
def update_plugin_settings(
    plugin_id: str,
    body: PluginSettingsUpdate,
    db: Session = Depends(get_db),
):
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(404, "Plugin not found")
    manager = get_plugin_manager()
    updated = manager.update_settings(plugin, body.values, db)
    return PluginResponse.from_model(updated)


@router.get("/{plugin_id}/frontend-bundle")
def get_frontend_bundle(plugin_id: str, db: Session = Depends(get_db)):
    """Return the compiled frontend JS bundle for a plugin."""
    plugin = db.get(Plugin, plugin_id)
    if not plugin:
        raise HTTPException(404, "Plugin not found")
    if not plugin.permissions_granted or not plugin.enabled:
        raise HTTPException(403, "Plugin not active")

    manager = get_plugin_manager()
    try:
        manifest = manager.load_manifest(Path(plugin.install_path))
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc

    bundle_path = Path(plugin.install_path) / manifest.entry_frontend
    if not bundle_path.exists():
        raise HTTPException(404, "Frontend bundle not found")

    from fastapi.responses import FileResponse
    return FileResponse(bundle_path, media_type="application/javascript")
