"""Adapter registry — maps tool names to adapter classes.

Usage::

    from backend.adapters import get_adapter, list_adapters

    adapter = get_adapter("nmap")          # raises KeyError if unknown
    for name, cls in list_adapters():
        status = cls().check_installed()
"""

from __future__ import annotations

from backend.adapters.base import (  # noqa: F401 — re-export for convenience
    ToolAdapter,
    ToolResult,
    ToolStatus,
    AdapterError,
    ToolNotInstalledError,
)

# Registry populated via @register decorator
_REGISTRY: dict[str, type[ToolAdapter]] = {}


def register(cls: type[ToolAdapter]) -> type[ToolAdapter]:
    """Class decorator — registers an adapter under its tool name."""
    _REGISTRY[cls().get_name()] = cls
    return cls


def get_adapter(name: str) -> ToolAdapter:
    """Return an instantiated adapter for the given tool name.

    Raises KeyError if no adapter is registered under that name.
    """
    try:
        return _REGISTRY[name]()
    except KeyError:
        raise KeyError(
            f"No adapter registered for tool '{name}'. "
            f"Available: {sorted(_REGISTRY)}"
        )


def list_adapters() -> list[tuple[str, type[ToolAdapter]]]:
    """Return all registered (name, cls) pairs, sorted by name."""
    return sorted(_REGISTRY.items())


# ---------------------------------------------------------------------------
# Import all concrete adapters — each uses @register to self-register.
# Add new adapters here as they are implemented.
# ---------------------------------------------------------------------------

from backend.adapters import nmap_adapter      # noqa: E402, F401
from backend.adapters import gobuster_adapter  # noqa: E402, F401
from backend.adapters import nuclei_adapter    # noqa: E402, F401
from backend.adapters import nikto_adapter     # noqa: E402, F401
