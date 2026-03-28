"""SQLMap SQL injection scanner adapter — Task 3.6.

SQLMap is run as a subprocess with --batch (non-interactive).
Output is parsed to extract injectable parameters, database names,
tables, and dumped data.

Supported config keys
---------------------
url          — target URL (required)
data         — POST body data string (optional)
cookie       — HTTP Cookie header value (optional)
method       — HTTP method override, e.g. "PUT" (optional)
headers      — additional headers, newline-separated "Name: Value" (optional)
level        — int 1–5, depth of injection tests (default 1)
risk         — int 1–3, risk of injection payloads (default 1)
dbms         — target DBMS hint, e.g. "mysql", "mssql", "postgresql" (optional)
technique    — BEUSTQ flags, e.g. "BEU" (optional)
dbs          — bool, enumerate databases (default False)
tables       — bool, enumerate tables (default False)
dump         — bool, dump table contents (default False)
proxy        — HTTP proxy URL for SQLMap to use (optional)
threads      — int 1–10, concurrent threads (default 1)
timeout      — connection timeout in seconds (default 30)
random_agent — bool, use random User-Agent (default True)
"""

from __future__ import annotations

import re
import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult


# ---------------------------------------------------------------------------
# Output parsing patterns
# ---------------------------------------------------------------------------

# Injectable parameter detected
_INJECTABLE_RE = re.compile(
    r"\[INFO\].*?(?:GET|POST|Cookie|URI) parameter '(.+?)' (?:appears to be|is) '(.+?)' injectable",
    re.IGNORECASE,
)
# Alternative: "parameter 'X' is vulnerable"
_VULN_RE = re.compile(
    r"\[INFO\].*?parameter '(.+?)' is vulnerable",
    re.IGNORECASE,
)
# Back-end DBMS
_DBMS_RE = re.compile(
    r"\[INFO\] the back-end DBMS is (.+)$",
    re.IGNORECASE,
)
# Available databases count header
_DB_COUNT_RE = re.compile(r"available databases \[(\d+)\]", re.IGNORECASE)
# Database, table, column list items: [*] name
_LIST_ITEM_RE = re.compile(r"^\[\*\] (.+)$")
# Current database
_CURRENT_DB_RE = re.compile(r"\[INFO\] fetching current database.*?'(.+?)'", re.IGNORECASE)
# Database context header in dump
_DB_HEADER_RE = re.compile(r"^Database: (.+)$")
# Table header in dump
_TABLE_HEADER_RE = re.compile(r"^\[(\d+) (?:table|entries)\]")
# SQLMap warning / critical about no injection
_NOT_INJECTABLE_RE = re.compile(
    r"\[(?:WARNING|CRITICAL)\].*(?:not injectable|does not appear to be injectable|might not be injectable)",
    re.IGNORECASE,
)
# Saved to file
_SAVED_RE = re.compile(r"fetched data logged to text files", re.IGNORECASE)


def _parse_sqlmap(raw: str, config: dict[str, Any]) -> ToolResult:
    """Parse sqlmap stdout into structured findings."""
    lines = raw.splitlines()

    injections: list[dict[str, Any]] = []
    databases: list[str] = []
    tables: list[str] = []
    detected_dbms: str | None = None
    current_db: str | None = None
    warnings: list[str] = []

    in_db_list = False
    in_table_list = False

    seen_params: set[str] = set()

    for line in lines:
        stripped = line.strip()

        # Back-end DBMS
        m = _DBMS_RE.search(line)
        if m:
            detected_dbms = m.group(1).strip()
            continue

        # Current database
        m = _CURRENT_DB_RE.search(line)
        if m:
            current_db = m.group(1).strip()
            continue

        # Injectable parameter
        m = _INJECTABLE_RE.search(line)
        if m:
            param = m.group(1).strip()
            technique = m.group(2).strip()
            key = param.lower()
            if key not in seen_params:
                seen_params.add(key)
                injections.append({
                    "parameter": param,
                    "technique": technique,
                    "severity": "high",
                    "title": f"SQL Injection — parameter '{param}'",
                    "description": (
                        f"Parameter '{param}' is injectable via {technique}. "
                        f"Target: {config.get('url', '')}"
                    ),
                    "tool_source": "sqlmap",
                })
            continue

        m = _VULN_RE.search(line)
        if m:
            param = m.group(1).strip()
            key = param.lower()
            if key not in seen_params:
                seen_params.add(key)
                injections.append({
                    "parameter": param,
                    "technique": "unknown",
                    "severity": "high",
                    "title": f"SQL Injection — parameter '{param}'",
                    "description": (
                        f"Parameter '{param}' is vulnerable to SQL injection. "
                        f"Target: {config.get('url', '')}"
                    ),
                    "tool_source": "sqlmap",
                })
            continue

        # DB list section start
        if _DB_COUNT_RE.search(stripped):
            in_db_list = True
            in_table_list = False
            continue

        # Table list section start (after "fetching tables")
        if re.search(r"fetching tables for database", stripped, re.IGNORECASE):
            in_db_list = False
            in_table_list = True
            continue

        # List items
        m = _LIST_ITEM_RE.match(stripped)
        if m:
            item = m.group(1).strip()
            if in_db_list and item not in databases:
                databases.append(item)
            elif in_table_list and item not in tables:
                tables.append(item)
            continue

        # DB header in dump output (reset context)
        m = _DB_HEADER_RE.match(stripped)
        if m:
            in_db_list = False
            in_table_list = True
            db = m.group(1).strip()
            if db not in databases:
                databases.append(db)
            continue

        # Not injectable warning
        if _NOT_INJECTABLE_RE.search(line):
            warnings.append(stripped)
            continue

    # Build unified findings list
    findings: list[dict[str, Any]] = list(injections)

    # Add info finding for enumerated databases
    if databases:
        findings.append({
            "title": f"Databases enumerated ({len(databases)})",
            "severity": "info",
            "description": "Databases: " + ", ".join(databases),
            "tool_source": "sqlmap",
        })
    if tables:
        findings.append({
            "title": f"Tables enumerated ({len(tables)})",
            "severity": "info",
            "description": "Tables: " + ", ".join(tables),
            "tool_source": "sqlmap",
        })

    return ToolResult(
        raw_output=raw,
        parsed={
            "target":     config.get("url", ""),
            "dbms":       detected_dbms,
            "current_db": current_db,
            "injections": injections,
            "databases":  databases,
            "tables":     tables,
            "warnings":   warnings,
        },
        findings=findings,
    )


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class SQLMapAdapter(ToolAdapter):
    """SQLMap SQL injection scanner adapter."""

    DEFAULT_TIMEOUT: int = 3600  # 1 h hard cap

    def get_name(self) -> str:
        return "sqlmap"

    def get_binary_path(self) -> str | None:
        return shutil.which("sqlmap")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        url: str = config.get("url") or config.get("target", "")
        if not url:
            raise ValueError("SQLMap requires a 'url' in config")

        cmd: list[str] = ["sqlmap", "-u", url, "--batch"]

        # POST data
        data: str = config.get("data", "")
        if data:
            cmd += ["--data", data]

        # Cookie
        cookie: str = config.get("cookie", "")
        if cookie:
            cmd += ["--cookie", cookie]

        # HTTP method override
        method: str = config.get("method", "")
        if method and method.upper() not in ("GET", "POST"):
            cmd += ["--method", method.upper()]

        # Additional headers (newline-separated)
        headers: str = config.get("headers", "")
        if headers:
            cmd += ["--headers", headers]

        # Level / Risk
        level = int(config.get("level", 1))
        risk  = int(config.get("risk",  1))
        if level != 1:
            cmd += ["--level", str(max(1, min(5, level)))]
        if risk != 1:
            cmd += ["--risk",  str(max(1, min(3, risk)))]

        # DBMS hint
        dbms: str = config.get("dbms", "")
        if dbms:
            cmd += ["--dbms", dbms]

        # Technique
        technique: str = config.get("technique", "")
        if technique:
            cmd += ["--technique", technique.upper()]

        # Enumeration flags
        if config.get("dbs"):
            cmd.append("--dbs")
        if config.get("tables"):
            cmd.append("--tables")
        if config.get("dump"):
            cmd.append("--dump")

        # Proxy
        proxy: str = config.get("proxy", "")
        if proxy:
            cmd += ["--proxy", proxy]

        # Threads
        threads = int(config.get("threads", 1))
        if threads > 1:
            cmd += ["--threads", str(max(1, min(10, threads)))]

        # Timeout
        timeout = int(config.get("timeout", 30))
        cmd += ["--timeout", str(timeout)]

        # Random agent (default on for stealth)
        if config.get("random_agent", True):
            cmd.append("--random-agent")

        return [p for p in cmd if p]

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Quick Detection",
                "description": "Fast check — detect injectable parameters only",
                "config": {
                    "level": 1, "risk": 1,
                    "random_agent": True,
                },
            },
            {
                "name": "Enumerate DBs",
                "description": "Detect injection and enumerate databases",
                "config": {
                    "level": 2, "risk": 1,
                    "dbs": True,
                    "random_agent": True,
                },
            },
            {
                "name": "Full Enumeration",
                "description": "Databases + tables, level 2/risk 2",
                "config": {
                    "level": 2, "risk": 2,
                    "dbs": True, "tables": True,
                    "random_agent": True,
                },
            },
            {
                "name": "Form POST",
                "description": "Test POST body parameters (set 'data' field)",
                "config": {
                    "level": 1, "risk": 1,
                    "random_agent": True,
                },
            },
            {
                "name": "Cookie Injection",
                "description": "Test cookie values for injection (set 'cookie' field)",
                "config": {
                    "level": 1, "risk": 1,
                    "technique": "BEU",
                    "random_agent": True,
                },
            },
            {
                "name": "Aggressive",
                "description": "Level 5 / Risk 3 — full payloads, may be destructive",
                "config": {
                    "level": 5, "risk": 3,
                    "dbs": True, "tables": True,
                    "random_agent": True,
                },
            },
        ]

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        return _parse_sqlmap(raw_output, config)
