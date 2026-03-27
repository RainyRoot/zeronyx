"""Gobuster directory/DNS/vhost brute-force adapter — Task 2.1.

Supports three gobuster modes:
  dir   — directory & file enumeration against a web server
  dns   — DNS subdomain discovery
  vhost — virtual host discovery

Output is line-buffered plain text; this adapter parses each line
as it arrives and builds a ToolResult at the end.
"""

from __future__ import annotations

import re
import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# ---------------------------------------------------------------------------
# Output line patterns
# ---------------------------------------------------------------------------

# gobuster dir (v3.x):
#   /admin                (Status: 200) [Size: 12345]
#   /login                (Status: 301) [Size: 0] [--> /login/]
_DIR_RE = re.compile(
    r"^(/\S*)\s+\(Status:\s*(\d+)\)"
    r"(?:\s+\[Size:\s*(\d+)\])?"
    r"(?:.*\[-->\s*([^\]]+)\])?",
)

# gobuster dns:
#   Found: mail.example.com
_DNS_RE = re.compile(r"^Found:\s+(\S+)", re.IGNORECASE)

# gobuster vhost:
#   Found: admin.example.com (Status: 200) [Size: 12345]
_VHOST_RE = re.compile(
    r"^Found:\s+(\S+)(?:\s+\(Status:\s*(\d+)\))?(?:\s+\[Size:\s*(\d+)\])?",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Severity heuristics
# ---------------------------------------------------------------------------

# Paths that commonly indicate sensitive or interesting content
_HIGH_INTEREST = frozenset({
    "/.git", "/.svn", "/.env", "/.htaccess", "/.htpasswd",
    "/backup", "/backups", "/db", "/database", "/dump",
    "/config", "/conf", "/settings", "/secrets",
    "/admin", "/administrator", "/manager", "/management",
    "/phpmyadmin", "/wp-admin", "/cpanel", "/webmail",
    "/console", "/debug", "/test", "/dev", "/staging", "/temp",
    "/api/v1", "/api/v2", "/graphql", "/swagger", "/openapi",
})


def _path_severity(path: str, status: int) -> str:
    normalized = path.lower().rstrip("/")
    for interesting in _HIGH_INTEREST:
        if normalized == interesting or normalized.startswith(interesting + "/"):
            return "medium"
    if status in (401, 403):
        return "low"
    return "info"


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class GobusterAdapter(ToolAdapter):
    """Gobuster directory / DNS / vhost brute-force adapter."""

    DEFAULT_TIMEOUT: int = 1800  # 30 min hard cap

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "gobuster"

    def get_binary_path(self) -> str | None:
        return shutil.which("gobuster")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        mode: str = config.get("mode", "dir")
        wordlist: str = config.get("wordlist", "/usr/share/wordlists/dirb/common.txt")
        threads: str = str(config.get("threads", 10))

        cmd: list[str] = ["gobuster", mode]

        if mode == "dir":
            url: str = config.get("url") or config.get("target", "")
            cmd += ["-u", url, "-w", wordlist, "-t", threads, "--no-progress"]
            extensions: str = config.get("extensions", "")
            if extensions:
                cmd += ["-x", extensions]
            status_codes: str = config.get("status_codes", "")
            if status_codes:
                cmd += ["-s", status_codes]

        elif mode == "dns":
            domain: str = config.get("domain") or config.get("target", "")
            cmd += ["-d", domain, "-w", wordlist, "-t", threads, "--no-progress"]

        elif mode == "vhost":
            url = config.get("url") or config.get("target", "")
            cmd += ["-u", url, "-w", wordlist, "-t", threads, "--no-progress"]

        return [p for p in cmd if p]  # strip accidental empty strings

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Quick Dir Scan",
                "description": "Common paths — dirb wordlist, no extensions",
                "config": {
                    "mode": "dir",
                    "wordlist": "/usr/share/wordlists/dirb/common.txt",
                    "threads": 10,
                },
            },
            {
                "name": "Dir + Web Extensions",
                "description": "Dir brute with .php .html .txt .bak",
                "config": {
                    "mode": "dir",
                    "wordlist": "/usr/share/wordlists/dirb/common.txt",
                    "extensions": ".php,.html,.txt,.bak",
                    "threads": 20,
                },
            },
            {
                "name": "Big Dir Scan",
                "description": "Thorough scan — dirbuster medium list",
                "config": {
                    "mode": "dir",
                    "wordlist": "/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt",
                    "threads": 30,
                },
            },
            {
                "name": "DNS Subdomains",
                "description": "Subdomain discovery via DNS brute force",
                "config": {
                    "mode": "dns",
                    "wordlist": "/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt",
                    "threads": 20,
                },
            },
            {
                "name": "VHost Discovery",
                "description": "Virtual host brute force against a target",
                "config": {
                    "mode": "vhost",
                    "wordlist": "/usr/share/wordlists/dirb/common.txt",
                    "threads": 10,
                },
            },
        ]

    # ------------------------------------------------------------------
    # Output parsing
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        mode: str = config.get("mode", "dir")
        target: str = config.get("url") or config.get("domain") or config.get("target", "")
        paths: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            # Skip gobuster banner lines (start with = or contain "Gobuster")
            if line.startswith("=") or "Gobuster" in line or line.startswith("["):
                continue

            if mode == "dir":
                m = _DIR_RE.match(line)
                if m:
                    path, status_str, size_str, redirect = m.groups()
                    status = int(status_str)
                    size = int(size_str) if size_str else None
                    paths.append({
                        "path": path,
                        "status": status,
                        "size": size,
                        "redirect": redirect,
                    })
                    severity = _path_severity(path, status)
                    desc = f"Found {path} — HTTP {status}"
                    if size is not None:
                        desc += f" [{size} bytes]"
                    if redirect:
                        desc += f" → {redirect}"
                    findings.append({
                        "title": f"{path} ({status})",
                        "severity": severity,
                        "description": desc,
                        "tool_source": "gobuster",
                    })

            elif mode == "dns":
                m = _DNS_RE.match(line)
                if m:
                    subdomain = m.group(1)
                    paths.append({"subdomain": subdomain})
                    findings.append({
                        "title": f"Subdomain: {subdomain}",
                        "severity": "info",
                        "description": f"Discovered subdomain via DNS brute force: {subdomain}",
                        "tool_source": "gobuster",
                    })

            elif mode == "vhost":
                m = _VHOST_RE.match(line)
                if m:
                    vhost, status_str, size_str = m.groups()
                    status = int(status_str) if status_str else 0
                    paths.append({"vhost": vhost, "status": status})
                    findings.append({
                        "title": f"VHost: {vhost} ({status})",
                        "severity": "low",
                        "description": f"Virtual host discovered: {vhost} — HTTP {status}",
                        "tool_source": "gobuster",
                    })

        return ToolResult(
            raw_output=raw_output,
            parsed={
                "mode": mode,
                "target": target,
                "total_found": len(paths),
                "paths": paths,
            },
            findings=findings,
        )
