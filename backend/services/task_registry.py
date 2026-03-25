"""In-memory registry of running scan asyncio tasks.

Shared between the scans REST routes (create/start) and the
WebSocket endpoint (cancel).  Kept intentionally minimal — just a
dict protected by a lock so concurrent start/cancel calls are safe.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger("zeronyx.task_registry")

# scan_id → running asyncio.Task
_tasks: dict[str, asyncio.Task] = {}  # type: ignore[type-arg]


def register(scan_id: str, task: asyncio.Task) -> None:  # type: ignore[type-arg]
    _tasks[scan_id] = task
    logger.debug("Task registered: scan=%s", scan_id)


def cancel(scan_id: str) -> bool:
    """Cancel the task for scan_id.  Returns True if a task was found."""
    task = _tasks.get(scan_id)
    if task and not task.done():
        task.cancel()
        logger.info("Task cancelled: scan=%s", scan_id)
        return True
    return False


def remove(scan_id: str) -> None:
    _tasks.pop(scan_id, None)


def is_running(scan_id: str) -> bool:
    task = _tasks.get(scan_id)
    return task is not None and not task.done()
