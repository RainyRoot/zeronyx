"""Scan Service
=============
Bridges the tool adapter lifecycle with the database and WebSocket layer.

Usage (from a FastAPI background task)::

    from backend.services.scan_service import ScanService

    service = ScanService(db_session)
    await service.run(scan_id="...", tool="nmap", config={...})
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.adapters import get_adapter, AdapterError, ToolNotInstalledError, ToolResult
from backend.api.websocket.connection_manager import manager as ws_manager
from backend.models.base import new_uuid
from backend.models.credential import Credential
from backend.models.finding import Finding
from backend.models.host import Host
from backend.models.port import Port
from backend.models.scan import Scan, ScanResult

logger = logging.getLogger("zeronyx.scan_service")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


class ScanService:
    """Orchestrates a single scan from start to finish."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(self, scan_id: str, tool: str, config: dict) -> None:
        """Execute a scan, streaming output to WebSocket and persisting results.

        Steps:
        1. Mark scan as ``running`` in DB.
        2. Get the adapter for ``tool``.
        3. Async-iterate adapter.run(config):
           - str  → broadcast ``output`` WS message
           - ToolResult → persist to DB, broadcast ``done``
        4. On error → mark scan as ``failed``, broadcast ``error``.
        5. On cancel → mark scan as ``cancelled``, broadcast ``done``.
        """
        scan = self.db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            logger.error("ScanService: scan %s not found", scan_id)
            return

        await self._mark_running(scan)

        try:
            adapter = get_adapter(tool)
        except KeyError as e:
            await self._fail(scan, str(e))
            return

        try:
            async for event in adapter.run(config):
                if isinstance(event, str):
                    await ws_manager.broadcast(scan_id, {
                        "type": "output",
                        "scan_id": scan_id,
                        "line": event,
                        "timestamp": _now_iso(),
                    })
                elif isinstance(event, ToolResult):
                    await self._persist_result(scan, event)
                    await ws_manager.broadcast(scan_id, {
                        "type": "done",
                        "scan_id": scan_id,
                        "timestamp": _now_iso(),
                    })

        except asyncio.CancelledError:
            await self._cancel(scan)

        except ToolNotInstalledError as e:
            await self._fail(scan, str(e))
            await ws_manager.broadcast(scan_id, {
                "type": "error",
                "scan_id": scan_id,
                "message": str(e),
                "timestamp": _now_iso(),
            })

        except AdapterError as e:
            await self._fail(scan, str(e))
            await ws_manager.broadcast(scan_id, {
                "type": "error",
                "scan_id": scan_id,
                "message": str(e),
                "timestamp": _now_iso(),
            })

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    async def _mark_running(self, scan: Scan) -> None:
        scan.status = "running"
        scan.started_at = _now()
        self.db.commit()

    async def _fail(self, scan: Scan, error: str) -> None:
        scan.status = "failed"
        scan.finished_at = _now()
        scan.error = error
        self.db.commit()
        logger.error("[scan:%s] Failed: %s", scan.id, error)

    async def _cancel(self, scan: Scan) -> None:
        scan.status = "cancelled"
        scan.finished_at = _now()
        self.db.commit()
        await ws_manager.broadcast(scan.id, {
            "type": "done",
            "scan_id": scan.id,
            "timestamp": _now_iso(),
        })
        logger.info("[scan:%s] Cancelled", scan.id)

    async def _persist_result(self, scan: Scan, result: ToolResult) -> None:
        """Write ToolResult into scan_results, hosts, ports, and findings."""
        # ScanResult (raw + parsed output)
        scan_result = ScanResult(
            id=new_uuid(),
            scan_id=scan.id,
            raw_output=result.raw_output,
            parsed=json.dumps(result.parsed) if result.parsed else None,
            format="text",
        )
        self.db.add(scan_result)

        # Hosts
        host_id_map: dict[str, str] = {}
        for h in result.hosts:
            host = self._upsert_host(scan.project_id, h)
            host_id_map[h.get("ip", "")] = host.id

        # Ports
        port_id_map: dict[tuple[str, int, str], str] = {}
        for p in result.ports:
            host_db_id = host_id_map.get(p.get("host_ip", ""))
            if not host_db_id:
                continue
            port = self._upsert_port(host_db_id, scan.id, p)
            key = (p.get("host_ip", ""), p.get("number", 0), p.get("protocol", "tcp"))
            port_id_map[key] = port.id

        # Findings
        for f in result.findings:
            finding = Finding(
                id=new_uuid(),
                project_id=scan.project_id,
                scan_id=scan.id,
                host_id=host_id_map.get(f.get("host_ip", "")),
                title=f.get("title", "Unnamed Finding"),
                severity=f.get("severity", "info"),
                cvss=f.get("cvss"),
                cve=f.get("cve"),
                description=f.get("description"),
                remediation=f.get("remediation"),
                tool_source=scan.tool,
                status="open",
            )
            self.db.add(finding)

        # Credentials
        for c in result.credentials:
            cred = Credential(
                id=new_uuid(),
                project_id=scan.project_id,
                source_scan=scan.id,
                service=c.get("service"),
                username=c.get("username"),
                password=c.get("password"),
                verified=True,
            )
            self.db.add(cred)

        scan.status = "completed"
        scan.finished_at = _now()
        self.db.commit()

        logger.info(
            "[scan:%s] Persisted — %d hosts, %d ports, %d findings, %d credentials",
            scan.id, len(result.hosts), len(result.ports), len(result.findings), len(result.credentials),
        )

        # Obsidian auto-sync hook (4.8)
        try:
            from backend.api.routes.app_settings import _load_user_settings
            user_settings = _load_user_settings()
            vault_path = user_settings.get("obsidian_vault_path", "")
            if user_settings.get("obsidian_auto_sync") and vault_path:
                from backend.services.obsidian_sync_service import ObsidianSyncService
                ObsidianSyncService(vault_path).sync_scan(scan.id, self.db)
                logger.info("[scan:%s] Obsidian auto-sync complete", scan.id)
        except Exception as exc:
            logger.warning("[scan:%s] Obsidian auto-sync skipped: %s", scan.id, exc)

    def _upsert_host(self, project_id: str, data: dict) -> Host:
        ip = data.get("ip", "")
        host = (
            self.db.query(Host)
            .filter(Host.project_id == project_id, Host.ip == ip)
            .first()
        )
        if host:
            host.hostname = data.get("hostname") or host.hostname
            host.os = data.get("os") or host.os
            host.os_accuracy = data.get("os_accuracy") or host.os_accuracy
            host.mac = data.get("mac") or host.mac
            host.vendor = data.get("vendor") or host.vendor
            host.state = data.get("state", host.state)
            host.last_seen = _now()
        else:
            host = Host(
                id=new_uuid(),
                project_id=project_id,
                ip=ip,
                hostname=data.get("hostname"),
                os=data.get("os"),
                os_accuracy=data.get("os_accuracy"),
                mac=data.get("mac"),
                vendor=data.get("vendor"),
                state=data.get("state", "up"),
                last_seen=_now(),
            )
            self.db.add(host)
            self.db.flush()
        return host

    def _upsert_port(self, host_id: str, scan_id: str, data: dict) -> Port:
        number = int(data.get("number", 0))
        protocol = data.get("protocol", "tcp")
        port = (
            self.db.query(Port)
            .filter(Port.host_id == host_id, Port.number == number, Port.protocol == protocol)
            .first()
        )
        if port:
            port.state = data.get("state", port.state)
            port.service = data.get("service") or port.service
            port.version = data.get("version") or port.version
            port.banner = data.get("banner") or port.banner
            port.scan_id = scan_id
        else:
            port = Port(
                id=new_uuid(),
                host_id=host_id,
                scan_id=scan_id,
                number=number,
                protocol=protocol,
                state=data.get("state", "open"),
                service=data.get("service"),
                version=data.get("version"),
                banner=data.get("banner"),
            )
            self.db.add(port)
            self.db.flush()
        return port
