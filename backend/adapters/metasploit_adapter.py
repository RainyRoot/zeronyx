"""Metasploit adapter — Task 3.4.

Unlike other tool adapters that wrap a subprocess, this adapter delegates
to MsfService which communicates with a running msfrpcd via RPC.

The ToolAdapter interface is kept for health-check compatibility (the
startup tool-scan checks ``is_installed()`` for every registered adapter).
The ``run()`` method is overridden to use the RPC service instead of
spawning a subprocess.

Config keys (passed as scan config)
-------------------------------------
mod_type    — module type: auxiliary | exploit | post | payload | encoder
mod_name    — module path, e.g. "scanner/smb/smb_ms17_010"
options     — dict of MSF option name → value
"""

from __future__ import annotations

import shutil
from typing import Any, AsyncGenerator

from backend.adapters import register
from backend.adapters.base import AdapterError, ToolAdapter, ToolResult


@register
class MetasploitAdapter(ToolAdapter):
    """Metasploit framework integration via msfrpcd RPC."""

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "metasploit"

    def get_binary_path(self) -> str | None:
        return shutil.which("msfconsole")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        # Not used — run() is overridden to use RPC
        return ["msfconsole"]

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        # Not used — run() yields ToolResult directly from the service
        return ToolResult(raw_output=raw_output)

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "SMB EternalBlue Check",
                "description": "Auxiliary scanner: check MS17-010 vulnerability",
                "config": {
                    "mod_type": "auxiliary",
                    "mod_name": "scanner/smb/smb_ms17_010",
                    "options": {"THREADS": "10"},
                },
            },
            {
                "name": "Port Scanner",
                "description": "Auxiliary TCP port scanner",
                "config": {
                    "mod_type": "auxiliary",
                    "mod_name": "scanner/portscan/tcp",
                    "options": {"THREADS": "10", "PORTS": "1-1024"},
                },
            },
            {
                "name": "SSH Version Detect",
                "description": "Auxiliary SSH version scanner",
                "config": {
                    "mod_type": "auxiliary",
                    "mod_name": "scanner/ssh/ssh_version",
                    "options": {"THREADS": "10"},
                },
            },
        ]

    # ------------------------------------------------------------------
    # Override run() — delegates to MsfService instead of subprocess
    # ------------------------------------------------------------------

    async def run(
        self,
        config: dict[str, Any],
        timeout: int | None = None,
    ) -> AsyncGenerator[str | ToolResult, None]:
        from backend.services.metasploit_service import msf_service

        if not msf_service.is_connected():
            raise AdapterError(
                "Not connected to msfrpcd. "
                "Open the Metasploit page and connect to a running msfrpcd instance."
            )

        mod_type = config.get("mod_type", "auxiliary")
        mod_name = config.get("mod_name", "")
        options = config.get("options", {})

        if not mod_name:
            raise AdapterError("No module specified in scan config (mod_name is required).")

        async for item in msf_service.run_module(mod_type, mod_name, options):
            yield item
