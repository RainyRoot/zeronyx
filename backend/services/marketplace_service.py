"""Plugin Marketplace service.

The marketplace is powered by a GitHub-hosted registry.json file.
The registry lists all published plugins with metadata and download URLs.

Registry URL (configurable via ZERONYX_MARKETPLACE_URL env var):
  https://raw.githubusercontent.com/zeronyx-plugins/registry/main/registry.json

Registry schema:
  {
    "version": "1",
    "updated_at": "2026-01-01T00:00:00Z",
    "plugins": [
      {
        "id":           "whois-lookup",
        "name":         "WHOIS Lookup",
        "version":      "1.2.0",
        "description":  "Run WHOIS on targets when added",
        "author":       "zeronyx-labs",
        "tags":         ["recon", "osint"],
        "stars":        42,
        "downloads":    1234,
        "download_url": "https://github.com/.../releases/download/v1.2.0/whois-lookup.zeronyx-plugin",
        "homepage":     "https://github.com/zeronyx-plugins/whois-lookup",
        "requires_pro": false,
        "plugin_type":  "backend",
        "permissions":  ["scan:read", "targets:read"]
      }
    ]
  }
"""

from __future__ import annotations

import logging
import os
import time
import tempfile
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("zeronyx.marketplace")

REGISTRY_URL = os.getenv(
    "ZERONYX_MARKETPLACE_URL",
    "https://raw.githubusercontent.com/zeronyx-plugins/registry/main/registry.json",
)

# Cache TTL in seconds (1 hour)
_CACHE_TTL = 3600
_cache: dict[str, Any] = {}
_cache_ts: float = 0.0


async def fetch_registry(force_refresh: bool = False) -> dict[str, Any]:
    """Fetch the marketplace registry, using an in-memory cache."""
    global _cache, _cache_ts

    now = time.monotonic()
    if not force_refresh and _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(REGISTRY_URL)
            resp.raise_for_status()
            data: dict[str, Any] = resp.json()
    except Exception as exc:
        logger.warning("Failed to fetch marketplace registry: %s", exc)
        if _cache:
            return _cache
        return {"version": "0", "plugins": [], "error": str(exc)}

    _cache = data
    _cache_ts = now
    logger.info("Marketplace registry refreshed: %d plugins", len(data.get("plugins", [])))
    return _cache


def _matches(plugin: dict[str, Any], query: str) -> bool:
    q = query.lower()
    return (
        q in plugin.get("name", "").lower()
        or q in plugin.get("description", "").lower()
        or any(q in tag for tag in plugin.get("tags", []))
        or q in plugin.get("author", "").lower()
    )


async def search_plugins(
    query: str = "",
    tag: str = "",
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """Search and paginate marketplace plugins."""
    registry = await fetch_registry()
    plugins: list[dict] = registry.get("plugins", [])

    if query:
        plugins = [p for p in plugins if _matches(p, query)]
    if tag:
        plugins = [p for p in plugins if tag in p.get("tags", [])]

    total = len(plugins)
    start = (page - 1) * per_page
    page_plugins = plugins[start: start + per_page]

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "plugins": page_plugins,
        "registry_updated_at": registry.get("updated_at", ""),
    }


async def install_from_marketplace(
    download_url: str,
    db: Any,
) -> Any:
    """Download a .zeronyx-plugin from a URL and install it."""
    from backend.services.plugin_manager import get_plugin_manager

    # Validate URL is from a trusted domain (basic allow-list)
    allowed_hosts = {"github.com", "raw.githubusercontent.com", "objects.githubusercontent.com"}
    from urllib.parse import urlparse
    parsed = urlparse(download_url)
    if parsed.netloc not in allowed_hosts:
        raise ValueError(
            f"Download URL host '{parsed.netloc}' is not in the allowed list. "
            "Only GitHub URLs are accepted for marketplace installs."
        )

    logger.info("Downloading marketplace plugin from %s", download_url)

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(download_url)
        resp.raise_for_status()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        tmp.write(resp.content)
        tmp_path = Path(tmp.name)

    try:
        manager = get_plugin_manager()
        plugin = manager.install_from_zip(tmp_path, db)
    finally:
        tmp_path.unlink(missing_ok=True)

    return plugin


async def get_all_tags() -> list[str]:
    """Return all unique tags across marketplace plugins."""
    registry = await fetch_registry()
    tags: set[str] = set()
    for plugin in registry.get("plugins", []):
        tags.update(plugin.get("tags", []))
    return sorted(tags)
