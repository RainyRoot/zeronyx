"""App settings & tool health endpoints — Tasks 1.12 + 1.13."""

from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.adapters import list_adapters
from backend.config import settings

logger = logging.getLogger("zeronyx.settings")

router = APIRouter(prefix="/settings", tags=["settings"])

# ---------------------------------------------------------------------------
# User settings — persisted as JSON in data_dir/user_settings.json
# ---------------------------------------------------------------------------

_SETTINGS_FILE_NAME = "user_settings.json"

_DEFAULTS: dict = {
    "theme": "dark",
    "tool_paths": {},       # tool_name → custom binary path
    "scan_timeout": 600,    # seconds
    "data_dir": str(settings.data_dir),
}


def _settings_path() -> Path:
    return settings.data_dir / _SETTINGS_FILE_NAME


def _load_user_settings() -> dict:
    path = _settings_path()
    if path.exists():
        try:
            stored = json.loads(path.read_text())
            return {**_DEFAULTS, **stored}
        except (json.JSONDecodeError, OSError):
            logger.warning("Could not read user settings — using defaults")
    return dict(_DEFAULTS)


def _save_user_settings(data: dict) -> None:
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserSettingsResponse(BaseModel):
    theme: str
    tool_paths: dict[str, str]
    scan_timeout: int
    data_dir: str
    version: str = "0.1.0"
    env: str


class UserSettingsPatch(BaseModel):
    theme: str | None = None
    tool_paths: dict[str, str] | None = None
    scan_timeout: int | None = None


class ToolHealthEntry(BaseModel):
    name: str
    installed: bool
    binary_path: str | None
    custom_path: str | None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=UserSettingsResponse)
def get_settings():
    """Return current user settings merged with defaults."""
    data = _load_user_settings()
    return UserSettingsResponse(
        theme=data["theme"],
        tool_paths=data["tool_paths"],
        scan_timeout=data["scan_timeout"],
        data_dir=data["data_dir"],
        env=settings.env,
    )


@router.patch("", response_model=UserSettingsResponse)
def update_settings(payload: UserSettingsPatch):
    """Partially update user settings."""
    data = _load_user_settings()
    updates = payload.model_dump(exclude_unset=True)

    if "theme" in updates and updates["theme"] not in ("dark", "light"):
        raise HTTPException(status_code=400, detail="theme must be 'dark' or 'light'")
    if "scan_timeout" in updates and not (30 <= updates["scan_timeout"] <= 7200):
        raise HTTPException(status_code=400, detail="scan_timeout must be between 30 and 7200 seconds")

    data.update(updates)
    _save_user_settings(data)

    return UserSettingsResponse(
        theme=data["theme"],
        tool_paths=data["tool_paths"],
        scan_timeout=data["scan_timeout"],
        data_dir=data["data_dir"],
        env=settings.env,
    )


@router.get("/tools/health")
def tool_health():
    """Return install status for every registered tool adapter."""
    user_settings = _load_user_settings()
    custom_paths: dict[str, str] = user_settings.get("tool_paths", {})

    entries = []
    for name, cls in list_adapters():
        adapter = cls()
        # Honor custom path override if set
        custom = custom_paths.get(name)
        if custom:
            binary = custom if Path(custom).is_file() else None
            installed = binary is not None
        else:
            binary = adapter.get_binary_path()
            installed = binary is not None

        entries.append({
            "name": name,
            "installed": installed,
            "binary_path": binary,
            "custom_path": custom or None,
        })

    return {
        "tools": entries,
        "installed_count": sum(1 for e in entries if e["installed"]),
        "total_count": len(entries),
    }


@router.post("/tools/detect")
def detect_tools():
    """Re-scan PATH for all tools and return fresh results (same as health but forces re-check)."""
    # shutil.which caches nothing — just re-run health
    return tool_health()
