"""Nmap tool adapter — stub registered for 1.9, fully implemented in 1.10."""

from __future__ import annotations

import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult


@register
class NmapAdapter(ToolAdapter):
    """Nmap network scanner adapter.

    Runs nmap as a subprocess, captures XML output on stdout (-oX -),
    and parses hosts/ports/services into the unified data model.

    Full implementation: Task 1.10.
    """

    DEFAULT_TIMEOUT: int = 600  # 10 min hard cap

    def get_name(self) -> str:
        return "nmap"

    def get_binary_path(self) -> str | None:
        return shutil.which("nmap")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        flags = config.get("flags", "-sV")
        target = config.get("target", "")
        cmd = ["nmap"] + flags.split() + ["-oX", "-", target]
        return [part for part in cmd if part]  # strip empty strings

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        # Full XML parsing implemented in Task 1.10
        return ToolResult(raw_output=raw_output)

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {"name": "Quick Scan",        "description": "Fast scan, top 100 ports",         "config": {"flags": "-T4 -F"}},
            {"name": "Full Port Scan",    "description": "All 65535 ports",                  "config": {"flags": "-p- -T4"}},
            {"name": "Service Detection", "description": "Version + default scripts",         "config": {"flags": "-sV -sC"}},
            {"name": "OS Detection",      "description": "OS fingerprinting + service info",  "config": {"flags": "-O -sV"}},
            {"name": "Aggressive",        "description": "OS, version, scripts, traceroute",  "config": {"flags": "-A -T4"}},
            {"name": "UDP Top 100",       "description": "Top 100 UDP ports",                 "config": {"flags": "-sU --top-ports 100"}},
            {"name": "Vuln Scripts",      "description": "NSE vulnerability scripts",         "config": {"flags": "-sV --script vuln"}},
        ]
