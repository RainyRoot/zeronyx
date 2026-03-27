"""HTTP(S) proxy service backed by mitmproxy.

Architecture
------------
- mitmproxy is launched in a *background daemon thread* with its own asyncio
  event loop (``asyncio.run``).
- A custom addon (``_ZeroNyxAddon``) captures completed flows, persists them
  to the SQLite database via a thread-local SQLAlchemy session, and pushes a
  lightweight summary dict to any connected WebSocket clients via
  ``asyncio.run_coroutine_threadsafe`` on the main FastAPI event loop.
- A module-level ``ProxyManager`` singleton tracks:
    - the running ``DumpMaster`` instance (for stop/shutdown)
    - a set of live WebSocket connections (one per browser tab)
    - the main asyncio event loop reference (set at startup)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import threading
from datetime import datetime
from typing import Any, Callable, Set

from fastapi import WebSocket

logger = logging.getLogger("zeronyx.proxy")

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _headers_to_dict(headers) -> dict[str, str]:
    result: dict[str, str] = {}
    for k, v in headers.items():
        result[k.decode() if isinstance(k, bytes) else k] = (
            v.decode(errors="replace") if isinstance(v, bytes) else v
        )
    return result


def _safe_body(content: bytes | None, content_type: str) -> str | None:
    """Return body as text when possible, otherwise base64-encode."""
    if not content:
        return None
    ct = content_type.lower() if content_type else ""
    is_text = any(t in ct for t in ("text", "json", "xml", "javascript", "html", "form"))
    if is_text:
        try:
            return content.decode("utf-8", errors="replace")
        except Exception:
            pass
    return "base64:" + base64.b64encode(content).decode()


# ──────────────────────────────────────────────────────────────────────────────
# mitmproxy addon
# ──────────────────────────────────────────────────────────────────────────────

class _ZeroNyxAddon:
    """mitmproxy addon that saves flows and broadcasts to WS clients."""

    def __init__(self, project_id: str, main_loop: asyncio.AbstractEventLoop) -> None:
        self.project_id = project_id
        self._main_loop = main_loop

    # mitmproxy calls this after a complete request+response pair is received
    def response(self, flow) -> None:  # type: ignore[override]
        try:
            self._handle_flow(flow)
        except Exception as exc:
            logger.warning("proxy addon error: %s", exc, exc_info=True)

    def _handle_flow(self, flow) -> None:
        from backend.database import SessionLocal
        from backend.models.proxy_request import ProxyRequest

        req = flow.request
        resp = flow.response

        started = getattr(flow.request, "timestamp_start", None) or 0
        resp_obj = flow.response
        ended = getattr(resp_obj, "timestamp_end", None) if resp_obj else None or 0
        duration_ms = int((ended - started) * 1000) if (started and ended) else None

        req_ct = req.headers.get("content-type", "")
        resp_ct = resp.headers.get("content-type", "") if resp else ""

        entry_id = _new_uuid()
        now = datetime.utcnow()

        resp_content = resp.content if resp else None

        row = ProxyRequest(
            id=entry_id,
            project_id=self.project_id,
            method=req.method,
            scheme=req.scheme,
            host=req.pretty_host,
            port=req.port,
            path=req.path,
            url=req.pretty_url,
            request_headers=json.dumps(_headers_to_dict(req.headers)),
            request_body=_safe_body(req.content, req_ct),
            status_code=resp.status_code if resp else None,
            response_headers=json.dumps(_headers_to_dict(resp.headers)) if resp else None,
            response_body=_safe_body(resp_content, resp_ct) if resp else None,
            content_type=resp_ct or None,
            response_size=len(resp_content) if resp_content else None,
            duration_ms=duration_ms,
            timestamp=now,
        )

        # Persist synchronously in this thread
        with SessionLocal() as db:
            db.add(row)
            db.commit()

        # Broadcast summary to WS clients on main loop
        summary = {
            "type": "proxy_request",
            "id": entry_id,
            "method": req.method,
            "scheme": req.scheme,
            "host": req.pretty_host,
            "port": req.port,
            "path": req.path,
            "url": req.pretty_url,
            "status_code": resp.status_code if resp else None,
            "content_type": resp_ct or None,
            "response_size": row.response_size,
            "duration_ms": duration_ms,
            "timestamp": now.isoformat(),
        }
        asyncio.run_coroutine_threadsafe(
            proxy_manager._broadcast(summary),
            self._main_loop,
        )


def _new_uuid() -> str:
    import uuid
    return str(uuid.uuid4())


# ──────────────────────────────────────────────────────────────────────────────
# Proxy Manager (singleton)
# ──────────────────────────────────────────────────────────────────────────────

class ProxyManager:
    """Manages the mitmproxy instance and WebSocket clients."""

    def __init__(self) -> None:
        self._master: Any = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._port: int = 8080
        self._project_id: str | None = None
        self._main_loop: asyncio.AbstractEventLoop | None = None
        self._clients: Set[WebSocket] = set()
        self._lock = threading.Lock()

    # ── WS client management ──────────────────────────────────────────────────

    async def ws_connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    async def ws_disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def _broadcast(self, data: dict) -> None:  # type: ignore[type-arg]
        dead: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self, port: int, project_id: str) -> dict:  # type: ignore[type-arg]
        with self._lock:
            if self._running:
                return {"ok": False, "error": "Proxy already running", "port": self._port}

            try:
                import mitmproxy  # noqa: F401
            except ImportError:
                return {
                    "ok": False,
                    "error": "mitmproxy is not installed. Run: pip install mitmproxy",
                }

            self._port = port
            self._project_id = project_id
            self._main_loop = asyncio.get_event_loop()
            self._running = True

            self._thread = threading.Thread(
                target=self._run_proxy,
                args=(port, project_id, self._main_loop),
                daemon=True,
                name="zeronyx-proxy",
            )
            self._thread.start()
            logger.info("Proxy started on 127.0.0.1:%d (project=%s)", port, project_id)
            return {"ok": True, "port": port}

    def stop(self) -> dict:  # type: ignore[type-arg]
        with self._lock:
            if not self._running:
                return {"ok": False, "error": "Proxy is not running"}
            if self._master:
                try:
                    self._master.shutdown()
                except Exception:
                    pass
                self._master = None
            self._running = False
            logger.info("Proxy stopped")
            return {"ok": True}

    def status(self) -> dict:  # type: ignore[type-arg]
        return {
            "running": self._running,
            "port": self._port,
            "project_id": self._project_id,
        }

    # ── Internal thread ───────────────────────────────────────────────────────

    def _run_proxy(
        self,
        port: int,
        project_id: str,
        main_loop: asyncio.AbstractEventLoop,
    ) -> None:
        try:
            asyncio.run(self._run_async(port, project_id, main_loop))
        except Exception as exc:
            logger.error("Proxy thread error: %s", exc, exc_info=True)
        finally:
            with self._lock:
                self._running = False
                self._master = None

    async def _run_async(
        self,
        port: int,
        project_id: str,
        main_loop: asyncio.AbstractEventLoop,
    ) -> None:
        from mitmproxy import options
        from mitmproxy.tools.dump import DumpMaster

        addon = _ZeroNyxAddon(project_id=project_id, main_loop=main_loop)

        opts = options.Options(
            listen_host="127.0.0.1",
            listen_port=port,
            ssl_insecure=True,
        )
        master = DumpMaster(opts, with_termlog=False, with_dumper=False)
        master.addons.add(addon)
        self._master = master

        try:
            await master.run()
        except Exception:
            pass


# Module-level singleton
proxy_manager = ProxyManager()
