"""SearchSploit (Exploit-DB local search) adapter — Task 2.5.

SearchSploit is run with the ``--json`` flag so the entire output is a
single JSON object.  The adapter parses exploits and shellcodes from
RESULTS_EXPLOIT and RESULTS_SHELLCODE.

Supported config keys
---------------------
query       — search term(s), e.g. "Apache 2.4.49" or "CVE-2021-41773"
title_only  — bool, pass -t (title search only, reduces noise) default False
type        — "exploits" | "shellcode" | "all" (default "all")
exact       — bool, use --exact for exact-string matching (default False)
"""

from __future__ import annotations

import json
import re
import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# ---------------------------------------------------------------------------
# Severity heuristics
# ---------------------------------------------------------------------------

_SEVERITY_KEYWORDS: dict[str, list[str]] = {
    "critical": ["remote code execution", "rce", "unauthenticated rce", "pre-auth rce"],
    "high":     ["remote", "privilege escalation", "privesc", "sql injection",
                 "authentication bypass", "arbitrary code"],
    "medium":   ["local", "xss", "cross-site", "disclosure", "path traversal",
                 "directory traversal", "csrf"],
    "low":      ["denial of service", "dos", "information disclosure"],
}


def _guess_severity(title: str, exploit_type: str) -> str:
    text = title.lower() + " " + exploit_type.lower()
    for sev, keywords in _SEVERITY_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return sev
    return "info"


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class SearchSploitAdapter(ToolAdapter):
    """SearchSploit Exploit-DB local search adapter."""

    DEFAULT_TIMEOUT: int = 60  # should complete in seconds

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "searchsploit"

    def get_binary_path(self) -> str | None:
        return shutil.which("searchsploit")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        query:      str  = config.get("query", "")
        title_only: bool = bool(config.get("title_only", False))
        exact:      bool = bool(config.get("exact", False))
        result_type: str = config.get("type", "all")

        cmd: list[str] = ["searchsploit", "--json"]

        if title_only:
            cmd.append("-t")

        if exact:
            cmd.append("--exact")

        if result_type == "exploits":
            cmd.append("--exploit")
        elif result_type == "shellcode":
            cmd.append("--shellcode")

        # Split query into tokens — searchsploit ANDs multiple terms
        if query:
            cmd.extend(query.strip().split())

        return [p for p in cmd if p]

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Full Search",
                "description": "Search both exploits and shellcodes",
                "config": {"type": "all"},
            },
            {
                "name": "Exploits Only",
                "description": "Show exploits only (no shellcodes)",
                "config": {"type": "exploits"},
            },
            {
                "name": "Title Search",
                "description": "Match query against titles only — fewer false positives",
                "config": {"title_only": True, "type": "exploits"},
            },
            {
                "name": "CVE Lookup",
                "description": "Exact CVE identifier lookup",
                "config": {"exact": True, "type": "all"},
            },
            {
                "name": "Remote Exploits",
                "description": "Title-search for remote exploitation modules",
                "config": {"title_only": True, "type": "exploits"},
            },
        ]

    # ------------------------------------------------------------------
    # Output parsing — entire stdout is a single JSON blob
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        query:  str = config.get("query", "")
        exploits:   list[dict[str, Any]] = []
        shellcodes: list[dict[str, Any]] = []
        findings:   list[dict[str, Any]] = []

        # searchsploit may emit ANSI codes or prefix lines before the JSON;
        # find the first '{' to locate the JSON start
        json_start = raw_output.find("{")
        if json_start == -1:
            return ToolResult(
                raw_output=raw_output,
                parsed={"query": query, "total_found": 0, "exploits": [], "shellcodes": []},
            )

        try:
            data: dict[str, Any] = json.loads(raw_output[json_start:])
        except json.JSONDecodeError:
            return ToolResult(
                raw_output=raw_output,
                parsed={"query": query, "total_found": 0, "exploits": [], "shellcodes": []},
            )

        for raw in data.get("RESULTS_EXPLOIT", []):
            edb_id     = str(raw.get("EDB-ID", ""))
            title      = raw.get("Title", "")
            date       = raw.get("Date", "")
            author     = raw.get("Author", "")
            kind       = raw.get("Type", "")
            platform   = raw.get("Platform", "")
            path       = raw.get("Path", "")
            severity   = _guess_severity(title, kind)

            # Extract any CVE references from title
            cves = re.findall(r"CVE-\d{4}-\d{4,7}", title, re.IGNORECASE)
            cve  = cves[0].upper() if cves else None

            entry: dict[str, Any] = {
                "edb_id":   edb_id,
                "title":    title,
                "date":     date,
                "author":   author,
                "type":     kind,
                "platform": platform,
                "path":     path,
                "cve":      cve,
                "severity": severity,
            }
            exploits.append(entry)
            findings.append({
                "title":       f"EDB-{edb_id}: {title[:80]}",
                "severity":    severity,
                "cve":         cve,
                "description": f"Type: {kind} | Platform: {platform} | Author: {author}",
                "tool_source": "searchsploit",
            })

        for raw in data.get("RESULTS_SHELLCODE", []):
            edb_id   = str(raw.get("EDB-ID", ""))
            title    = raw.get("Title", "")
            date     = raw.get("Date", "")
            author   = raw.get("Author", "")
            platform = raw.get("Platform", "")
            path     = raw.get("Path", "")

            entry = {
                "edb_id":   edb_id,
                "title":    title,
                "date":     date,
                "author":   author,
                "type":     "shellcode",
                "platform": platform,
                "path":     path,
                "cve":      None,
                "severity": "info",
            }
            shellcodes.append(entry)

        total = len(exploits) + len(shellcodes)

        return ToolResult(
            raw_output=raw_output,
            parsed={
                "query":       query,
                "total_found": total,
                "exploits":    exploits,
                "shellcodes":  shellcodes,
            },
            findings=findings,
        )
