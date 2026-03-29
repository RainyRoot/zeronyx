"""
ZeroNyx Plugin: WHOIS Lookup

Performs a WHOIS lookup whenever a new target is added and saves
the registration/network info as an informational finding.

Requires: targets:read, findings:write, network:outbound
"""

import json
import socket
import re
from typing import Any


WHOIS_PORT = 43
DEFAULT_WHOIS_SERVER = "whois.iana.org"


def _whois_query(host: str, server: str) -> str:
    """Simple raw WHOIS socket query. Returns raw text."""
    try:
        with socket.create_connection((server, WHOIS_PORT), timeout=10) as sock:
            sock.sendall(f"{host}\r\n".encode())
            response = b""
            while True:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response += chunk
        return response.decode("utf-8", errors="replace")
    except Exception as exc:
        return f"WHOIS query failed: {exc}"


def _extract_refer(whois_text: str) -> str | None:
    """Extract 'refer:' field from IANA response to find the right WHOIS server."""
    for line in whois_text.splitlines():
        if line.lower().startswith("refer:"):
            return line.split(":", 1)[1].strip()
    return None


def whois_lookup(target: str, custom_server: str = "") -> str:
    """
    Two-stage WHOIS: query IANA first to find the authoritative server,
    then query that server for full details.
    """
    server = custom_server or DEFAULT_WHOIS_SERVER
    raw = _whois_query(target, server)

    # If IANA referred us elsewhere, follow the referral
    if not custom_server and "refer:" in raw.lower():
        refer = _extract_refer(raw)
        if refer:
            raw = _whois_query(target, refer)

    return raw


# ---------------------------------------------------------------------------
# Plugin entry point — ZeroNyx discovers the first class inheriting dict
# with on_target_added defined (no SDK dependency in examples for portability)
# ---------------------------------------------------------------------------

async def on_target_added(payload: dict) -> None:
    """
    Hook called by the plugin manager when a target is added.
    payload: { target_id, project_id, value, type }
    """
    target_value: str = payload.get("value", "")
    project_id: str = payload.get("project_id", "")
    target_id: str = payload.get("target_id", "")
    target_type: str = payload.get("type", "")

    # Only query domains and IPs
    if target_type not in ("domain", "ip"):
        return

    # Plugin settings are passed in payload by the manager
    settings: dict = payload.get("_plugin_settings", {})
    custom_server = settings.get("whois_server", "")

    result = whois_lookup(target_value, custom_server)

    # The plugin manager exposes a simple internal API via payload["_api"]
    api = payload.get("_api")
    if api is None:
        return

    # Trim result to avoid storing huge chunks
    trimmed = result[:4000] + ("…" if len(result) > 4000 else "")

    finding = {
        "title": f"WHOIS: {target_value}",
        "severity": "info",
        "description": f"WHOIS registration data for `{target_value}`:\n\n```\n{trimmed}\n```",
        "tool_source": "whois-lookup",
        "host_id": None,
        "port_id": None,
    }

    await api.create_finding(project_id, finding)
