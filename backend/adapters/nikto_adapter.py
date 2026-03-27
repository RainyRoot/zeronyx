"""Nikto web server scanner adapter — Task 2.3.

Nikto is run as a subprocess.  It outputs plain text to stdout, one finding
per line prefixed with '+'.  This adapter parses that output into the unified
ToolResult model.

Supported config keys
---------------------
url / target  — target URL or hostname
port          — explicit port (optional, auto-detected from URL)
tuning        — Nikto tuning string, e.g. "234" or "b" (optional)
ssl           — bool, force SSL connection (optional)
timeout       — per-request timeout in seconds (default 10)
maxtime       — total scan time limit, e.g. "5m" (optional)
useragent     — custom User-Agent (optional)
"""

from __future__ import annotations

import re
import shutil
from typing import Any
from urllib.parse import urlparse

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# ---------------------------------------------------------------------------
# Output parsing patterns
# ---------------------------------------------------------------------------

# Lines that carry a finding start with '+ '
# Forms we handle:
#   + OSVDB-3268: /cgi-bin/: Directory indexing enabled
#   + CVE-2021-41773: /cgi-bin/.%2e/: Path traversal
#   + /admin: Admin login page found
#   + Server: Apache/2.4.29 (Ubuntu)

_OSVDB_RE = re.compile(
    r"^\+\s+OSVDB-(\d+):\s+(/[^:]*)?:?\s*(.+)$"
)
_CVE_RE_LINE = re.compile(
    r"^\+\s+(CVE-[\d-]+):\s+(.+)$", re.IGNORECASE
)
_PATH_RE = re.compile(
    r"^\+\s+(/[^\s:]+):\s+(.+)$"
)
_SERVER_RE = re.compile(
    r"^\+\s+Server:\s+(.+)$", re.IGNORECASE
)
_IP_RE = re.compile(
    r"^\+\s+Target IP:\s+(\S+)", re.IGNORECASE
)
_CVE_INLINE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)

# Paths/keywords that bump severity to medium
_SENSITIVE_KEYWORDS = frozenset({
    "admin", "login", "password", "passwd", "backup", "config",
    "phpinfo", "phpmyadmin", "shell", "cmd", "exec", "upload",
    "webdav", "git", ".env", "secret", ".htaccess", ".svn",
    "console", "debug", "manager", "dashboard",
})

_INJECTION_KEYWORDS = frozenset({
    "xss", "sql", "injection", "traversal", "remote file",
    "command execution", "shell", "rce", "lfi", "rfi",
})


def _guess_severity(path: str, description: str) -> str:
    text = (path + " " + description).lower()
    for kw in _INJECTION_KEYWORDS:
        if kw in text:
            return "high"
    for kw in _SENSITIVE_KEYWORDS:
        if kw in text:
            return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class NiktoAdapter(ToolAdapter):
    """Nikto web server vulnerability scanner adapter."""

    DEFAULT_TIMEOUT: int = 1800  # 30 min hard cap

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "nikto"

    def get_binary_path(self) -> str | None:
        return shutil.which("nikto")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        url: str = config.get("url") or config.get("target", "")
        timeout: str = str(config.get("timeout", 10))

        # Parse host from URL for -h flag (nikto prefers host, not full URL)
        parsed = urlparse(url if "://" in url else f"http://{url}")
        host = parsed.hostname or url
        port = config.get("port") or parsed.port

        cmd: list[str] = [
            "nikto",
            "-h", host,
            "-timeout", timeout,
            "-nointeractive",   # no interactive prompts
            "-no404",           # reduce false positives from 404 pages
        ]

        if port:
            cmd += ["-p", str(port)]

        if config.get("ssl") or (parsed.scheme == "https"):
            cmd.append("-ssl")

        tuning: str = config.get("tuning", "")
        if tuning:
            cmd += ["-Tuning", tuning]

        maxtime: str = config.get("maxtime", "")
        if maxtime:
            cmd += ["-maxtime", maxtime]

        useragent: str = config.get("useragent", "")
        if useragent:
            cmd += ["-useragent", useragent]

        return [p for p in cmd if p]

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Quick Scan",
                "description": "Default Nikto scan — all test categories",
                "config": {"timeout": 10},
            },
            {
                "name": "Web App Audit",
                "description": "XSS, SQL injection, auth bypass, software ID",
                "config": {"tuning": "49ab", "timeout": 10},
            },
            {
                "name": "Sensitive Files",
                "description": "Misconfigurations and information disclosure",
                "config": {"tuning": "23", "timeout": 10},
            },
            {
                "name": "HTTPS Target",
                "description": "Force SSL/TLS — for HTTPS endpoints",
                "config": {"ssl": True, "timeout": 10},
            },
            {
                "name": "Fast + Time-Limited",
                "description": "5-minute cap with tuning for common issues",
                "config": {"tuning": "234b", "maxtime": "5m", "timeout": 5},
            },
        ]

    # ------------------------------------------------------------------
    # Output parsing
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        target: str = config.get("url") or config.get("target", "")
        nikto_findings: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []
        server: str | None = None
        target_ip: str | None = None

        for line in raw_output.splitlines():
            line = line.rstrip()
            if not line:
                continue

            # Extract server header (info only — not a finding)
            m = _SERVER_RE.match(line)
            if m:
                server = m.group(1).strip()
                nikto_findings.append({
                    "path": None,
                    "osvdb": None,
                    "cve": None,
                    "description": f"Server: {server}",
                    "severity": "info",
                })
                findings.append({
                    "title": f"Server Header: {server}",
                    "severity": "info",
                    "description": f"Web server banner: {server}",
                    "tool_source": "nikto",
                })
                continue

            # Extract target IP (metadata)
            m = _IP_RE.match(line)
            if m:
                target_ip = m.group(1).strip()
                continue

            # Skip non-finding lines
            if not line.startswith("+"):
                continue

            # CVE finding
            m = _CVE_RE_LINE.match(line)
            if m:
                cve_id = m.group(1).upper()
                desc = m.group(2).strip()
                entry: dict[str, Any] = {
                    "path": None, "osvdb": None,
                    "cve": cve_id, "description": desc,
                    "severity": "high",
                }
                nikto_findings.append(entry)
                findings.append({
                    "title": f"{cve_id}: {desc[:60]}",
                    "severity": "high",
                    "cve": cve_id,
                    "description": desc,
                    "tool_source": "nikto",
                })
                continue

            # OSVDB finding
            m = _OSVDB_RE.match(line)
            if m:
                osvdb_id = m.group(1)
                path = (m.group(2) or "").strip()
                desc = m.group(3).strip()
                cve = _CVE_INLINE.search(desc)
                sev = _guess_severity(path, desc)
                entry = {
                    "path": path or None,
                    "osvdb": osvdb_id,
                    "cve": cve.group(0).upper() if cve else None,
                    "description": desc,
                    "severity": sev,
                }
                nikto_findings.append(entry)
                findings.append({
                    "title": f"OSVDB-{osvdb_id}: {desc[:60]}",
                    "severity": sev,
                    "cve": entry["cve"],
                    "description": desc,
                    "tool_source": "nikto",
                })
                continue

            # Generic path finding
            m = _PATH_RE.match(line)
            if m:
                path = m.group(1).strip()
                desc = m.group(2).strip()
                cve = _CVE_INLINE.search(desc)
                sev = _guess_severity(path, desc)
                entry = {
                    "path": path,
                    "osvdb": None,
                    "cve": cve.group(0).upper() if cve else None,
                    "description": desc,
                    "severity": sev,
                }
                nikto_findings.append(entry)
                findings.append({
                    "title": f"{path}: {desc[:60]}",
                    "severity": sev,
                    "cve": entry["cve"],
                    "description": desc,
                    "tool_source": "nikto",
                })

        return ToolResult(
            raw_output=raw_output,
            parsed={
                "target":      target,
                "server":      server,
                "ip":          target_ip,
                "total_found": len(nikto_findings),
                "findings":    nikto_findings,
            },
            findings=findings,
        )
