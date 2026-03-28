"""Metasploit RPC service — wraps pymetasploit3 for async use.

Architecture
------------
- MsfService maintains a single MsfRpcClient connection to a running
  msfrpcd instance.
- All pymetasploit3 calls are synchronous (requests-based), so they run
  inside a ThreadPoolExecutor via asyncio.get_event_loop().run_in_executor.
- Module execution uses a daemon thread + asyncio.Queue for clean output
  streaming back into the async context.
- The module-level singleton ``msf_service`` is used by both the API
  routes and the MetasploitAdapter.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any, AsyncGenerator

from backend.adapters.base import ToolResult

logger = logging.getLogger("zeronyx.metasploit")

# Module types available in Free tier (auxiliary only)
FREE_TIER_TYPES = {"auxiliary"}


class MsfService:
    """Manages a single persistent connection to msfrpcd."""

    def __init__(self) -> None:
        self._client: Any = None
        self._connected = False
        self._host = "127.0.0.1"
        self._port = 55553
        self._ssl = True
        self._lock = threading.Lock()

    # ── Connection ────────────────────────────────────────────────────────────

    def connect(self, host: str, port: int, password: str, ssl: bool = True) -> dict:  # type: ignore[type-arg]
        with self._lock:
            try:
                from pymetasploit3.msfrpc import MsfRpcClient
                client = MsfRpcClient(password, server=host, port=port, ssl=ssl)
                # Quick validation — will raise if credentials wrong
                _ = client.core.version()
                self._client = client
                self._host = host
                self._port = port
                self._ssl = ssl
                self._connected = True
                logger.info("Connected to msfrpcd at %s:%d", host, port)
                return {"ok": True}
            except Exception as exc:
                self._client = None
                self._connected = False
                logger.warning("msfrpcd connect failed: %s", exc)
                return {"ok": False, "error": str(exc)}

    def disconnect(self) -> dict:  # type: ignore[type-arg]
        with self._lock:
            try:
                if self._client:
                    self._client.logout()
            except Exception:
                pass
            self._client = None
            self._connected = False
        return {"ok": True}

    def is_connected(self) -> bool:
        return self._connected and self._client is not None

    def status(self) -> dict:  # type: ignore[type-arg]
        info: dict[str, Any] = {
            "connected": self._connected,
            "host": self._host,
            "port": self._port,
            "ssl": self._ssl,
            "version": None,
        }
        if self._connected and self._client:
            try:
                v = self._client.core.version()
                info["version"] = v.get("version") or str(v)
            except Exception:
                self._connected = False
                info["connected"] = False
        return info

    # ── Module search ─────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        mod_type: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        if not self.is_connected():
            return []
        loop = asyncio.get_event_loop()

        def _search() -> list[dict[str, Any]]:
            raw = self._client.modules.search(query or "")
            results: list[dict[str, Any]] = []
            for m in raw:
                t = (m.get("type") or "").lower()
                if mod_type and t != mod_type.lower():
                    continue
                results.append({
                    "type": t,
                    "name": m.get("name", ""),
                    "fullname": f"{t}/{m.get('name', '')}",
                    "rank": m.get("rank", 0),
                    "description": m.get("description", ""),
                    "references": m.get("references", []),
                })
                if len(results) >= limit:
                    break
            return results

        return await loop.run_in_executor(None, _search)

    # ── Module info ───────────────────────────────────────────────────────────

    async def module_info(self, mod_type: str, mod_name: str) -> dict[str, Any] | None:
        if not self.is_connected():
            return None
        loop = asyncio.get_event_loop()

        def _info() -> dict[str, Any]:
            m = self._client.modules.use(mod_type, mod_name)
            options = {}
            for name, opt in (m.options or {}).items():
                options[name] = {
                    "name": name,
                    "type": opt.get("type", "string"),
                    "required": opt.get("required", False),
                    "default": opt.get("default", ""),
                    "description": opt.get("desc", ""),
                    "current": opt.get("default", ""),
                }
            return {
                "type": mod_type,
                "name": mod_name,
                "fullname": f"{mod_type}/{mod_name}",
                "description": getattr(m, "description", "") or "",
                "authors": getattr(m, "authors", []),
                "references": getattr(m, "references", []),
                "rank": getattr(m, "rank", "normal"),
                "options": options,
                "required": list(m.required or []),
            }

        try:
            return await loop.run_in_executor(None, _info)
        except Exception as exc:
            logger.warning("module_info failed for %s/%s: %s", mod_type, mod_name, exc)
            return None

    # ── Module execution (async generator) ───────────────────────────────────

    async def run_module(
        self,
        mod_type: str,
        mod_name: str,
        options: dict[str, Any],
    ) -> AsyncGenerator[str | ToolResult, None]:
        if not self.is_connected():
            yield "[ERROR] Not connected to msfrpcd"
            yield ToolResult(raw_output="Not connected")
            return

        queue: asyncio.Queue[str | None] = asyncio.Queue()
        output_lines: list[str] = []
        loop = asyncio.get_event_loop()

        def _execute() -> None:
            try:
                console = self._client.consoles.console()
                cid = console.cid

                def _write(cmd: str) -> None:
                    self._client.consoles.write(cid, cmd)

                _write(f"use {mod_type}/{mod_name}\n")
                for k, v in options.items():
                    _write(f"set {k} {v}\n")
                _write("run\n")

                while True:
                    data = self._client.consoles.read(cid)
                    text = data.get("data", "")
                    if text:
                        for line in text.split("\n"):
                            stripped = line.rstrip()
                            if stripped:
                                output_lines.append(stripped)
                                loop.call_soon_threadsafe(queue.put_nowait, stripped)
                    busy = data.get("busy", False)
                    if not busy:
                        # One final read after busy=False to flush remaining output
                        time.sleep(0.5)
                        final = self._client.consoles.read(cid)
                        if final.get("data"):
                            for line in final["data"].split("\n"):
                                stripped = line.rstrip()
                                if stripped:
                                    output_lines.append(stripped)
                                    loop.call_soon_threadsafe(queue.put_nowait, stripped)
                        break
                    time.sleep(0.3)

                try:
                    self._client.consoles.destroy(cid)
                except Exception:
                    pass

            except Exception as exc:
                msg = f"[ERROR] Module execution failed: {exc}"
                logger.error(msg, exc_info=True)
                loop.call_soon_threadsafe(queue.put_nowait, msg)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        thread = threading.Thread(target=_execute, daemon=True, name="zeronyx-msf")
        thread.start()

        while True:
            line = await queue.get()
            if line is None:
                break
            yield line

        raw = "\n".join(output_lines)
        yield ToolResult(
            raw_output=raw,
            parsed={"module": f"{mod_type}/{mod_name}", "output": raw},
        )


# Module-level singleton
msf_service = MsfService()
