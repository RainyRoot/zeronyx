"""Nmap tool adapter — Task 1.10 full implementation.

XML output (-oX -) is captured on stdout, parsed into the unified
ToolResult data model (hosts / ports / findings).

Findings are extracted from:
  - NSE vuln/vulners/vulscan script outputs
  - Detected service versions (info-level)
"""

from __future__ import annotations

import re
import shutil
import xml.etree.ElementTree as ET
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# NSE script IDs whose output we promote to findings
_VULN_SCRIPT_IDS = {
    "vulners",
    "vulscan",
    "vuln",
    "exploit",
    "smb-vuln-ms17-010",
    "smb-vuln-ms08-067",
    "smb-vuln-cve2009-3103",
    "http-shellshock",
    "ssl-heartbleed",
    "ssl-poodle",
    "ssl-drown",
    "ftp-anon",
    "ftp-proftpd-backdoor",
    "ftp-vsftpd-backdoor",
    "ssh-auth-methods",
    "rdp-vuln-ms12-020",
}

# Severity mapping based on script category keywords
_SEVERITY_KEYWORDS: list[tuple[str, str]] = [
    ("CRITICAL", "critical"),
    ("HIGH",     "high"),
    ("MEDIUM",   "medium"),
    ("LOW",      "low"),
    ("CVE-",     "medium"),   # default for raw CVE hits
]

# Regex to extract CVE IDs from script output
_CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)


def _guess_severity(text: str) -> str:
    upper = text.upper()
    for keyword, sev in _SEVERITY_KEYWORDS:
        if keyword in upper:
            return sev
    return "info"


def _extract_cve(text: str) -> str | None:
    match = _CVE_RE.search(text)
    return match.group(0).upper() if match else None


@register
class NmapAdapter(ToolAdapter):
    """Nmap network scanner adapter.

    Runs nmap as a subprocess, captures XML output on stdout (-oX -),
    and parses hosts / ports / services / NSE script results into the
    unified data model.
    """

    DEFAULT_TIMEOUT: int = 600  # 10 min hard cap

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "nmap"

    def get_binary_path(self) -> str | None:
        return shutil.which("nmap")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        flags: str = config.get("flags", "-sV")
        target: str = config.get("target", "")
        ports: str = config.get("ports", "")

        cmd: list[str] = ["nmap"]
        cmd.extend(flags.split())
        if ports:
            cmd.extend(["-p", ports])
        cmd.extend(["-oX", "-"])   # XML to stdout
        if target:
            cmd.append(target)

        return [p for p in cmd if p]  # strip accidental empty strings

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "Quick Scan",
                "description": "Fast scan of top 100 ports",
                "config": {"flags": "-T4 -F"},
            },
            {
                "name": "Full Port Scan",
                "description": "All 65 535 ports, no service detection",
                "config": {"flags": "-p- -T4"},
            },
            {
                "name": "Service Detection",
                "description": "Version detection + default NSE scripts",
                "config": {"flags": "-sV -sC"},
            },
            {
                "name": "OS Detection",
                "description": "OS fingerprinting + service version info",
                "config": {"flags": "-O -sV"},
            },
            {
                "name": "Aggressive",
                "description": "OS, version, scripts, traceroute (-A)",
                "config": {"flags": "-A -T4"},
            },
            {
                "name": "UDP Top 100",
                "description": "Top 100 UDP ports",
                "config": {"flags": "-sU --top-ports 100"},
            },
            {
                "name": "Vuln Scripts",
                "description": "NSE vulnerability scripts against open ports",
                "config": {"flags": "-sV --script vuln"},
            },
        ]

    # ------------------------------------------------------------------
    # XML parsing
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        """Parse nmap XML output into hosts, ports, and findings."""
        hosts: list[dict[str, Any]] = []
        ports: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []

        # nmap may mix XML with stderr lines — find where the XML starts
        xml_start = raw_output.find("<?xml")
        if xml_start == -1:
            # No XML found — return raw only
            return ToolResult(raw_output=raw_output)

        xml_text = raw_output[xml_start:]

        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            # Truncated XML (timeout / cancelled) — try to recover partial
            try:
                xml_text_fixed = xml_text + "</nmaprun>"
                root = ET.fromstring(xml_text_fixed)
            except ET.ParseError:
                return ToolResult(raw_output=raw_output)

        for host_el in root.findall("host"):
            host_data, host_ports, host_findings = self._parse_host(host_el)
            if host_data:
                hosts.append(host_data)
                ports.extend(host_ports)
                findings.extend(host_findings)

        return ToolResult(
            raw_output=raw_output,
            parsed={"host_count": len(hosts), "port_count": len(ports)},
            hosts=hosts,
            ports=ports,
            findings=findings,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _parse_host(
        self,
        host_el: ET.Element,
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]]]:
        """Parse a single <host> element.

        Returns (host_dict, ports_list, findings_list).
        Returns (None, [], []) if the host has no usable IP.
        """
        # Status
        status_el = host_el.find("status")
        state = status_el.get("state", "unknown") if status_el is not None else "unknown"

        # Addresses
        ip: str | None = None
        mac: str | None = None
        vendor: str | None = None

        for addr_el in host_el.findall("address"):
            addr_type = addr_el.get("addrtype", "")
            if addr_type in ("ipv4", "ipv6"):
                ip = addr_el.get("addr")
            elif addr_type == "mac":
                mac = addr_el.get("addr")
                vendor = addr_el.get("vendor")

        if not ip:
            return None, [], []

        # Hostname
        hostname: str | None = None
        hostnames_el = host_el.find("hostnames")
        if hostnames_el is not None:
            for hn_el in hostnames_el.findall("hostname"):
                hostname = hn_el.get("name")
                break  # take the first

        # OS detection
        os_name: str | None = None
        os_accuracy: int | None = None
        os_el = host_el.find("os")
        if os_el is not None:
            best: ET.Element | None = None
            best_acc = -1
            for match_el in os_el.findall("osmatch"):
                acc = int(match_el.get("accuracy", "0"))
                if acc > best_acc:
                    best_acc = acc
                    best = match_el
            if best is not None:
                os_name = best.get("name")
                os_accuracy = best_acc

        host_dict: dict[str, Any] = {
            "ip": ip,
            "hostname": hostname,
            "state": state,
            "mac": mac,
            "vendor": vendor,
            "os": os_name,
            "os_accuracy": os_accuracy,
        }

        # Ports
        ports: list[dict[str, Any]] = []
        findings: list[dict[str, Any]] = []

        ports_el = host_el.find("ports")
        if ports_el is not None:
            for port_el in ports_el.findall("port"):
                port_dict, port_findings = self._parse_port(ip, port_el)
                if port_dict:
                    ports.append(port_dict)
                    findings.extend(port_findings)

        # Host-level OS finding
        if os_name and os_accuracy and os_accuracy >= 90:
            findings.append({
                "host_ip": ip,
                "title": f"OS Detected: {os_name}",
                "severity": "info",
                "description": f"Nmap detected OS: {os_name} (accuracy: {os_accuracy}%)",
                "tool_source": "nmap",
            })

        return host_dict, ports, findings

    def _parse_port(
        self,
        host_ip: str,
        port_el: ET.Element,
    ) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        """Parse a single <port> element.

        Returns (port_dict, findings_list).
        """
        portid = port_el.get("portid")
        protocol = port_el.get("protocol", "tcp")

        if not portid:
            return None, []

        # State
        state_el = port_el.find("state")
        port_state = state_el.get("state", "unknown") if state_el is not None else "unknown"

        # Service
        service_name: str | None = None
        version_string: str | None = None
        banner: str | None = None

        service_el = port_el.find("service")
        if service_el is not None:
            service_name = service_el.get("name")
            product   = service_el.get("product", "")
            version   = service_el.get("version", "")
            extra     = service_el.get("extrainfo", "")
            tunnel    = service_el.get("tunnel", "")

            parts = [p for p in [product, version, extra] if p]
            version_string = " ".join(parts) if parts else None

            if tunnel == "ssl" and service_name:
                service_name = f"{service_name}/ssl"

            banner = service_el.get("servicefp")  # fingerprint as banner fallback

        port_dict: dict[str, Any] = {
            "host_ip": host_ip,
            "number": int(portid),
            "protocol": protocol,
            "state": port_state,
            "service": service_name,
            "version": version_string,
            "banner": banner,
        }

        # NSE Scripts → findings
        findings: list[dict[str, Any]] = []

        for script_el in port_el.findall("script"):
            script_id = script_el.get("id", "")
            script_out = script_el.get("output", "")

            if not script_id or not script_out:
                continue

            if script_id in _VULN_SCRIPT_IDS or "vuln" in script_id:
                severity = _guess_severity(script_out)
                cve = _extract_cve(script_out)
                findings.append({
                    "host_ip": host_ip,
                    "port_number": int(portid),
                    "port_protocol": protocol,
                    "title": f"{script_id} on port {portid}/{protocol}",
                    "severity": severity,
                    "cve": cve,
                    "description": script_out.strip(),
                    "tool_source": "nmap",
                })

        # Service version as info-level finding
        if version_string and port_state == "open":
            findings.append({
                "host_ip": host_ip,
                "port_number": int(portid),
                "port_protocol": protocol,
                "title": f"Service: {service_name or 'unknown'} {version_string} on {portid}/{protocol}",
                "severity": "info",
                "description": (
                    f"Port {portid}/{protocol} — {service_name or 'unknown'} "
                    f"version: {version_string}"
                ),
                "tool_source": "nmap",
            })

        return port_dict, findings
