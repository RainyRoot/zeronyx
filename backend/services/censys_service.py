"""Censys passive recon service — Task 3.8.

Wraps the censys Python SDK (sync) behind async helpers via run_in_executor.
API credentials (id + secret) are persisted in ~/.zeronyx/api_keys.json,
the same file used by ShodanService.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from backend.services.shodan_service import _load_keys, _save_keys  # shared key store

logger = logging.getLogger("zeronyx.censys")


class CensysService:
    """Singleton service for Censys v2 API interactions."""

    def __init__(self) -> None:
        self._hosts: Any = None   # censys.search.CensysHosts
        self._api_id: str | None = None
        self._api_secret: str | None = None
        self._account: dict | None = None

    # ------------------------------------------------------------------
    # Key management
    # ------------------------------------------------------------------

    def load_saved_credentials(self) -> tuple[str, str] | None:
        """Return (api_id, api_secret) from saved keys or None."""
        keys = _load_keys()
        cid = keys.get("censys_id")
        secret = keys.get("censys_secret")
        if cid and secret:
            return cid, secret
        return None

    def save_credentials(self, api_id: str, api_secret: str) -> None:
        keys = _load_keys()
        keys["censys_id"] = api_id
        keys["censys_secret"] = api_secret
        _save_keys(keys)
        self._api_id = api_id
        self._api_secret = api_secret

    def remove_credentials(self) -> None:
        keys = _load_keys()
        keys.pop("censys_id", None)
        keys.pop("censys_secret", None)
        _save_keys(keys)
        self._api_id = None
        self._api_secret = None
        self._hosts = None
        self._account = None

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    async def connect(self, api_id: str, api_secret: str) -> dict[str, Any]:
        """Initialise client and validate by fetching account info."""
        from censys.search import CensysHosts
        from censys.common.exceptions import CensysUnauthorizedException

        loop = asyncio.get_running_loop()

        def _test():
            h = CensysHosts(api_id=api_id, api_secret=api_secret)
            # Trigger a minimal request to validate credentials
            account = h.account()
            return h, account

        try:
            hosts, account = await loop.run_in_executor(None, _test)
        except Exception as exc:
            msg = str(exc)
            if "403" in msg or "401" in msg or "Unauthorized" in msg or "Forbidden" in msg:
                raise PermissionError("Invalid Censys credentials")
            raise

        self._hosts    = hosts
        self._api_id   = api_id
        self._api_secret = api_secret
        self._account  = account
        self.save_credentials(api_id, api_secret)
        logger.info("Censys connected — email: %s", account.get("email"))
        return account

    async def auto_connect(self) -> bool:
        """Connect using saved credentials. Returns True on success."""
        creds = self.load_saved_credentials()
        if not creds:
            return False
        try:
            await self.connect(*creds)
            return True
        except Exception as e:
            logger.debug("Censys auto-connect failed: %s", e)
            return False

    def disconnect(self) -> None:
        self._hosts = None
        self._account = None

    def is_connected(self) -> bool:
        return self._hosts is not None

    def get_status(self) -> dict[str, Any]:
        creds = self.load_saved_credentials()
        return {
            "connected":   self.is_connected(),
            "has_credentials": bool(creds),
            "email":       self._account.get("email") if self._account else None,
            "quota":       self._account.get("quota") if self._account else None,
        }

    # ------------------------------------------------------------------
    # API helpers
    # ------------------------------------------------------------------

    def _require_api(self) -> None:
        if self._hosts is None:
            raise RuntimeError("Not connected to Censys. Save credentials and connect first.")

    async def view_host(self, ip: str) -> dict[str, Any]:
        """Retrieve full host record for an IP."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            return self._hosts.view(ip)

        host = await loop.run_in_executor(None, _fetch)
        return _normalise_host(host)

    async def search_hosts(
        self,
        query: str,
        per_page: int = 100,
        pages: int = 1,
    ) -> dict[str, Any]:
        """Search hosts — returns up to pages * per_page results."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            results = self._hosts.search(
                query,
                per_page=min(per_page, 100),
                pages=pages,
            )
            matches = []
            for page in results:
                for host in page:
                    matches.append(_normalise_match(host))
            return matches

        matches = await loop.run_in_executor(None, _fetch)
        return {"total": len(matches), "matches": matches}

    async def aggregate(self, query: str, field: str, num_buckets: int = 50) -> dict[str, Any]:
        """Aggregate results by field — free, no quota consumed."""
        self._require_api()
        loop = asyncio.get_running_loop()

        def _fetch():
            return self._hosts.aggregate(query, field, num_buckets=num_buckets)

        result = await loop.run_in_executor(None, _fetch)
        return {
            "total":   result.get("total", 0),
            "buckets": result.get("buckets", []),
            "field":   field,
        }


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise_host(h: dict) -> dict[str, Any]:
    services = []
    for svc in h.get("services", []):
        entry: dict[str, Any] = {
            "port":      svc.get("port"),
            "protocol":  svc.get("transport_protocol", "TCP"),
            "service":   svc.get("service_name", ""),
            "banner":    (svc.get("banner") or "")[:500],
            "timestamp": svc.get("observed_at"),
            "software":  [],
            "labels":    svc.get("labels", []),
        }
        # Software / version info
        for sw in svc.get("software", []):
            entry["software"].append({
                "product": sw.get("product") or sw.get("uniform_resource_identifier"),
                "version": sw.get("version"),
                "vendor":  sw.get("vendor"),
            })
        # HTTP
        if "http" in svc:
            http = svc["http"]
            resp = http.get("response", {})
            entry["http"] = {
                "status":  resp.get("status_code"),
                "title":   (resp.get("html_title") or resp.get("body", ""))[:120],
                "headers": dict(list((resp.get("headers") or {}).items())[:10]),
            }
        # TLS
        if "tls" in svc:
            tls = svc["tls"]
            cert = tls.get("certificates", {}).get("leaf_data", {})
            entry["tls"] = {
                "subject_dn": cert.get("subject_dn"),
                "issuer_dn":  cert.get("issuer_dn"),
                "expires":    cert.get("validity", {}).get("end"),
                "cipher":     tls.get("cipher_selected"),
                "version":    tls.get("version_selected"),
            }
        services.append(entry)

    loc = h.get("location", {})
    coords = loc.get("coordinates", {})
    asn = h.get("autonomous_system", {})
    os_info = h.get("operating_system", {})
    labels = h.get("labels", [])

    return {
        "ip":            h.get("ip"),
        "services":      services,
        "ports":         sorted({s["port"] for s in services if s["port"]}),
        "country":       loc.get("country"),
        "country_code":  loc.get("country_code"),
        "city":          loc.get("city"),
        "continent":     loc.get("continent"),
        "latitude":      coords.get("latitude"),
        "longitude":     coords.get("longitude"),
        "asn":           asn.get("asn"),
        "asn_name":      asn.get("name"),
        "bgp_prefix":    asn.get("bgp_prefix"),
        "description":   asn.get("description"),
        "os":            os_info.get("product") if os_info else None,
        "os_version":    os_info.get("version") if os_info else None,
        "labels":        labels,
        "last_updated":  h.get("last_updated_at"),
    }


def _normalise_match(m: dict) -> dict[str, Any]:
    """Compact host from search results page."""
    loc = m.get("location", {}) or {}
    services = m.get("services", []) or []
    return {
        "ip":      m.get("ip"),
        "country": loc.get("country_name") or loc.get("country"),
        "city":    loc.get("city"),
        "ports":   sorted({s.get("port") for s in services if s.get("port")}),
        "services": [
            f"{s.get('port')}/{s.get('service_name', '?')}"
            for s in services[:8]
        ],
        "labels":  m.get("labels", []),
        "last_updated": m.get("last_updated_at"),
    }


# Singleton
censys_service = CensysService()
