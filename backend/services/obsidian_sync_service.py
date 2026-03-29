"""Obsidian Auto-Sync Service — Phase 4.8

Writes project data as Markdown files directly into a local Obsidian vault.

Triggered after scans complete (via ScanService hook) and on demand via the
``POST /projects/{id}/export/obsidian/sync-to-disk`` endpoint.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger("zeronyx.obsidian_sync")

_UNSAFE_RE = re.compile(r'[\\/:*?"<>|]')


def _safe_name(value: str, max_len: int = 60) -> str:
    cleaned = _UNSAFE_RE.sub("_", value).strip()
    return cleaned[:max_len] if cleaned else "unnamed"


def _short_id(id_: str) -> str:
    return id_[:8]


def _fmt_dt(dt: Any) -> str:
    if dt is None:
        return "—"
    return str(dt)[:19].replace("T", " ")


_SEVERITY_EMOJI = {
    "critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🔵", "info": "⚪",
}
_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


class ObsidianSyncService:
    """Writes project data into an Obsidian vault directory."""

    def __init__(self, vault_path: str | Path) -> None:
        self.vault = Path(vault_path)

    def _write(self, relative_path: str, content: str) -> None:
        """Write a file to the vault, creating parent dirs as needed."""
        target = self.vault / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        logger.debug("Obsidian sync — wrote %s", relative_path)

    def sync_project(self, project_id: str, db: Session) -> dict[str, int]:
        """Full sync: write all notes for the project.

        Returns a dict with counts: ``{"written": N, "errors": M}``.
        """
        from backend.models.finding import Finding
        from backend.models.project import Project
        from backend.models.scan import Scan, ScanResult
        from backend.models.target import Target

        project = db.get(Project, project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        targets  = db.query(Target).filter(Target.project_id == project_id).all()
        scans    = db.query(Scan).filter(Scan.project_id == project_id).all()
        findings = db.query(Finding).filter(Finding.project_id == project_id).all()

        # Results lookup
        results_map: dict[str, ScanResult] = {}
        for scan in scans:
            result = db.query(ScanResult).filter(ScanResult.scan_id == scan.id).first()
            if result:
                results_map[scan.id] = result

        findings_by_scan: dict[str, list] = {}
        for f in findings:
            if f.scan_id:
                findings_by_scan.setdefault(f.scan_id, []).append(f)

        written = 0
        errors  = 0
        project_dir = _safe_name(project.name)

        # Index
        try:
            self._write(f"{project_dir}/Index.md", self._build_index(project, targets, scans, findings))
            written += 1
        except Exception as exc:
            logger.error("Obsidian sync index error: %s", exc)
            errors += 1

        # Targets
        for t in targets:
            try:
                note = self._build_target_note(t, scans)
                self._write(f"{project_dir}/Targets/{_safe_name(t.value)}.md", note)
                written += 1
            except Exception as exc:
                logger.error("Obsidian sync target %s error: %s", t.id, exc)
                errors += 1

        # Scans
        for s in scans:
            try:
                result = results_map.get(s.id)
                scan_findings = findings_by_scan.get(s.id, [])
                note = self._build_scan_note(s, result, scan_findings)
                tool_upper = s.tool.upper()
                fname = f"{_short_id(s.id)} {tool_upper}"
                self._write(f"{project_dir}/Scans/{_safe_name(fname)}.md", note)
                written += 1
            except Exception as exc:
                logger.error("Obsidian sync scan %s error: %s", s.id, exc)
                errors += 1

        # Findings
        for f in findings:
            try:
                note = self._build_finding_note(f)
                sev_dir = f.severity.capitalize()
                fname = _safe_name(f.title)
                self._write(f"{project_dir}/Findings/{sev_dir}/{fname}.md", note)
                written += 1
            except Exception as exc:
                logger.error("Obsidian sync finding %s error: %s", f.id, exc)
                errors += 1

        logger.info(
            "Obsidian sync complete for project %s — %d written, %d errors",
            project_id, written, errors,
        )
        return {"written": written, "errors": errors}

    def sync_scan(self, scan_id: str, db: Session) -> bool:
        """Write / update a single scan note and refresh the index."""
        from backend.models.finding import Finding
        from backend.models.project import Project
        from backend.models.scan import Scan, ScanResult

        scan = db.get(Scan, scan_id)
        if not scan:
            return False

        project = db.get(Project, scan.project_id)
        project_dir = _safe_name(project.name) if project else scan.project_id

        result   = db.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()
        findings = db.query(Finding).filter(Finding.scan_id == scan_id).all()

        note = self._build_scan_note(scan, result, findings)
        tool_upper = scan.tool.upper()
        fname = f"{_short_id(scan.id)} {tool_upper}"
        try:
            self._write(f"{project_dir}/Scans/{_safe_name(fname)}.md", note)
            return True
        except Exception as exc:
            logger.error("Obsidian sync scan %s failed: %s", scan_id, exc)
            return False

    # ------------------------------------------------------------------
    # Note builders (reuse export.py logic but local)
    # ------------------------------------------------------------------

    def _build_index(self, project: Any, targets: list, scans: list, findings: list) -> str:
        sev_counts: dict[str, int] = {}
        for f in findings:
            sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1

        lines = [
            f"# {project.name}",
            "",
            f"> **Status:** {project.status}  ",
            f"> **Synced:** auto-synced by ZeroNyx",
            "",
        ]
        if project.description:
            lines += [project.description, ""]
        lines += [
            "## Stats",
            "",
            "| Metric | Value |",
            "|---|---|",
            f"| Targets | {len(targets)} |",
            f"| Scans | {len(scans)} |",
            f"| Findings | {len(findings)} |",
        ]
        for sev in ("critical", "high", "medium", "low", "info"):
            if sev in sev_counts:
                lines.append(f"| {_SEVERITY_EMOJI[sev]} {sev.capitalize()} | {sev_counts[sev]} |")
        lines.append("")
        if targets:
            lines += ["## Targets", ""]
            for t in targets:
                lines.append(f"- [[Targets/{_safe_name(t.value)}]]")
            lines.append("")
        if scans:
            lines += ["## Scans", ""]
            for s in sorted(scans, key=lambda x: x.created_at, reverse=True):
                fname = f"{_short_id(s.id)} {s.tool.upper()}"
                lines.append(f"- [[Scans/{_safe_name(fname)}]] — {s.status}")
            lines.append("")
        if findings:
            lines += ["## Findings", ""]
            for f in sorted(findings, key=lambda x: _SEVERITY_ORDER.get(x.severity, 99)):
                fname = _safe_name(f.title)
                sev_dir = f.severity.capitalize()
                lines.append(f"- {_SEVERITY_EMOJI.get(f.severity,'')} [[Findings/{sev_dir}/{fname}]]")
            lines.append("")
        return "\n".join(lines)

    def _build_target_note(self, target: Any, scans: list) -> str:
        related = [s for s in scans if s.target_id == target.id]
        lines = [
            f"# {target.value}",
            "",
            f"| Field | Value |",
            "|---|---|",
            f"| Type | {target.type} |",
            f"| Added | {_fmt_dt(target.created_at)} |",
            "",
        ]
        if target.notes:
            lines += ["## Notes", "", target.notes, ""]
        if related:
            lines += ["## Scans", ""]
            for s in sorted(related, key=lambda x: x.created_at, reverse=True):
                fname = f"{_short_id(s.id)} {s.tool.upper()}"
                lines.append(f"- [[Scans/{_safe_name(fname)}]] — {s.status}")
            lines.append("")
        return "\n".join(lines)

    def _build_scan_note(self, scan: Any, result: Any, findings: list) -> str:
        lines = [
            f"# {scan.tool.upper()} — {_short_id(scan.id)}",
            "",
            "| Field | Value |",
            "|---|---|",
            f"| Tool | {scan.tool} |",
            f"| Status | {scan.status} |",
            f"| Started | {_fmt_dt(scan.started_at)} |",
            f"| Finished | {_fmt_dt(scan.finished_at)} |",
            "",
        ]
        if findings:
            lines += ["## Findings", ""]
            for f in sorted(findings, key=lambda x: _SEVERITY_ORDER.get(x.severity, 99)):
                sev_dir = f.severity.capitalize()
                fname = _safe_name(f.title)
                lines.append(f"- {_SEVERITY_EMOJI.get(f.severity,'')} [[Findings/{sev_dir}/{fname}]] — {f.severity.upper()}")
            lines.append("")
        return "\n".join(lines)

    def _build_finding_note(self, finding: Any) -> str:
        lines = [
            f"# {finding.title}",
            "",
            "| Field | Value |",
            "|---|---|",
            f"| Severity | {finding.severity.upper()} |",
            f"| Status | {finding.status} |",
            f"| Tool | {finding.tool_source or '—'} |",
            f"| CVE | {finding.cve or '—'} |",
            "",
        ]
        if finding.description:
            lines += ["## Description", "", finding.description, ""]
        if finding.remediation:
            lines += ["## Remediation", "", finding.remediation, ""]
        return "\n".join(lines)
