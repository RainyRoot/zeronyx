"""Base classes for ZeroNyx backend plugins."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Plugin Context — injected by the plugin manager at runtime
# ---------------------------------------------------------------------------

@dataclass
class PluginContext:
    """
    Runtime context passed to every plugin hook and method.

    Attributes:
        plugin_id:   The plugin's unique identifier.
        settings:    Dict of user-configured setting values.
        data_dir:    Writable directory for plugin data (~/.zeronyx/plugins/<id>/data/).
        api:         Internal API client for reading/writing ZeroNyx data.
    """
    plugin_id: str
    settings: dict[str, Any] = field(default_factory=dict)
    data_dir: str = ""
    api: "PluginApiClient | None" = None

    def setting(self, key: str, default: Any = None) -> Any:
        """Get a setting value, with optional default."""
        return self.settings.get(key, default)


# ---------------------------------------------------------------------------
# Internal API client (stub — real implementation injected at runtime)
# ---------------------------------------------------------------------------

class PluginApiClient:
    """
    Provides safe, permission-checked access to ZeroNyx data.

    Methods are only available if the plugin declared the matching permission.
    Attempting to call a method without the required permission raises PermissionError.
    """

    async def get_scan(self, scan_id: str) -> dict:
        """Fetch a scan and its results by ID. Requires: scan:read"""
        raise NotImplementedError

    async def list_findings(self, project_id: str, scan_id: str | None = None) -> list[dict]:
        """List findings for a project/scan. Requires: findings:read"""
        raise NotImplementedError

    async def create_finding(self, project_id: str, data: dict) -> dict:
        """Create a new finding. Requires: findings:write"""
        raise NotImplementedError

    async def list_targets(self, project_id: str) -> list[dict]:
        """List targets in a project. Requires: targets:read"""
        raise NotImplementedError

    async def create_target(self, project_id: str, value: str, type: str = "ip") -> dict:
        """Add a target to the project. Requires: targets:write"""
        raise NotImplementedError

    async def list_hosts(self, project_id: str) -> list[dict]:
        """List discovered hosts. Requires: hosts:read"""
        raise NotImplementedError

    async def list_credentials(self, project_id: str) -> list[dict]:
        """List stored credentials. Requires: credentials:read"""
        raise NotImplementedError

    async def http_get(self, url: str, **kwargs) -> dict:
        """Make an outbound HTTP GET request. Requires: network:outbound"""
        raise NotImplementedError

    async def http_post(self, url: str, data: dict, **kwargs) -> dict:
        """Make an outbound HTTP POST request. Requires: network:outbound"""
        raise NotImplementedError


# ---------------------------------------------------------------------------
# Plugin base class
# ---------------------------------------------------------------------------

class ZeroNyxPlugin:
    """
    Base class for ZeroNyx backend plugins.

    Subclass this and implement the hooks you need.
    The plugin manager will discover your subclass automatically.

    Example:
        class WhoisPlugin(ZeroNyxPlugin):
            async def on_scan_complete(self, ctx: PluginContext, payload: dict):
                target = payload.get("target")
                result = await ctx.api.http_get(f"https://who.is/api/{target}")
                await ctx.api.create_finding(payload["project_id"], {
                    "title": f"WHOIS: {target}",
                    "severity": "info",
                    "description": str(result),
                    "tool_source": "whois-plugin",
                })
    """

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def on_load(self, ctx: PluginContext) -> None:
        """Called once when the plugin is loaded. Use for initialisation."""

    async def on_unload(self, ctx: PluginContext) -> None:
        """Called when the plugin is disabled or ZeroNyx shuts down."""

    # ------------------------------------------------------------------
    # Scan hooks
    # ------------------------------------------------------------------

    async def on_scan_complete(self, ctx: PluginContext, payload: dict) -> None:
        """
        Called when any scan finishes successfully.

        payload keys:
            scan_id:     str
            project_id:  str
            tool:        str  (e.g. "nmap", "nuclei")
            target:      str
            status:      str  ("completed")
        """

    # ------------------------------------------------------------------
    # Finding hooks
    # ------------------------------------------------------------------

    async def on_finding_created(self, ctx: PluginContext, payload: dict) -> None:
        """
        Called when a new finding is created (by any tool or manually).

        payload keys:
            finding_id:  str
            project_id:  str
            title:       str
            severity:    str
            tool_source: str
        """

    # ------------------------------------------------------------------
    # Target hooks
    # ------------------------------------------------------------------

    async def on_target_added(self, ctx: PluginContext, payload: dict) -> None:
        """
        Called when a target is added to a project.

        payload keys:
            target_id:   str
            project_id:  str
            value:       str
            type:        str
        """

    # ------------------------------------------------------------------
    # Project hooks
    # ------------------------------------------------------------------

    async def on_project_opened(self, ctx: PluginContext, payload: dict) -> None:
        """
        Called when a project is switched to / opened.

        payload keys:
            project_id:  str
            project_name: str
        """

    # ------------------------------------------------------------------
    # Report hooks
    # ------------------------------------------------------------------

    async def on_report_generate(self, ctx: PluginContext, payload: dict) -> dict | None:
        """
        Called during report generation. Return a dict with 'section_title'
        and 'content' (markdown) to inject a custom section into the report.

        payload keys:
            project_id: str
            report_type: str  ("pdf" | "html" | "markdown")

        Return:
            {"section_title": "WHOIS Summary", "content": "...markdown..."}
            or None to add nothing.
        """
        return None
