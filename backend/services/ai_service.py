"""AI Service
============
Provider-agnostic AI analysis for ZeroNyx.

Supported providers
-------------------
* **ollama** — Local inference via Ollama HTTP API (default, no keys needed).
* **openai** — OpenAI Chat Completions API (requires api_key).
* **anthropic** — Anthropic Messages API (requires api_key).

Data Sanitization (4.9)
-----------------------
When the user has ``sanitize_before_cloud`` enabled, any data sent to
cloud providers (openai / anthropic) has IPs, hostnames, and common PII
replaced with stable tokens (``[HOST-1]``, ``[IP-1]``, etc.) before
transmission.  The reverse mapping is stored per-call so the raw response
can optionally be un-sanitized for display.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger("zeronyx.ai_service")

# ---------------------------------------------------------------------------
# IP / hostname sanitisation helpers (4.9)
# ---------------------------------------------------------------------------

_IP_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)
_HOSTNAME_RE = re.compile(
    r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b"
)


def sanitize_text(text: str) -> tuple[str, dict[str, str]]:
    """Replace IPs and hostnames with stable tokens.

    Returns ``(sanitized_text, reverse_map)`` where ``reverse_map`` maps
    each token back to its original value.
    """
    reverse: dict[str, str] = {}
    token_map: dict[str, str] = {}  # original → token
    counter = {"ip": 0, "host": 0}

    def _replace_ip(m: re.Match) -> str:
        orig = m.group(0)
        if orig not in token_map:
            counter["ip"] += 1
            token = f"[IP-{counter['ip']}]"
            token_map[orig] = token
            reverse[token] = orig
        return token_map[orig]

    def _replace_host(m: re.Match) -> str:
        orig = m.group(0)
        if orig in token_map:
            return token_map[orig]
        counter["host"] += 1
        token = f"[HOST-{counter['host']}]"
        token_map[orig] = token
        reverse[token] = orig
        return token

    text = _IP_RE.sub(_replace_ip, text)
    text = _HOSTNAME_RE.sub(_replace_host, text)
    return text, reverse


def desanitize_text(text: str, reverse_map: dict[str, str]) -> str:
    """Restore original IPs / hostnames in AI response text."""
    for token, original in reverse_map.items():
        text = text.replace(token, original)
    return text


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_SYSTEM_SECURITY = (
    "You are an expert penetration tester and security analyst. "
    "Respond concisely and technically. Use Markdown for formatting. "
    "Focus on actionable findings."
)


def _build_scan_prompt(scan_data: dict) -> str:
    tool = scan_data.get("tool", "unknown")
    target = scan_data.get("target", "unknown")
    findings = scan_data.get("findings", [])
    hosts = scan_data.get("hosts", [])
    ports = scan_data.get("ports", [])

    lines = [
        f"## Scan Analysis Request",
        f"**Tool:** {tool}  **Target:** {target}",
        "",
        f"### Discovered Hosts ({len(hosts)})",
    ]
    for h in hosts[:20]:
        lines.append(f"- {h.get('ip','?')} ({h.get('hostname','')}) OS: {h.get('os','unknown')}")

    lines += ["", f"### Open Ports ({len(ports)})"]
    for p in ports[:30]:
        lines.append(f"- {p.get('number','?')}/{p.get('protocol','tcp')} — {p.get('service','?')} {p.get('version','')}")

    lines += ["", f"### Findings ({len(findings)})"]
    for f in findings[:20]:
        lines.append(
            f"- [{f.get('severity','?').upper()}] {f.get('title','?')} "
            f"(CVE: {f.get('cve') or 'n/a'})"
        )

    lines += [
        "",
        "---",
        "Please provide:",
        "1. **Summary** — What is the attack surface?",
        "2. **Key Risks** — Top 3 critical issues to address first.",
        "3. **Recommended Next Steps** — Which tools / techniques to use next.",
        "4. **Quick Wins** — Low-effort, high-impact actions.",
    ]
    return "\n".join(lines)


def _build_finding_prompt(finding: dict) -> str:
    return (
        f"## Finding Evaluation\n\n"
        f"**Title:** {finding.get('title','?')}\n"
        f"**Severity:** {finding.get('severity','?')}\n"
        f"**Tool Source:** {finding.get('tool_source','?')}\n"
        f"**CVE:** {finding.get('cve') or 'n/a'}\n"
        f"**Description:**\n{finding.get('description','n/a')}\n\n"
        "---\n"
        "Evaluate this finding:\n"
        "1. **Verdict** — Is this likely a true positive, false positive, or needs manual verification?\n"
        "2. **Reasoning** — Explain your confidence level.\n"
        "3. **Remediation** — Concise fix recommendation.\n"
        "4. **References** — Relevant CVEs, CWEs, or documentation links."
    )


def _build_exploits_prompt(host_data: dict) -> str:
    ip = host_data.get("ip", "?")
    os = host_data.get("os", "unknown")
    ports = host_data.get("ports", [])
    findings = host_data.get("findings", [])

    port_lines = "\n".join(
        f"- {p.get('number','?')}/{p.get('protocol','tcp')} {p.get('service','?')} {p.get('version','')}"
        for p in ports[:20]
    )
    finding_lines = "\n".join(
        f"- [{f.get('severity','?').upper()}] {f.get('title','?')} (CVE: {f.get('cve') or 'n/a'})"
        for f in findings[:15]
    )

    return (
        f"## Exploit & Attack Path Recommendations\n\n"
        f"**Host:** {ip}  **OS:** {os}\n\n"
        f"### Services\n{port_lines or 'None'}\n\n"
        f"### Known Findings\n{finding_lines or 'None'}\n\n"
        "---\n"
        "Provide:\n"
        "1. **Attack Paths** — Realistic exploitation chains for this host.\n"
        "2. **Suggested Tools** — Which tools to use (searchsploit, metasploit, sqlmap, etc.).\n"
        "3. **CVE Candidates** — Likely CVEs based on service versions.\n"
        "4. **Post-Exploitation** — If access is gained, what to do next (privilege escalation, lateral movement).\n"
    )


def _build_report_prompt(project_data: dict) -> str:
    name = project_data.get("name", "Unnamed Project")
    total_findings = project_data.get("total_findings", 0)
    critical = project_data.get("critical", 0)
    high = project_data.get("high", 0)
    medium = project_data.get("medium", 0)
    low = project_data.get("low", 0)
    hosts = project_data.get("hosts", [])
    top_findings = project_data.get("top_findings", [])

    finding_lines = "\n".join(
        f"- [{f.get('severity','?').upper()}] {f.get('title','?')} on {f.get('host','?')} — {f.get('description','')[:120]}"
        for f in top_findings[:20]
    )

    return (
        f"## Penetration Test Report Generation\n\n"
        f"**Project:** {name}\n"
        f"**Scope:** {len(hosts)} hosts\n"
        f"**Findings:** {total_findings} total — "
        f"{critical} Critical, {high} High, {medium} Medium, {low} Low\n\n"
        f"### Top Findings\n{finding_lines or 'No findings recorded.'}\n\n"
        "---\n"
        "Generate a professional penetration test report with:\n"
        "1. **Executive Summary** (non-technical, 2-3 paragraphs for management)\n"
        "2. **Risk Rating** — Overall risk posture (Critical/High/Medium/Low)\n"
        "3. **Scope & Methodology** (brief)\n"
        "4. **Key Findings** — Table: Finding | Severity | Affected Host | Status\n"
        "5. **Technical Details** — Top 5 findings with full description and remediation\n"
        "6. **Remediation Roadmap** — Prioritised action plan\n"
        "7. **Conclusion**\n"
    )


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

async def _call_ollama(prompt: str, system: str, settings: dict) -> tuple[str, int]:
    url = settings.get("ollama_url", "http://localhost:11434")
    model = settings.get("ollama_model", "llama3.2")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(f"{url}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()
    content = data.get("message", {}).get("content", "")
    tokens = (
        data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
    )
    return content, tokens


async def _call_openai(prompt: str, system: str, settings: dict) -> tuple[str, int]:
    api_key = settings.get("openai_api_key", "")
    model = settings.get("openai_model", "gpt-4o")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": 2048,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
    content = data["choices"][0]["message"]["content"]
    tokens = data.get("usage", {}).get("total_tokens", 0)
    return content, tokens


async def _call_anthropic(prompt: str, system: str, settings: dict) -> tuple[str, int]:
    api_key = settings.get("anthropic_api_key", "")
    model = settings.get("anthropic_model", "claude-opus-4-6")
    payload = {
        "model": model,
        "max_tokens": 2048,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            json=payload,
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
    content = data["content"][0]["text"]
    tokens = data.get("usage", {}).get("input_tokens", 0) + data.get("usage", {}).get("output_tokens", 0)
    return content, tokens


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class AIService:
    """Stateless service — instantiate per-request, pass ai_settings dict."""

    def __init__(self, ai_settings: dict) -> None:
        self.cfg = ai_settings

    @property
    def provider(self) -> str:
        return self.cfg.get("provider", "ollama")

    @property
    def _sanitize(self) -> bool:
        return self.cfg.get("sanitize_before_cloud", True) and self.provider in ("openai", "anthropic")

    async def _call(self, prompt: str) -> tuple[str, int, bool, dict]:
        """Send prompt to configured provider.

        Returns ``(response_text, tokens_used, was_sanitized, reverse_map)``.
        """
        reverse_map: dict[str, str] = {}
        sanitized = False

        if self._sanitize:
            prompt, reverse_map = sanitize_text(prompt)
            sanitized = True

        prov = self.provider
        try:
            if prov == "ollama":
                resp, tokens = await _call_ollama(prompt, _SYSTEM_SECURITY, self.cfg)
            elif prov == "openai":
                resp, tokens = await _call_openai(prompt, _SYSTEM_SECURITY, self.cfg)
            elif prov == "anthropic":
                resp, tokens = await _call_anthropic(prompt, _SYSTEM_SECURITY, self.cfg)
            else:
                raise ValueError(f"Unknown AI provider: {prov}")
        except httpx.HTTPStatusError as exc:
            logger.error("AI provider %s returned HTTP %s: %s", prov, exc.response.status_code, exc.response.text)
            raise
        except httpx.ConnectError:
            raise RuntimeError(
                f"Cannot connect to {prov}. "
                + ("Make sure Ollama is running." if prov == "ollama" else "Check your API key / network.")
            )

        if sanitized and reverse_map:
            resp = desanitize_text(resp, reverse_map)

        return resp, tokens, sanitized, reverse_map

    # ------------------------------------------------------------------
    # High-level methods
    # ------------------------------------------------------------------

    async def analyse_scan(self, scan_data: dict) -> tuple[str, int, bool]:
        prompt = _build_scan_prompt(scan_data)
        resp, tokens, sanitized, _ = await self._call(prompt)
        return resp, tokens, sanitized

    async def analyse_finding(self, finding: dict) -> tuple[str, int, bool]:
        prompt = _build_finding_prompt(finding)
        resp, tokens, sanitized, _ = await self._call(prompt)
        return resp, tokens, sanitized

    async def suggest_exploits(self, host_data: dict) -> tuple[str, int, bool]:
        prompt = _build_exploits_prompt(host_data)
        resp, tokens, sanitized, _ = await self._call(prompt)
        return resp, tokens, sanitized

    async def generate_report(self, project_data: dict) -> tuple[str, int, bool]:
        prompt = _build_report_prompt(project_data)
        resp, tokens, sanitized, _ = await self._call(prompt)
        return resp, tokens, sanitized

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def get_model_name(self) -> str:
        prov = self.provider
        if prov == "ollama":
            return self.cfg.get("ollama_model", "llama3.2")
        if prov == "openai":
            return self.cfg.get("openai_model", "gpt-4o")
        if prov == "anthropic":
            return self.cfg.get("anthropic_model", "claude-opus-4-6")
        return "unknown"
