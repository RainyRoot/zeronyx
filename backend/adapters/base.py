"""
Tool Adapter Base Class
=======================
Every external tool integration inherits from ToolAdapter.

IMPORTANT: Tools are ALWAYS started as subprocesses — never imported as
Python libraries.  This keeps ZeroNyx GPL-compliant when wrapping tools
like nmap, sqlmap, hydra, etc.

Concrete adapters only implement:
  - get_name / get_binary_path
  - build_command
  - parse_output
  - get_default_profiles

The full process lifecycle (start, stream, timeout, cancel, parse) is
handled here in the base class so every adapter gets it for free.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, AsyncGenerator

logger = logging.getLogger("zeronyx.adapters")


# ---------------------------------------------------------------------------
# Enums & Data Structures
# ---------------------------------------------------------------------------

class ToolStatus(Enum):
    NOT_INSTALLED = "not_installed"
    INSTALLED     = "installed"
    RUNNING       = "running"
    COMPLETED     = "completed"
    FAILED        = "failed"
    CANCELLED     = "cancelled"


@dataclass
class ToolResult:
    """Normalised output from a completed tool run.

    All lists contain plain dicts that map 1:1 to the DB model fields,
    ready to be persisted by ScanService without further transformation.
    """
    raw_output:  str
    parsed:      dict[str, Any]       = field(default_factory=dict)
    findings:    list[dict[str, Any]] = field(default_factory=list)
    hosts:       list[dict[str, Any]] = field(default_factory=list)
    ports:       list[dict[str, Any]] = field(default_factory=list)
    credentials: list[dict[str, Any]] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class AdapterError(Exception):
    """Raised when a tool fails to start or exits unexpectedly."""


class ToolNotInstalledError(AdapterError):
    """Raised when the required binary is not found on PATH."""


# ---------------------------------------------------------------------------
# Base Adapter
# ---------------------------------------------------------------------------

class ToolAdapter(ABC):
    """Abstract base for all ZeroNyx tool integrations.

    Lifecycle
    ---------
    ScanService calls ``adapter.run(config)`` which is an async generator:

        async for event in adapter.run(config):
            if isinstance(event, str):
                # stream line to frontend via WebSocket
            elif isinstance(event, ToolResult):
                # persist to DB, send "done" WS message

    Subclasses implement the 5 abstract methods below.  Everything else
    (subprocess management, streaming, timeout, cancellation) is handled
    here so adapters stay focused on tool-specific logic.
    """

    # Subclasses can override to set a hard timeout (seconds, 0 = none)
    DEFAULT_TIMEOUT: int = 0

    # ------------------------------------------------------------------
    # Abstract interface — every adapter must implement these
    # ------------------------------------------------------------------

    @abstractmethod
    def get_name(self) -> str:
        """Return the canonical tool name (lowercase, no spaces)."""

    @abstractmethod
    def get_binary_path(self) -> str | None:
        """Return the full path to the tool binary, or None if not found."""

    @abstractmethod
    def build_command(self, config: dict[str, Any]) -> list[str]:
        """Build the subprocess argv list from a scan config dict.

        Example::

            ["nmap", "-sV", "-oX", "-", "10.0.0.1"]

        Args:
            config: Free-form dict from the UI scan form.  Each adapter
                    documents its expected keys in ``get_default_profiles``.
        """

    @abstractmethod
    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        """Parse the complete stdout/stderr into the unified data model.

        Called once after the process exits successfully.  Convert raw
        tool output (XML, JSON, plaintext) into normalised lists of
        hosts, ports, findings, and credentials.
        """

    @abstractmethod
    def get_default_profiles(self) -> list[dict[str, Any]]:
        """Return predefined scan profiles shown in the UI.

        Returns::

            [
              {"name": "Quick Scan", "description": "Fast -T4 scan",
               "config": {"flags": "-T4 -F"}},
              ...
            ]
        """

    # ------------------------------------------------------------------
    # Concrete helpers — override only when needed
    # ------------------------------------------------------------------

    def check_installed(self) -> ToolStatus:
        """Check if the binary is available."""
        return ToolStatus.INSTALLED if self.get_binary_path() else ToolStatus.NOT_INSTALLED

    def is_installed(self) -> bool:
        return self.check_installed() == ToolStatus.INSTALLED

    async def stream_output(
        self,
        process: asyncio.subprocess.Process,
    ) -> AsyncGenerator[str, None]:
        """Yield stdout + stderr lines as they arrive.

        stderr lines are prefixed with ``[STDERR] `` so the frontend can
        style them differently.  Override this if the tool writes output
        in a non-line format or only to one stream.
        """
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def _drain(stream: asyncio.StreamReader, prefix: str) -> None:
            while True:
                raw = await stream.readline()
                if not raw:
                    break
                await queue.put(prefix + raw.decode(errors="replace").rstrip())
            await queue.put(None)  # sentinel

        tasks: list[asyncio.Task] = []
        sentinels_expected = 0

        if process.stdout:
            tasks.append(asyncio.create_task(_drain(process.stdout, "")))
            sentinels_expected += 1
        if process.stderr:
            tasks.append(asyncio.create_task(_drain(process.stderr, "[STDERR] ")))
            sentinels_expected += 1

        sentinels_received = 0
        while sentinels_received < sentinels_expected:
            item = await queue.get()
            if item is None:
                sentinels_received += 1
            else:
                yield item

        for t in tasks:
            t.cancel()

    # ------------------------------------------------------------------
    # Main lifecycle — called by ScanService
    # ------------------------------------------------------------------

    async def run(
        self,
        config: dict[str, Any],
        timeout: int | None = None,
    ) -> AsyncGenerator[str | ToolResult, None]:
        """Start the tool, stream output, then yield the parsed ToolResult.

        Yields
        ------
        str
            Individual output lines for live WebSocket streaming.
        ToolResult
            Final parsed result — always the last yielded value.

        Raises
        ------
        ToolNotInstalledError
            If the binary cannot be found.
        AdapterError
            If the process exits with a non-zero return code.
        asyncio.CancelledError
            Re-raised after graceful process termination so the caller
            (ScanService) can mark the scan as cancelled.
        """
        if not self.is_installed():
            raise ToolNotInstalledError(
                f"'{self.get_name()}' is not installed or not found on PATH. "
                "Please install it before running this scan."
            )

        cmd = self.build_command(config)
        effective_timeout = timeout if timeout is not None else self.DEFAULT_TIMEOUT

        logger.info("[%s] Starting: %s", self.get_name(), " ".join(cmd))

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        raw_lines: list[str] = []

        try:
            async for line in self.stream_output(process):
                raw_lines.append(line)
                yield line

            if effective_timeout > 0:
                await asyncio.wait_for(process.wait(), timeout=effective_timeout)
            else:
                await process.wait()

        except asyncio.TimeoutError:
            logger.warning("[%s] Timed out after %ds — killing process", self.get_name(), effective_timeout)
            process.kill()
            await process.wait()
            raise AdapterError(f"{self.get_name()} timed out after {effective_timeout}s")

        except asyncio.CancelledError:
            logger.info("[%s] Cancelled — terminating process", self.get_name())
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
            raise  # re-raise so ScanService marks the scan as cancelled

        raw_output = "\n".join(raw_lines)
        rc = process.returncode

        if rc not in (0, None):
            logger.warning("[%s] Exited with code %d", self.get_name(), rc)
            # Still attempt to parse — some tools (nmap) exit non-zero on
            # partial results but the output is still valuable
            try:
                result = self.parse_output(raw_output, config)
                yield result
                return
            except Exception:
                pass
            raise AdapterError(f"{self.get_name()} exited with code {rc}")

        logger.info("[%s] Completed — parsing output (%d lines)", self.get_name(), len(raw_lines))
        result = self.parse_output(raw_output, config)
        yield result
