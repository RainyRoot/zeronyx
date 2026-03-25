"""Unit tests for the task registry — Task 1.14."""

import asyncio
import pytest

from backend.services import task_registry


@pytest.fixture(autouse=True)
def clean_registry():
    """Ensure the registry is clean before and after each test."""
    task_registry._tasks.clear()
    yield
    task_registry._tasks.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_register_and_is_running():
    async def _dummy():
        await asyncio.sleep(10)

    loop = asyncio.new_event_loop()
    task = loop.create_task(_dummy())
    task_registry.register("scan-1", task)
    assert task_registry.is_running("scan-1")
    task.cancel()
    loop.close()


def test_is_running_unknown_scan():
    assert not task_registry.is_running("does-not-exist")


def test_cancel_unknown_returns_false():
    assert not task_registry.cancel("does-not-exist")


def test_remove_cleans_up():
    async def _dummy():
        await asyncio.sleep(10)

    loop = asyncio.new_event_loop()
    task = loop.create_task(_dummy())
    task_registry.register("scan-2", task)
    task_registry.remove("scan-2")
    assert not task_registry.is_running("scan-2")
    task.cancel()
    loop.close()


@pytest.mark.asyncio
async def test_cancel_stops_task():
    cancelled = False

    async def _stoppable():
        nonlocal cancelled
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            cancelled = True
            raise

    task = asyncio.create_task(_stoppable())
    task_registry.register("scan-3", task)
    result = task_registry.cancel("scan-3")
    assert result is True

    await asyncio.sleep(0)   # let the cancellation propagate
    assert task.cancelled() or cancelled
