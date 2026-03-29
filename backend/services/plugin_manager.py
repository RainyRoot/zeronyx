"""Plugin Manager Service.

Handles loading, validating, enabling/disabling and calling hooks on installed plugins.
Plugins live in a per-user plugins directory (~/.zeronyx/plugins/<plugin-id>/)
and additionally in the bundled ./plugins/ directory shipped with the app.

Each plugin directory must contain a valid manifest.json.
"""

from __future__ import annotations

import importlib.util
import json
import logging
import os
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from backend.models.plugin import Plugin

logger = logging.getLogger("zeronyx.plugins")

# ---------------------------------------------------------------------------
# Pydantic schema for manifest.json
# ---------------------------------------------------------------------------

ALLOWED_PERMISSIONS = {
    "scan:read", "scan:write",
    "findings:read", "findings:write",
    "targets:read", "targets:write",
    "credentials:read", "credentials:write",
    "hosts:read",
    "proxy:read",
    "settings:read",
    "network:outbound",
    "filesystem:read", "filesystem:write",
}

ALLOWED_UI_SLOTS = {
    "sidebar_nav", "dashboard_widget", "scan_result_panel",
    "finding_detail_panel", "target_panel", "toolbar_action",
    "settings_tab", "report_section",
}

ALLOWED_HOOKS = {
    "on_scan_complete", "on_finding_created", "on_target_added",
    "on_project_opened", "on_report_generate",
}


class PluginSettingSchema(BaseModel):
    type: str
    label: str
    description: str = ""
    required: bool = False
    secret: bool = False
    default: Any = None
    options: list[dict] = Field(default_factory=list)


class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    description: str = ""
    author: str = ""
    homepage: str = ""
    license: str = ""
    zeronyx_min_version: str = "0.1.0"
    type: str = "both"
    permissions: list[str] = Field(default_factory=list)
    entry_backend: str = "main.py"
    entry_frontend: str = "dist/index.js"
    ui_slots: list[str] = Field(default_factory=list)
    hooks: list[str] = Field(default_factory=list)
    settings: dict[str, PluginSettingSchema] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Plugin Manager
# ---------------------------------------------------------------------------

class PluginManager:
    """Central manager for all plugin lifecycle operations."""

    def __init__(self, user_plugin_dir: Path | None = None):
        self._user_dir = user_plugin_dir or Path.home() / ".zeronyx" / "plugins"
        self._bundled_dir = Path(__file__).parent.parent.parent / "plugins" / "examples"
        self._loaded_modules: dict[str, Any] = {}   # plugin_id -> module
        self._hooks: dict[str, list[tuple[str, Any]]] = {}  # hook_name -> [(plugin_id, callable)]
        self._user_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def _plugin_dirs(self) -> list[Path]:
        """Return all directories that could contain plugin sub-dirs."""
        dirs = [self._user_dir]
        if self._bundled_dir.exists():
            dirs.append(self._bundled_dir)
        return dirs

    def discover_installed(self) -> list[Path]:
        """Find all plugin directories (those with manifest.json)."""
        found: list[Path] = []
        for root in self._plugin_dirs():
            for entry in sorted(root.iterdir()):
                if entry.is_dir() and (entry / "manifest.json").exists():
                    found.append(entry)
        return found

    # ------------------------------------------------------------------
    # Manifest parsing
    # ------------------------------------------------------------------

    def load_manifest(self, plugin_dir: Path) -> PluginManifest:
        """Parse and validate manifest.json from a plugin directory."""
        manifest_path = plugin_dir / "manifest.json"
        if not manifest_path.exists():
            raise ValueError(f"No manifest.json in {plugin_dir}")
        with open(manifest_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        try:
            manifest = PluginManifest(**raw)
        except (ValidationError, TypeError) as exc:
            raise ValueError(f"Invalid manifest in {plugin_dir}: {exc}") from exc

        # Validate id is safe (no path traversal)
        if "/" in manifest.id or "\\" in manifest.id or ".." in manifest.id:
            raise ValueError(f"Plugin id contains illegal characters: {manifest.id}")

        # Warn about unknown permissions/slots/hooks but don't block
        unknown_perms = set(manifest.permissions) - ALLOWED_PERMISSIONS
        if unknown_perms:
            logger.warning("Plugin %s requests unknown permissions: %s", manifest.id, unknown_perms)

        return manifest

    # ------------------------------------------------------------------
    # Install / Uninstall
    # ------------------------------------------------------------------

    def install_from_zip(self, zip_path: Path, db: Session) -> Plugin:
        """Install a plugin from a .zeronyx-plugin zip archive."""
        with zipfile.ZipFile(zip_path, "r") as zf:
            names = zf.namelist()
            if "manifest.json" not in names:
                raise ValueError("Plugin archive missing manifest.json")
            manifest_bytes = zf.read("manifest.json")
            raw = json.loads(manifest_bytes)
            manifest = PluginManifest(**raw)

            dest = self._user_dir / manifest.id
            if dest.exists():
                shutil.rmtree(dest)
            dest.mkdir(parents=True)
            zf.extractall(dest)

        return self._register_plugin(manifest, dest, db, permissions_granted=False)

    def install_from_dir(self, source_dir: Path, db: Session, permissions_granted: bool = False) -> Plugin:
        """Install a plugin from a local directory (dev mode or bundled)."""
        manifest = self.load_manifest(source_dir)
        dest = self._user_dir / manifest.id

        if dest != source_dir:
            if dest.exists():
                shutil.rmtree(dest)
            shutil.copytree(source_dir, dest)

        return self._register_plugin(manifest, dest, db, permissions_granted=permissions_granted)

    def _register_plugin(
        self, manifest: PluginManifest, install_path: Path, db: Session,
        permissions_granted: bool = False
    ) -> Plugin:
        """Create or update plugin DB record."""
        existing = db.get(Plugin, manifest.id)
        if existing:
            existing.name = manifest.name
            existing.version = manifest.version
            existing.description = manifest.description
            existing.author = manifest.author
            existing.plugin_type = manifest.type
            existing.install_path = str(install_path)
            existing.permissions = json.dumps(manifest.permissions)
            existing.ui_slots = json.dumps(manifest.ui_slots)
            existing.hooks = json.dumps(manifest.hooks)
            existing.settings = json.dumps({k: v.model_dump() for k, v in manifest.settings.items()})
            existing.permissions_granted = permissions_granted
            existing.error = None
            db.commit()
            db.refresh(existing)
            return existing

        plugin = Plugin(
            id=manifest.id,
            name=manifest.name,
            version=manifest.version,
            description=manifest.description,
            author=manifest.author,
            plugin_type=manifest.type,
            install_path=str(install_path),
            permissions=json.dumps(manifest.permissions),
            ui_slots=json.dumps(manifest.ui_slots),
            hooks=json.dumps(manifest.hooks),
            settings=json.dumps({k: v.model_dump() for k, v in manifest.settings.items()}),
            settings_values="{}",
            enabled=True,
            permissions_granted=permissions_granted,
            error=None,
        )
        db.add(plugin)
        db.commit()
        db.refresh(plugin)
        return plugin

    def uninstall(self, plugin_id: str, db: Session) -> None:
        """Remove a plugin from disk and database."""
        plugin = db.get(Plugin, plugin_id)
        if not plugin:
            raise ValueError(f"Plugin {plugin_id!r} not found")

        install_path = Path(plugin.install_path)
        if install_path.exists() and install_path.parent == self._user_dir:
            shutil.rmtree(install_path)

        self._unload_module(plugin_id)
        db.delete(plugin)
        db.commit()

    # ------------------------------------------------------------------
    # Loading backend modules
    # ------------------------------------------------------------------

    def load_backend_module(self, plugin: Plugin) -> bool:
        """
        Dynamically import the plugin's backend Python module.
        Returns True on success, False on error.
        """
        if plugin.plugin_type == "frontend":
            return True  # no backend component
        if not plugin.permissions_granted or not plugin.enabled:
            return False

        try:
            manifest = self.load_manifest(Path(plugin.install_path))
            entry = Path(plugin.install_path) / manifest.entry_backend
            if not entry.exists():
                logger.warning("Plugin %s backend entry not found: %s", plugin.id, entry)
                return False

            spec = importlib.util.spec_from_file_location(f"zeronyx_plugin_{plugin.id}", entry)
            if spec is None or spec.loader is None:
                return False

            module = importlib.util.module_from_spec(spec)
            sys.modules[f"zeronyx_plugin_{plugin.id}"] = module
            spec.loader.exec_module(module)  # type: ignore[attr-defined]
            self._loaded_modules[plugin.id] = module

            # Register hooks
            for hook_name in ALLOWED_HOOKS:
                handler = getattr(module, hook_name, None)
                if handler and callable(handler):
                    self._hooks.setdefault(hook_name, []).append((plugin.id, handler))

            logger.info("Plugin %s backend loaded", plugin.id)
            return True

        except Exception as exc:
            logger.exception("Failed to load plugin %s backend: %s", plugin.id, exc)
            return False

    def _unload_module(self, plugin_id: str) -> None:
        """Remove a loaded module from memory and hooks."""
        self._loaded_modules.pop(plugin_id, None)
        module_key = f"zeronyx_plugin_{plugin_id}"
        sys.modules.pop(module_key, None)
        for hook_list in self._hooks.values():
            hook_list[:] = [(pid, fn) for pid, fn in hook_list if pid != plugin_id]

    def load_all_enabled(self, db: Session) -> None:
        """Load all enabled, permission-granted backend plugins at startup."""
        plugins = db.query(Plugin).filter(Plugin.enabled == True, Plugin.permissions_granted == True).all()
        for plugin in plugins:
            self.load_backend_module(plugin)

    # ------------------------------------------------------------------
    # Hook dispatch
    # ------------------------------------------------------------------

    async def dispatch_hook(self, hook_name: str, payload: dict) -> None:
        """Call all registered handlers for a hook. Errors are logged, not raised."""
        handlers = self._hooks.get(hook_name, [])
        for plugin_id, handler in handlers:
            try:
                import asyncio
                if asyncio.iscoroutinefunction(handler):
                    await handler(payload)
                else:
                    handler(payload)
            except Exception as exc:
                logger.exception("Plugin %s hook %s error: %s", plugin_id, hook_name, exc)

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    def update_settings(self, plugin: Plugin, values: dict, db: Session) -> Plugin:
        plugin.settings_values = json.dumps(values)
        db.commit()
        db.refresh(plugin)
        return plugin

    def get_plugin_context(self, plugin_id: str) -> dict:
        """Return settings values for a plugin (passed to module calls)."""
        return {}  # loaded modules read from DB directly via context injection


# ---------------------------------------------------------------------------
# Singleton instance (initialised at app startup)
# ---------------------------------------------------------------------------

_manager: PluginManager | None = None


def get_plugin_manager() -> PluginManager:
    global _manager
    if _manager is None:
        _manager = PluginManager()
    return _manager
