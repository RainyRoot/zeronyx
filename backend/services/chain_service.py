"""Chain Engine — Phase 4.5/4.6

A Chain is a sequential workflow of steps that the engine executes
one-by-one.  Each step can:

* ``scan``    — start a scan with a given tool + config
* ``wait``    — wait for a previous scan step to complete
* ``notify``  — log a message (future: Slack/webhook)

Standard chains (4.6) are defined at the bottom of this module.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from backend.models.base import new_uuid
from backend.models.chain import Chain, ChainRun
from backend.models.scan import Scan

logger = logging.getLogger("zeronyx.chain_engine")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Standard Chain Definitions (4.6)
# ---------------------------------------------------------------------------

STANDARD_CHAINS: list[dict] = [
    {
        "name": "Quick Recon",
        "description": "Fast network sweep → port scan → web directory brute-force on any HTTP ports found.",
        "trigger_on": "manual",
        "steps": [
            {
                "id": "nmap_quick",
                "type": "scan",
                "tool": "nmap",
                "label": "Quick Nmap Sweep",
                "config": {"flags": "-T4 -F --open"},
            },
            {
                "id": "gobuster_web",
                "type": "scan",
                "tool": "gobuster",
                "label": "Directory Brute-Force",
                "config": {"mode": "dir", "wordlist": "/usr/share/wordlists/dirb/common.txt"},
                "depends_on": "nmap_quick",
                "condition": "has_http_port",
            },
        ],
    },
    {
        "name": "Full Web Audit",
        "description": "Comprehensive web application audit: Nikto → Nuclei → SQLMap on forms.",
        "trigger_on": "manual",
        "steps": [
            {
                "id": "nikto_scan",
                "type": "scan",
                "tool": "nikto",
                "label": "Nikto Web Scan",
                "config": {},
            },
            {
                "id": "nuclei_scan",
                "type": "scan",
                "tool": "nuclei",
                "label": "Nuclei CVE Scan",
                "config": {"severity": "critical,high,medium"},
            },
            {
                "id": "sqlmap_scan",
                "type": "scan",
                "tool": "sqlmap",
                "label": "SQLMap Injection Test",
                "config": {"level": 1, "risk": 1},
                "depends_on": "nikto_scan",
            },
        ],
    },
    {
        "name": "Network Sweep",
        "description": "Full network enumeration: Nmap all ports → SearchSploit auto-lookup → Shodan enrichment.",
        "trigger_on": "manual",
        "steps": [
            {
                "id": "nmap_full",
                "type": "scan",
                "tool": "nmap",
                "label": "Full Port Scan",
                "config": {"flags": "-p- -T4 -sV"},
            },
            {
                "id": "searchsploit_lookup",
                "type": "scan",
                "tool": "searchsploit",
                "label": "Exploit Lookup",
                "depends_on": "nmap_full",
                "config": {},
            },
        ],
    },
    {
        "name": "Credential Attack",
        "description": "SSH + FTP brute-force with Hydra on discovered hosts.",
        "trigger_on": "manual",
        "steps": [
            {
                "id": "hydra_ssh",
                "type": "scan",
                "tool": "hydra",
                "label": "Hydra SSH Brute-Force",
                "config": {"service": "ssh"},
            },
            {
                "id": "hydra_ftp",
                "type": "scan",
                "tool": "hydra",
                "label": "Hydra FTP Brute-Force",
                "config": {"service": "ftp"},
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Chain Runner
# ---------------------------------------------------------------------------

class ChainEngine:
    """Executes a chain run step-by-step."""

    def __init__(self, db: Session) -> None:
        self.db = db

    async def run(
        self,
        chain_id: str,
        project_id: str,
        target_id: str | None,
        run_id: str | None = None,
    ) -> str:
        """Execute chain, return the ChainRun ID."""
        chain = self.db.get(Chain, chain_id)
        if not chain:
            raise ValueError(f"Chain {chain_id} not found")
        if not chain.enabled:
            raise ValueError("Chain is disabled")

        run_id = run_id or new_uuid()
        steps: list[dict] = json.loads(chain.steps or "[]")

        # Create run record
        run = ChainRun(
            id=run_id,
            chain_id=chain_id,
            project_id=project_id,
            status="running",
            step_results="{}",
            started_at=_now_iso(),
        )
        self.db.add(run)
        chain.last_run = _now_iso()
        chain.last_status = "running"
        self.db.commit()

        # Execute steps sequentially
        step_results: dict[str, Any] = {}
        try:
            for step in steps:
                step_id = step.get("id", new_uuid())
                step_type = step.get("type", "scan")

                logger.info("Chain %s — executing step %s (%s)", chain_id, step_id, step_type)
                result = await self._execute_step(step, project_id, target_id, step_results)
                step_results[step_id] = result

                # Persist progress
                run.step_results = json.dumps(step_results)
                self.db.commit()

                if result.get("status") == "failed" and not step.get("continue_on_error"):
                    raise RuntimeError(f"Step {step_id} failed: {result.get('error')}")

            run.status = "completed"
            chain.last_status = "success"
        except Exception as exc:
            run.status = "failed"
            run.error = str(exc)
            chain.last_status = "failed"
            logger.error("Chain %s run %s failed: %s", chain_id, run_id, exc)
        finally:
            run.finished_at = _now_iso()
            self.db.commit()

        return run_id

    async def _execute_step(
        self,
        step: dict,
        project_id: str,
        target_id: str | None,
        previous_results: dict[str, Any],
    ) -> dict[str, Any]:
        step_type = step.get("type", "scan")

        if step_type == "scan":
            return await self._run_scan_step(step, project_id, target_id)
        elif step_type == "notify":
            msg = step.get("message", "Chain step completed")
            logger.info("Chain notify: %s", msg)
            return {"status": "completed", "message": msg}
        else:
            return {"status": "skipped", "reason": f"Unknown step type: {step_type}"}

    async def _run_scan_step(
        self,
        step: dict,
        project_id: str,
        target_id: str | None,
    ) -> dict[str, Any]:
        from backend.services.scan_service import ScanService

        tool = step.get("tool", "nmap")
        config = dict(step.get("config", {}))

        # Create scan record
        scan = Scan(
            id=new_uuid(),
            project_id=project_id,
            target_id=target_id,
            tool=tool,
            profile=step.get("label"),
            config=json.dumps(config),
            status="pending",
        )
        self.db.add(scan)
        self.db.commit()

        try:
            service = ScanService(self.db)
            await service.run(scan.id, tool, config)
            return {"status": "completed", "scan_id": scan.id}
        except Exception as exc:
            return {"status": "failed", "scan_id": scan.id, "error": str(exc)}
