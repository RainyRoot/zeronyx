from __future__ import annotations

import asyncio
import logging
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger("zeronyx.ws")

_PING_INTERVAL_SECONDS = 30


class ConnectionManager:
    """Manages active WebSocket connections grouped by scan_id.

    Supports:
    - Multiple simultaneous viewers per scan
    - Broadcast to all viewers of a scan
    - Automatic ping keepalives (every 30 s)
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._ping_tasks: Dict[WebSocket, asyncio.Task] = {}  # type: ignore[type-arg]

    async def connect(self, scan_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(scan_id, set()).add(ws)
        task = asyncio.create_task(self._ping_loop(ws), name=f"ping:{scan_id}")
        self._ping_tasks[ws] = task
        logger.info("WS connected  scan=%s  total=%d", scan_id, len(self._connections[scan_id]))

    async def disconnect(self, scan_id: str, ws: WebSocket) -> None:
        task = self._ping_tasks.pop(ws, None)
        if task:
            task.cancel()
        pool = self._connections.get(scan_id, set())
        pool.discard(ws)
        if not pool:
            self._connections.pop(scan_id, None)
        logger.info("WS disconnected  scan=%s", scan_id)

    async def send(self, ws: WebSocket, message: dict) -> None:  # type: ignore[type-arg]
        try:
            await ws.send_json(message)
        except Exception as exc:  # noqa: BLE001
            logger.debug("WS send failed: %s", exc)

    async def broadcast(self, scan_id: str, message: dict) -> None:  # type: ignore[type-arg]
        """Send a message to every viewer currently watching scan_id."""
        for ws in list(self._connections.get(scan_id, set())):
            await self.send(ws, message)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _ping_loop(self, ws: WebSocket) -> None:
        try:
            while True:
                await asyncio.sleep(_PING_INTERVAL_SECONDS)
                await ws.send_json({"type": "ping"})
        except asyncio.CancelledError:
            pass
        except Exception:  # noqa: BLE001
            pass


# Module-level singleton shared by all routes
manager = ConnectionManager()
