import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.api.websocket.connection_manager import manager
from backend.services import task_registry

logger = logging.getLogger("zeronyx.ws")
router = APIRouter(tags=["websocket"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.websocket("/ws/scan/{scan_id}")
async def scan_stream(websocket: WebSocket, scan_id: str) -> None:
    """Bidirectional WebSocket stream for a single scan session.

    Server → Client message types: connected, output, progress, error, done, ping
    Client → Server message types: cancel, pong
    """
    await manager.connect(scan_id, websocket)
    try:
        await manager.send(websocket, {
            "type": "connected",
            "scan_id": scan_id,
            "timestamp": _now(),
        })

        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "cancel":
                logger.info("Cancel requested  scan=%s", scan_id)
                task_registry.cancel(scan_id)
                # ScanService will broadcast "done" after CancelledError handling
                break

            # pong — keepalive acknowledgement, no reply needed

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(scan_id, websocket)
