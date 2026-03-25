from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/scan/{scan_id}")
async def scan_stream(websocket: WebSocket, scan_id: str):
    """
    WebSocket endpoint for live scan output streaming.
    Implemented in task 1.4 (WebSocket Bridge).
    """
    await websocket.accept()
    try:
        await websocket.send_json({"type": "info", "message": f"Connected to scan {scan_id}"})
        # Hold the connection until client disconnects
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
