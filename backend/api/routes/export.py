"""Obsidian Vault Export — Task 2.9.

Endpoint
--------
GET /api/projects/{project_id}/export/obsidian
  Returns a JSON manifest:
    { "project_name": str, "files": { "<vault-relative-path>": "<markdown-content>" } }

Vault layout
------------
  Index.md                       — project overview + stats
  Targets/<value>.md             — one note per target
  Scans/<short-id> <tool>.md     — one note per scan
  Findings/<severity>/<title>.md — one note per finding
"""
from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.models.finding import Finding
from backend.models.project import Project
from backend.models.scan import Scan, ScanResult
from backend.models.target import Target

router = APIRouter(prefix="/projects", tags=["export"])


# ---------------------------------------------------------------------------
# Response schema
# ---------------------------------------------------------------------------

class ObsidianExportResponse(BaseModel):
    project_name: str
    file_count: int
    files: dict[str, str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_UNSAFE_RE = re.compile(r'[\\/:*?"<>|]')


def _safe_name(value: str, max_len: int = 60) -> str:
    """Sanitise a string for use as a file / folder name."""
    cleaned = _UNSAFE_RE.sub("_", value).strip()
    return cleaned[:max_len] if cleaned else "unnamed"


def _short_id(id_: str) -> str:
    return id_[:8]


_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
_SEVERITY_EMOJI = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🔵",
    "info": "⚪",
}


def _fmt_dt(dt: Any) -> str:
    if dt is None:
        return "—"
    return str(dt)[:19].replace("T", " ")


def _parse_json(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Note builders
# ---------------------------------------------------------------------------

def _build_index(project: Project, targets: list, scans: list, findings: list) -> str:
    status_counts: dict[str, int] = {}
    for s in scans:
        status_counts[s.status] = status_counts.get(s.status, 0) + 1

    sev_counts: dict[str, int] = {}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1

    lines = [
        f"# {project.name}",
        "",
        f"> **Status:** {project.status}  ",
        f"> **Created:** {_fmt_dt(project.created_at)}",
        "",
    ]

    if project.description:
        lines += [f"{project.description}", ""]

    if project.scope:
        lines += ["## Scope", "", f"```\n{project.scope}\n```", ""]

    # Stats
    lines += [
        "## Stats",
        "",
        f"| Metric | Value |",
        f"|---|---|",
        f"| Targets | {len(targets)} |",
        f"| Scans | {len(scans)} |",
        f"| Findings | {len(findings)} |",
    ]
    for sev in ("critical", "high", "medium", "low", "info"):
        if sev in sev_counts:
            emoji = _SEVERITY_EMOJI.get(sev, "")
            lines.append(f"| {emoji} {sev.capitalize()} | {sev_counts[sev]} |")
    lines.append("")

    # Targets
    if targets:
        lines += ["## Targets", ""]
        for t in targets:
            safe = _safe_name(t.value)
            lines.append(f"- [[Targets/{safe}]]")
        lines.append("")

    # Scans
    if scans:
        lines += ["## Scans", ""]
        for s in sorted(scans, key=lambda x: x.created_at, reverse=True):
            tool_upper = s.tool.upper()
            note_name = f"{_short_id(s.id)} {tool_upper}"
            lines.append(f"- [[Scans/{note_name}]] — {s.status}")
        lines.append("")

    # Findings
    if findings:
        lines += ["## Findings", ""]
        sorted_findings = sorted(findings, key=lambda f: _SEVERITY_ORDER.get(f.severity, 99))
        for f in sorted_findings:
            sev_path = f.severity.capitalize()
            note_name = _safe_name(f.title)
            emoji = _SEVERITY_EMOJI.get(f.severity, "")
            lines.append(f"- {emoji} [[Findings/{sev_path}/{note_name}]]")
        lines.append("")

    return "\n".join(lines)


def _build_target_note(target: Target, scans: list) -> str:
    related = [s for s in scans if s.target_id == target.id]
    tags_parsed = _parse_json(target.tags) or []
    tags_str = ", ".join(tags_parsed) if tags_parsed else "—"

    lines = [
        f"# {target.value}",
        "",
        f"| Field | Value |",
        f"|---|---|",
        f"| Type | {target.type} |",
        f"| Tags | {tags_str} |",
        f"| Added | {_fmt_dt(target.created_at)} |",
        "",
    ]

    if target.notes:
        lines += ["## Notes", "", target.notes, ""]

    if related:
        lines += ["## Scans", ""]
        for s in sorted(related, key=lambda x: x.created_at, reverse=True):
            tool_upper = s.tool.upper()
            note_name = f"{_short_id(s.id)} {tool_upper}"
            lines.append(f"- [[Scans/{note_name}]] — {s.status}")
        lines.append("")

    return "\n".join(lines)


def _build_scan_note(scan: Scan, result: ScanResult | None, findings: list) -> str:
    config = _parse_json(scan.config) or {}
    tool_upper = scan.tool.upper()

    duration = "—"
    if scan.started_at and scan.finished_at:
        try:
            from datetime import datetime
            s = datetime.fromisoformat(str(scan.started_at))
            e = datetime.fromisoformat(str(scan.finished_at))
            secs = int((e - s).total_seconds())
            duration = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
        except Exception:
            pass

    lines = [
        f"# {tool_upper} — {_short_id(scan.id)}",
        "",
        f"| Field | Value |",
        f"|---|---|",
        f"| Tool | {scan.tool} |",
        f"| Status | {scan.status} |",
        f"| Profile | {scan.profile or '—'} |",
        f"| Duration | {duration} |",
        f"| Started | {_fmt_dt(scan.started_at)} |",
        f"| Finished | {_fmt_dt(scan.finished_at)} |",
        "",
    ]

    # Target link
    if scan.target_id:
        # We don't have the target value here easily without extra query;
        # just reference by ID for now — the parent caller can resolve this
        pass

    # Config summary
    if config:
        lines += ["## Config", "", "```json"]
        lines.append(json.dumps(config, indent=2))
        lines += ["```", ""]

    # Findings
    if findings:
        lines += ["## Findings", ""]
        sorted_f = sorted(findings, key=lambda f: _SEVERITY_ORDER.get(f.severity, 99))
        for f in sorted_f:
            sev_path = f.severity.capitalize()
            note_name = _safe_name(f.title)
            emoji = _SEVERITY_EMOJI.get(f.severity, "")
            lines.append(f"- {emoji} [[Findings/{sev_path}/{note_name}]]")
        lines.append("")

    # Raw output (truncated to avoid huge files)
    if result and result.raw_output:
        raw = result.raw_output
        MAX_RAW = 8000
        truncated = len(raw) > MAX_RAW
        snippet = raw[:MAX_RAW]
        lines += ["## Raw Output", "", "```"]
        lines.append(snippet)
        if truncated:
            lines.append(f"\n... (truncated — {len(raw)} total chars)")
        lines += ["```", ""]

    # Error
    if scan.error:
        lines += ["## Error", "", f"```\n{scan.error}\n```", ""]

    return "\n".join(lines)


def _build_finding_note(finding: Finding) -> str:
    emoji = _SEVERITY_EMOJI.get(finding.severity, "")

    lines = [
        f"# {finding.title}",
        "",
        f"| Field | Value |",
        f"|---|---|",
        f"| Severity | {emoji} {finding.severity.capitalize()} |",
        f"| Status | {finding.status} |",
        f"| Tool | {finding.tool_source or '—'} |",
    ]

    if finding.cve:
        lines.append(f"| CVE | {finding.cve} |")
    if finding.cvss is not None:
        lines.append(f"| CVSS | {finding.cvss:.1f} |")

    lines += ["", ""]

    if finding.description:
        lines += ["## Description", "", finding.description, ""]

    if finding.remediation:
        lines += ["## Remediation", "", finding.remediation, ""]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/{project_id}/export/obsidian", response_model=ObsidianExportResponse)
def export_obsidian(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    targets: list[Target] = db.query(Target).filter(Target.project_id == project_id).all()
    scans: list[Scan] = (
        db.query(Scan)
        .filter(Scan.project_id == project_id)
        .order_by(Scan.created_at.desc())
        .all()
    )
    scan_ids = [s.id for s in scans]
    results: dict[str, ScanResult] = {}
    if scan_ids:
        for r in db.query(ScanResult).filter(ScanResult.scan_id.in_(scan_ids)).all():
            results[r.scan_id] = r

    findings: list[Finding] = (
        db.query(Finding)
        .filter(Finding.project_id == project_id)
        .all()
    )

    files: dict[str, str] = {}

    # Index
    files["Index.md"] = _build_index(project, targets, scans, findings)

    # Targets
    for t in targets:
        safe = _safe_name(t.value)
        files[f"Targets/{safe}.md"] = _build_target_note(t, scans)

    # Scans
    for s in scans:
        tool_upper = s.tool.upper()
        note_name = f"{_short_id(s.id)} {tool_upper}"
        scan_findings = [f for f in findings if f.scan_id == s.id]
        files[f"Scans/{note_name}.md"] = _build_scan_note(s, results.get(s.id), scan_findings)

    # Findings
    for f in findings:
        sev_path = f.severity.capitalize()
        note_name = _safe_name(f.title)
        files[f"Findings/{sev_path}/{note_name}.md"] = _build_finding_note(f)

    return ObsidianExportResponse(
        project_name=project.name,
        file_count=len(files),
        files=files,
    )
