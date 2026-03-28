"""
ZeroNyx Plugin: CSV Export

Exports findings, hosts, or credentials from the active project to CSV.
Triggered via the toolbar_action UI slot (button in the app toolbar).

Requires: findings:read, hosts:read, credentials:read, filesystem:write
"""

import csv
import io
import os
import datetime
from pathlib import Path
from typing import Any


def _default_dir() -> str:
    desktop = Path.home() / "Desktop"
    return str(desktop) if desktop.exists() else str(Path.home())


def _timestamp() -> str:
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")


def _findings_to_csv(findings: list[dict], include_headers: bool = True) -> str:
    output = io.StringIO()
    fields = ["id", "title", "severity", "cvss", "cve", "tool_source",
              "status", "description", "remediation", "created_at"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    if include_headers:
        writer.writeheader()
    for f in findings:
        writer.writerow({k: f.get(k, "") for k in fields})
    return output.getvalue()


def _hosts_to_csv(hosts: list[dict], include_headers: bool = True) -> str:
    output = io.StringIO()
    fields = ["id", "ip", "hostname", "os", "mac", "vendor", "state", "last_seen"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    if include_headers:
        writer.writeheader()
    for h in hosts:
        writer.writerow({k: h.get(k, "") for k in fields})
    return output.getvalue()


def _credentials_to_csv(creds: list[dict], include_headers: bool = True) -> str:
    output = io.StringIO()
    fields = ["id", "service", "username", "password", "hash", "hash_type",
              "verified", "created_at"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    if include_headers:
        writer.writeheader()
    for c in creds:
        writer.writerow({k: c.get(k, "") for k in fields})
    return output.getvalue()


async def export_findings(project_id: str, api: Any, settings: dict) -> str:
    """Export findings to CSV. Returns the output file path."""
    findings = await api.list_findings(project_id)
    csv_content = _findings_to_csv(findings, settings.get("include_headers", True))

    out_dir = settings.get("output_dir", "") or _default_dir()
    filename = f"zeronyx_findings_{_timestamp()}.csv"
    path = os.path.join(out_dir, filename)

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_content)

    return path


async def export_hosts(project_id: str, api: Any, settings: dict) -> str:
    """Export hosts to CSV. Returns the output file path."""
    hosts = await api.list_hosts(project_id)
    csv_content = _hosts_to_csv(hosts, settings.get("include_headers", True))

    out_dir = settings.get("output_dir", "") or _default_dir()
    filename = f"zeronyx_hosts_{_timestamp()}.csv"
    path = os.path.join(out_dir, filename)

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_content)

    return path


async def export_credentials(project_id: str, api: Any, settings: dict) -> str:
    """Export credentials to CSV. Returns the output file path."""
    creds = await api.list_credentials(project_id)
    csv_content = _credentials_to_csv(creds, settings.get("include_headers", True))

    out_dir = settings.get("output_dir", "") or _default_dir()
    filename = f"zeronyx_credentials_{_timestamp()}.csv"
    path = os.path.join(out_dir, filename)

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(csv_content)

    return path


# These are callable from the frontend via a dedicated REST action endpoint
# The frontend toolbar button calls POST /api/plugins/export-csv/action
# with { "action": "export_findings" | "export_hosts" | "export_credentials",
#         "project_id": "..." }
ACTIONS = {
    "export_findings": export_findings,
    "export_hosts": export_hosts,
    "export_credentials": export_credentials,
}


async def handle_action(payload: dict) -> dict:
    """
    Called by the plugin manager when a frontend action is triggered.
    payload: { action, project_id, _api, _plugin_settings }
    Returns: { success, message, path? }
    """
    action = payload.get("action")
    project_id = payload.get("project_id", "")
    api = payload.get("_api")
    settings = payload.get("_plugin_settings", {})

    if action not in ACTIONS:
        return {"success": False, "message": f"Unknown action: {action}"}

    if not api:
        return {"success": False, "message": "Internal API not available"}

    try:
        path = await ACTIONS[action](project_id, api, settings)
        return {"success": True, "message": f"Exported to {path}", "path": path}
    except Exception as exc:
        return {"success": False, "message": str(exc)}
