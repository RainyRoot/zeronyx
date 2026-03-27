"""HTTP(S) proxy service backed by mitmproxy.

Architecture
------------
- mitmproxy runs in a daemon thread with its own asyncio event loop.
- ``_ZeroNyxAddon`` handles two hooks:
    - ``response``: captures completed flows → DB + WS broadcast
    - ``request`` (async): if intercept is active, pauses the flow and
      waits for a user action (forward / drop) via an asyncio.Event.
- ``ProxyManager`` (module singleton) exposes start/stop, intercept
  toggle, forward/drop, and replay (via httpx).
- Thread-safe handoff between the FastAPI loop and the mitmproxy loop
  uses ``loop.call_soon_threadsafe`` for Event.set() calls and
  ``asyncio.run_coroutine_threadsafe`` for WS broadcasts.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import threading
from datetime import datetime
from typing import Any, Set
from urllib.parse import urlparse

from fastapi import WebSocket

logger = logging.getLogger("zeronyx.proxy")


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _new_uuid() -> str:
    import uuid
    return str(uuid.uuid4())


def _headers_to_dict(headers) -> dict[str, str]:
    result: dict[str, str] = {}
    for k, v in headers.items():
        result[k.decode() if isinstance(k, bytes) else k] = (
            v.decode(errors="replace") if isinstance(v, bytes) else v
        )
    return result


def _safe_body(content: bytes | None, content_type: str) -> str | None:
    """Return body as UTF-8 text for text types, base64-prefixed otherwise."""
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
    """Captures flows, handles intercept, broadcasts to WS."""

    def __init__(self, project_id: str, main_loop: asyncio.AbstractEventLoop) -> None:
        self.project_id = project_id
        self._main_loop = main_loop

    # ── Intercept hook (runs before the request is forwarded) ─────────────────

    async def request(self, flow) -> None:  # type: ignore[override]
        if not proxy_manager._intercept_enabled:
            return
        if not self._matches_filter(flow.request.pretty_url):
            return
        await self._intercept_flow(flow)

    def _matches_filter(self, url: str) -> bool:
        flt = proxy_manager._intercept_filter
        if not flt:
            return True
        return flt.lower() in url.lower()

    async def _intercept_flow(self, flow) -> None:
        flow_id = flow.id
        req = flow.request
        req_ct = req.headers.get("content-type", "")

        summary = {
            "type": "intercept_request",
            "flow_id": flow_id,
            "method": req.method,
            "scheme": req.scheme,
            "host": req.pretty_host,
            "port": req.port,
            "path": req.path,
            "url": req.pretty_url,
            "headers": _headers_to_dict(req.headers),
            "body": _safe_body(req.content, req_ct),
        }

        # asyncio.Event in the *mitmproxy* loop so we can await it here
        event = asyncio.Event()
        proxy_manager._pending_flows[flow_id] = {
            "flow": flow,
            "event": event,
            "action": "pending",
            "modifications": None,
            "summary": summary,
        }

        # Notify WS clients on the main FastAPI loop
        asyncio.run_coroutine_threadsafe(
            proxy_manager._broadcast(summary), self._main_loop
        )

        # Block this flow until user acts (or timeout)
        try:
            await asyncio.wait_for(event.wait(), timeout=120)
        except asyncio.TimeoutError:
            logger.debug("Intercept timeout for flow %s — forwarding as-is", flow_id)

        entry = proxy_manager._pending_flows.pop(flow_id, None)
        if not entry:
            return

        if entry["action"] == "drop":
            flow.kill()
            # Broadcast removal
            asyncio.run_coroutine_threadsafe(
                proxy_manager._broadcast({"type": "intercept_dropped", "flow_id": flow_id}),
                self._main_loop,
            )
            return

        # Apply any user modifications before forwarding
        mods = entry.get("modifications") or {}
        if "method" in mods:
            flow.request.method = mods["method"]
        if "path" in mods:
            flow.request.path = mods["path"]
        if "headers" in mods:
            flow.request.headers.clear()
            for k, v in mods["headers"].items():
                flow.request.headers[k] = v
        if "body" in mods:
            body_val = mods["body"]
            if body_val and body_val.startswith("base64:"):
                flow.request.content = base64.b64decode(body_val[7:])
            else:
                flow.request.text = body_val or ""

        asyncio.run_coroutine_threadsafe(
            proxy_manager._broadcast({"type": "intercept_forwarded", "flow_id": flow_id}),
            self._main_loop,
        )

    # ── Response hook (flow complete) ─────────────────────────────────────────

    def response(self, flow) -> None:  # type: ignore[override]
        try:
            self._handle_flow(flow)
        except Exception as exc:
            logger.warning("proxy addon response error: %s", exc, exc_info=True)

    def _handle_flow(self, flow) -> None:
        from backend.database import SessionLocal
        from backend.models.proxy_request import ProxyRequest

        req = flow.request
        resp = flow.response

        started = getattr(req, "timestamp_start", None) or 0
        ended = getattr(resp, "timestamp_end", None) if resp else None
        duration_ms = int(((ended or started) - started) * 1000) if started else None

        req_ct = req.headers.get("content-type", "")
        resp_ct = resp.headers.get("content-type", "") if resp else ""
        resp_content = resp.content if resp else None

        entry_id = _new_uuid()
        now = datetime.utcnow()

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
            response_body=_safe_body(resp_content, resp_ct),
            content_type=resp_ct or None,
            response_size=len(resp_content) if resp_content else None,
            duration_ms=duration_ms,
            timestamp=now,
        )

        with SessionLocal() as db:
            db.add(row)
            db.commit()

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
            proxy_manager._broadcast(summary), self._main_loop
        )


# ──────────────────────────────────────────────────────────────────────────────
# Proxy Manager (singleton)
# ──────────────────────────────────────────────────────────────────────────────

class ProxyManager:
    """Manages the mitmproxy instance, WebSocket clients, intercept, and replay."""

    def __init__(self) -> None:
        self._master: Any = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._port: int = 8080
        self._project_id: str | None = None
        self._main_loop: asyncio.AbstractEventLoop | None = None
        self._mitm_loop: asyncio.AbstractEventLoop | None = None
        self._clients: Set[WebSocket] = set()
        self._lock = threading.Lock()

        # Intercept state
        self._intercept_enabled: bool = False
        self._intercept_filter: str = ""
        # flow_id → {flow, event, action, modifications, summary}
        self._pending_flows: dict[str, dict[str, Any]] = {}

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
            # Release any pending flows first
            for entry in list(self._pending_flows.values()):
                entry["action"] = "drop"
                if self._mitm_loop:
                    self._mitm_loop.call_soon_threadsafe(entry["event"].set)
            self._pending_flows.clear()

            if self._master:
                try:
                    self._master.shutdown()
                except Exception:
                    pass
                self._master = None
            self._running = False
            self._intercept_enabled = False
            logger.info("Proxy stopped")
            return {"ok": True}

    def status(self) -> dict:  # type: ignore[type-arg]
        return {
            "running": self._running,
            "port": self._port,
            "project_id": self._project_id,
            "intercept_enabled": self._intercept_enabled,
            "intercept_filter": self._intercept_filter,
            "pending_count": len(self._pending_flows),
        }

    # ── Intercept controls ────────────────────────────────────────────────────

    def set_intercept(self, enabled: bool, filter_str: str = "") -> dict:  # type: ignore[type-arg]
        self._intercept_enabled = enabled
        self._intercept_filter = filter_str
        if not enabled:
            # Release all pending flows — forward as-is
            for flow_id, entry in list(self._pending_flows.items()):
                entry["action"] = "forward"
                if self._mitm_loop:
                    self._mitm_loop.call_soon_threadsafe(entry["event"].set)
            self._pending_flows.clear()
        return {"ok": True, "intercept_enabled": enabled}

    def get_pending(self) -> list[dict]:  # type: ignore[type-arg]
        return [
            {
                "flow_id": flow_id,
                **{k: v for k, v in entry["summary"].items() if k != "type"},
            }
            for flow_id, entry in self._pending_flows.items()
        ]

    def forward_flow(self, flow_id: str, modifications: dict | None = None) -> dict:  # type: ignore[type-arg]
        entry = self._pending_flows.get(flow_id)
        if not entry:
            return {"ok": False, "error": "Flow not found or already released"}
        entry["action"] = "forward"
        entry["modifications"] = modifications
        if self._mitm_loop:
            self._mitm_loop.call_soon_threadsafe(entry["event"].set)
        return {"ok": True}

    def drop_flow(self, flow_id: str) -> dict:  # type: ignore[type-arg]
        entry = self._pending_flows.get(flow_id)
        if not entry:
            return {"ok": False, "error": "Flow not found or already released"}
        entry["action"] = "drop"
        if self._mitm_loop:
            self._mitm_loop.call_soon_threadsafe(entry["event"].set)
        return {"ok": True}

    # ── Replay ────────────────────────────────────────────────────────────────

    async def replay(
        self,
        project_id: str,
        method: str,
        url: str,
        headers: dict,  # type: ignore[type-arg]
        body: str | None,
    ) -> dict:  # type: ignore[type-arg]
        import httpx

        # Strip hop-by-hop headers that break direct requests
        skip = {"host", "content-length", "transfer-encoding", "connection"}
        req_headers = {k: v for k, v in headers.items() if k.lower() not in skip}

        body_bytes: bytes | None = None
        if body:
            if body.startswith("base64:"):
                body_bytes = base64.b64decode(body[7:])
            else:
                body_bytes = body.encode("utf-8", errors="replace")

        start = datetime.utcnow()
        try:
            async with httpx.AsyncClient(
                verify=False, follow_redirects=True, timeout=30.0
            ) as client:
                resp = await client.request(
                    method.upper(), url, headers=req_headers, content=body_bytes
                )
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

        end = datetime.utcnow()
        duration_ms = int((end - start).total_seconds() * 1000)

        parsed = urlparse(url)
        resp_ct = resp.headers.get("content-type", "")
        resp_body = _safe_body(resp.content, resp_ct)

        # Persist as a new proxy request tagged "replay"
        from backend.database import SessionLocal
        from backend.models.proxy_request import ProxyRequest

        entry_id = _new_uuid()
        row = ProxyRequest(
            id=entry_id,
            project_id=project_id,
            method=method.upper(),
            scheme=parsed.scheme,
            host=parsed.hostname or "",
            port=parsed.port or (443 if parsed.scheme == "https" else 80),
            path=parsed.path or "/",
            url=url,
            request_headers=json.dumps(req_headers),
            request_body=body,
            status_code=resp.status_code,
            response_headers=json.dumps(dict(resp.headers)),
            response_body=resp_body,
            content_type=resp_ct or None,
            response_size=len(resp.content),
            duration_ms=duration_ms,
            timestamp=end,
            tags=json.dumps(["replay"]),
        )
        with SessionLocal() as db:
            db.add(row)
            db.commit()

        # Push to WS
        if self._main_loop:
            asyncio.run_coroutine_threadsafe(
                self._broadcast({
                    "type": "proxy_request",
                    "id": entry_id,
                    "method": method.upper(),
                    "scheme": parsed.scheme,
                    "host": parsed.hostname or "",
                    "port": row.port,
                    "path": parsed.path or "/",
                    "url": url,
                    "status_code": resp.status_code,
                    "content_type": resp_ct or None,
                    "response_size": len(resp.content),
                    "duration_ms": duration_ms,
                    "timestamp": end.isoformat(),
                    "tags": ["replay"],
                }),
                self._main_loop,
            )

        return {
            "ok": True,
            "id": entry_id,
            "status_code": resp.status_code,
            "response_headers": dict(resp.headers),
            "response_body": resp_body,
            "content_type": resp_ct or None,
            "response_size": len(resp.content),
            "duration_ms": duration_ms,
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
                self._mitm_loop = None

    async def _run_async(
        self,
        port: int,
        project_id: str,
        main_loop: asyncio.AbstractEventLoop,
    ) -> None:
        from mitmproxy import options
        from mitmproxy.tools.dump import DumpMaster

        self._mitm_loop = asyncio.get_event_loop()
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
