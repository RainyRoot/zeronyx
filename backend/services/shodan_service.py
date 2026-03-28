"""Shodan passive recon service — Task 3.7.

Wraps the official `shodan` Python library (sync) behind async helpers
using run_in_executor so FastAPI's event loop is never blocked.

API key is persisted in ~/.zeronyx/api_keys.json alongside future
keys for Censys, etc.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from backend.config import settings

logger = logging.getLogger("zeronyx.shodan")

_KEYS_FILE = "api_keys.json"


def _keys_path() -> Path:
    return settings.data_dir / _KEYS_FILE


def _load_keys() -> dict[str, str]:
    path = _keys_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_keys(data: dict[str, str]) -> None:
    path = _keys_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2))


class ShodanService:
    """Singleton service for Shodan API interactions."""

    def __init__(self) -> None:
        self._api: Any = None          # shodan.Shodan instance
        self._key: str | None = None
        self._plan_info: dict | None = None

    # ------------------------------------------------------------------
    # Key management
    # ------------------------------------------------------------------

    def load_saved_key(self) -> str | None:
        """Return previously saved key (or None)."""
        return _load_keys().get("shodan")

    def save_key(self, key: str) -> None:
        keys = _load_keys()
        keys["shodan"] = key
        _save_keys(keys)
        self._key = key

    def remove_key(self) -> None:
        keys = _load_keys()
        keys.pop("shodan", None)
        _save_keys(keys)
        self._key = None
        self._api = None
        self._plan_info = None

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    async def connect(self, key: str) -> dict[str, Any]:
        """Initialise client and validate key by calling api.info().

        Returns info dict on success, raises on failure.
        """
        import shodan  # lazy import — optional dependency

        loop = asyncio.get_running_loop()
        api = shodan.Shodan(key)

        def _test():
            return api.info()

        info = await loop.run_in_executor(None, _test)
        # Key is valid
        self._api  = api
        self._key  = key
        self._plan_info = info
        self.save_key(key)
        logger.info("Shodan connected — plan: %s, credits: %s", info.get("plan"), info.get("query_credits"))
        return info

    async def auto_connect(self) -> bool:
        """Try to connect using the saved key. Returns True if successful."""
        key = self.load_saved_key()
        if not key:
            return False
        try:
            await self.connect(key)
            return True
        except Exception as e:
            logger.debug("Shodan auto-connect failed: %s", e)
            return False

    def disconnect(self) -> None:
        self._api = None
        self._plan_info = None

    def is_connected(self) -> bool:
        return self._api is not None

    def get_status(self) -> dict[str, Any]:
        return {
            "connected":    self.is_connected(),
            "has_key":      bool(self.load_saved_key()),
            "plan":         self._plan_info.get("plan") if self._plan_info else None,
            "query_credits": self._plan_info.get("query_credits") if self._plan_info else None,
            "scan_credits": self._plan_info.get("scan_credits") if self._plan_info else None,
        }

    # ------------------------------------------------------------------
    # API helpers (all async via run_in_executor)
    # ------------------------------------------------------------------

    def _require_api(self) -> None:
        if self._api is None:
            raise RuntimeError("Not connected to Shodan. Save an API key and connect first.")

    async def get_host(self, ip: str, history: bool = False) -> dict[str, Any]:
        """Full host lookup — all banners, ports, vulns."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            return self._api.host(ip, history=history)

        host = await loop.run_in_executor(None, _fetch)
        return _normalise_host(host)

    async def search(
        self,
        query: str,
        page: int = 1,
        limit: int = 100,
        facets: list[str] | None = None,
    ) -> dict[str, Any]:
        """Search Shodan — costs query credits."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            return self._api.search(
                query,
                page=page,
                limit=min(limit, 100),
                facets=facets or [],
            )

        result = await loop.run_in_executor(None, _fetch)
        return {
            "total":   result.get("total", 0),
            "matches": [_normalise_match(m) for m in result.get("matches", [])],
            "facets":  result.get("facets", {}),
        }

    async def count(self, query: str) -> dict[str, Any]:
        """Count results — does NOT cost credits."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            return self._api.count(query)

        result = await loop.run_in_executor(None, _fetch)
        return {"total": result.get("total", 0), "facets": result.get("facets", {})}

    async def get_info(self) -> dict[str, Any]:
        """Refresh and return API plan / credits info."""
        self._require_api()
        loop = asyncio.get_running_loop()
        info = await loop.run_in_executor(None, self._api.info)
        self._plan_info = info
        return info


# ---------------------------------------------------------------------------
# Normalisation helpers — make Shodan dicts JSON-safe and frontend-friendly
# ---------------------------------------------------------------------------

def _normalise_host(h: dict) -> dict[str, Any]:
    """Trim a raw Shodan host dict to what the UI needs."""
    services = []
    for item in h.get("data", []):
        svc: dict[str, Any] = {
            "port":      item.get("port"),
            "transport": item.get("transport", "tcp"),
            "product":   item.get("product"),
            "version":   item.get("version"),
            "cpe":       item.get("cpe", []),
            "banner":    (item.get("data") or "")[:500],
            "timestamp": item.get("timestamp"),
            "vulns":     list(item.get("vulns", {}).keys()),
        }
        # HTTP module
        if "http" in item:
            svc["http"] = {
                "title":  item["http"].get("title"),
                "server": item["http"].get("server"),
                "status": item["http"].get("status"),
            }
        # SSL
        if "ssl" in item:
            ssl = item["ssl"]
            cert = ssl.get("cert", {})
            svc["ssl"] = {
                "subject": cert.get("subject", {}),
                "issuer":  cert.get("issuer", {}),
                "expires": cert.get("expires"),
                "cipher":  ssl.get("cipher", {}).get("name"),
            }
        services.append(svc)

    # Collect all CVEs across all services
    all_vulns: list[dict] = []
    for svc_data in h.get("data", []):
        for cve_id, cve_info in (svc_data.get("vulns") or {}).items():
            all_vulns.append({
                "cve":     cve_id,
                "cvss":    cve_info.get("cvss"),
                "summary": cve_info.get("summary", ""),
                "port":    svc_data.get("port"),
            })

    return {
        "ip":           h.get("ip_str"),
        "org":          h.get("org"),
        "isp":          h.get("isp"),
        "asn":          h.get("asn"),
        "country":      h.get("country_name"),
        "country_code": h.get("country_code"),
        "city":         h.get("city"),
        "region":       h.get("region_code"),
        "latitude":     h.get("latitude"),
        "longitude":    h.get("longitude"),
        "os":           h.get("os"),
        "hostnames":    h.get("hostnames", []),
        "domains":      h.get("domains", []),
        "tags":         h.get("tags", []),
        "ports":        sorted(h.get("ports", [])),
        "vulns":        sorted(set(h.get("vulns", []))),
        "last_update":  h.get("last_update"),
        "services":     services,
        "all_vulns":    all_vulns,
    }


def _normalise_match(m: dict) -> dict[str, Any]:
    return {
        "ip":        m.get("ip_str"),
        "port":      m.get("port"),
        "transport": m.get("transport", "tcp"),
        "org":       m.get("org"),
        "isp":       m.get("isp"),
        "country":   m.get("location", {}).get("country_name"),
        "city":      m.get("location", {}).get("city"),
        "hostnames": m.get("hostnames", []),
        "domains":   m.get("domains", []),
        "os":        m.get("os"),
        "product":   m.get("product"),
        "version":   m.get("version"),
        "banner":    (m.get("data") or "")[:300],
        "timestamp": m.get("timestamp"),
        "vulns":     list((m.get("vulns") or {}).keys()),
        "tags":      m.get("tags", []),
    }


# Singleton
shodan_service = ShodanService()
