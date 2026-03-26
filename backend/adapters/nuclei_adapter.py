"""Nuclei template-based vulnerability scanner adapter — Task 2.2.

Nuclei outputs one JSON object per line (JSONL) when run with the -json flag.
Each line represents a single template match.  The adapter collects all lines,
parses them, and builds a normalised ToolResult.

Supported config keys
---------------------
url / target  — target URL or hostname
severity      — comma-separated severity filter, e.g. "critical,high"
tags          — comma-separated tag filter, e.g. "cve,rce"
templates     — path to custom templates directory (optional)
threads       — concurrency, default 25
"""

from __future__ import annotations

import json
import re
import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)

# Severity sort order (lower = more severe)
_SEVERITY_ORDER: dict[str, int] = {
    "critical": 0,
    "high":     1,
    "medium":   2,
    "low":      3,
    "info":     4,
    "unknown":  5,
}


def _sort_key(item: dict[str, Any]) -> int:
    sev = item.get("severity", "unknown")
    return _SEVERITY_ORDER.get(sev, 99)


def _extract_cve(template_id: str, tags: list[str]) -> str | None:
    haystack = template_id + " " + " ".join(tags)
    m = _CVE_RE.search(haystack)
    return m.group(0).upper() if m else None


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class NucleiAdapter(ToolAdapter):
    """Nuclei template-based vulnerability scanner adapter."""

    DEFAULT_TIMEOUT: int = 1800  # 30 min hard cap

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "nuclei"

    def get_binary_path(self) -> str | None:
        return shutil.which("nuclei")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        target: str = config.get("url") or config.get("target", "")
        threads: str = str(config.get("threads", 25))

        cmd: list[str] = [
            "nuclei",
            "-u", target,
            "-json",       # JSONL output
            "-nc",         # no color codes in stdout
            "-c", threads,
            "-silent",     # suppress banner, only results to stdout
        ]

        severity: str = config.get("severity", "")
        if severity:
            cmd += ["-severity", severity]

        tags: str = config.get("tags", "")
        if tags:
            cmd += ["-tags", tags]

        templates: str = config.get("templates", "")
        if templates:
            cmd += ["-t", templates]

        return [p for p in cmd if p]

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Quick Scan",
                "description": "Default templates — all severities",
                "config": {"threads": 25},
            },
            {
                "name": "CVE Scan",
                "description": "Only CVE templates",
                "config": {"tags": "cve", "threads": 25},
            },
            {
                "name": "Critical & High",
                "description": "Critical and high severity findings only",
                "config": {"severity": "critical,high", "threads": 25},
            },
            {
                "name": "Exposed Panels",
                "description": "Admin panels, login pages, default credentials",
                "config": {"tags": "panel,login,default-login", "threads": 25},
            },
            {
                "name": "Misconfigurations",
                "description": "Common security misconfigurations",
                "config": {"tags": "misconfiguration,misconfig,config", "threads": 25},
            },
            {
                "name": "Web Technologies",
                "description": "Tech stack detection — CMS, frameworks, servers",
                "config": {"tags": "tech,cms,wp,drupal,joomla", "threads": 30},
            },
        ]

    # ------------------------------------------------------------------
    # Output parsing (JSONL)
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        target: str = config.get("url") or config.get("target", "")
        vulns:    list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                data: dict[str, Any] = json.loads(line)
            except json.JSONDecodeError:
                continue

            # Skip non-match events (nuclei may emit metadata lines)
            if not isinstance(data, dict):
                continue
            if not data.get("matcher-status", True):
                continue

            info         = data.get("info") or {}
            template_id  = data.get("template-id", "")
            name         = info.get("name") or template_id
            severity     = (info.get("severity") or "info").lower()
            host         = data.get("host", "")
            matched_at   = data.get("matched-at") or host

            raw_tags = info.get("tags") or []
            tags: list[str] = raw_tags if isinstance(raw_tags, list) else [raw_tags]

            description  = info.get("description", "")
            remediation  = info.get("remediation", "")
            cve          = _extract_cve(template_id, tags)

            vuln: dict[str, Any] = {
                "template_id":  template_id,
                "name":         name,
                "severity":     severity,
                "host":         host,
                "matched_at":   matched_at,
                "tags":         tags,
                "description":  description,
                "remediation":  remediation,
                "cve":          cve,
                "curl_command": data.get("curl-command"),
            }
            vulns.append(vuln)
            findings.append({
                "title":       name or template_id,
                "severity":    severity,
                "cve":         cve,
                "description": description or f"Template {template_id} matched at {matched_at}",
                "remediation": remediation or None,
                "tool_source": "nuclei",
            })

        # Sort by severity
        vulns.sort(key=_sort_key)
        findings.sort(key=_sort_key)

        return ToolResult(
            raw_output=raw_output,
            parsed={
                "target":        target,
                "total_found":   len(vulns),
                "vulnerabilities": vulns,
            },
            findings=findings,
        )
