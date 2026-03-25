"""Unit tests for NmapAdapter XML parsing — Task 1.14."""

import textwrap
import pytest

from backend.adapters.nmap_adapter import NmapAdapter
from backend.adapters.base import ToolResult


@pytest.fixture()
def adapter():
    return NmapAdapter()


# ---------------------------------------------------------------------------
# Sample XML fixtures
# ---------------------------------------------------------------------------

SIMPLE_HOST_XML = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <nmaprun>
      <host starttime="1700000000" endtime="1700000010">
        <status state="up" reason="echo-reply"/>
        <address addr="10.0.0.1" addrtype="ipv4"/>
        <address addr="AA:BB:CC:DD:EE:FF" addrtype="mac" vendor="Acme Corp"/>
        <hostnames>
          <hostname name="router.local" type="PTR"/>
        </hostnames>
        <ports>
          <port protocol="tcp" portid="22">
            <state state="open" reason="syn-ack"/>
            <service name="ssh" product="OpenSSH" version="8.9p1" extrainfo="Ubuntu"/>
          </port>
          <port protocol="tcp" portid="80">
            <state state="open" reason="syn-ack"/>
            <service name="http" product="nginx" version="1.24.0"/>
          </port>
          <port protocol="tcp" portid="443">
            <state state="filtered" reason="no-response"/>
            <service name="https" tunnel="ssl"/>
          </port>
        </ports>
      </host>
    </nmaprun>
""")

OS_DETECTION_XML = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <nmaprun>
      <host>
        <status state="up" reason="echo-reply"/>
        <address addr="192.168.1.5" addrtype="ipv4"/>
        <hostnames/>
        <ports>
          <port protocol="tcp" portid="445">
            <state state="open" reason="syn-ack"/>
            <service name="microsoft-ds"/>
          </port>
        </ports>
        <os>
          <osmatch name="Microsoft Windows 10 1803" accuracy="95">
            <osclass type="general purpose" vendor="Microsoft" osfamily="Windows" osgen="10"/>
          </osmatch>
          <osmatch name="Microsoft Windows 7 SP1" accuracy="80"/>
        </os>
      </host>
    </nmaprun>
""")

VULN_SCRIPT_XML = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <nmaprun>
      <host>
        <status state="up" reason="echo-reply"/>
        <address addr="10.1.1.1" addrtype="ipv4"/>
        <hostnames/>
        <ports>
          <port protocol="tcp" portid="445">
            <state state="open" reason="syn-ack"/>
            <service name="microsoft-ds"/>
            <script id="smb-vuln-ms17-010"
              output="VULNERABLE: Remote Code Execution vulnerability in Microsoft SMBv1 servers (ms17-010)&#xa;  State: VULNERABLE&#xa;  CVE: CVE-2017-0143&#xa;  Risk factor: HIGH"/>
          </port>
        </ports>
      </host>
    </nmaprun>
""")

MULTI_HOST_XML = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <nmaprun>
      <host>
        <status state="up"/>
        <address addr="10.0.0.1" addrtype="ipv4"/>
        <hostnames/>
        <ports>
          <port protocol="tcp" portid="80">
            <state state="open"/>
            <service name="http"/>
          </port>
        </ports>
      </host>
      <host>
        <status state="up"/>
        <address addr="10.0.0.2" addrtype="ipv4"/>
        <hostnames/>
        <ports>
          <port protocol="tcp" portid="22">
            <state state="open"/>
            <service name="ssh"/>
          </port>
          <port protocol="tcp" portid="8080">
            <state state="open"/>
            <service name="http-proxy"/>
          </port>
        </ports>
      </host>
    </nmaprun>
""")

NO_XML_OUTPUT = "Starting Nmap 7.94\nSome error occurred\nDone."

TRUNCATED_XML = textwrap.dedent("""\
    <?xml version="1.0" encoding="UTF-8"?>
    <nmaprun>
      <host>
        <status state="up"/>
        <address addr="10.0.0.99" addrtype="ipv4"/>
        <hostnames/>
        <ports>
""")  # intentionally truncated


# ---------------------------------------------------------------------------
# Tests — host parsing
# ---------------------------------------------------------------------------

def test_parse_simple_host(adapter: NmapAdapter):
    result = adapter.parse_output(SIMPLE_HOST_XML, {})
    assert isinstance(result, ToolResult)
    assert len(result.hosts) == 1
    host = result.hosts[0]
    assert host["ip"] == "10.0.0.1"
    assert host["hostname"] == "router.local"
    assert host["state"] == "up"
    assert host["mac"] == "AA:BB:CC:DD:EE:FF"
    assert host["vendor"] == "Acme Corp"


def test_parse_ports(adapter: NmapAdapter):
    result = adapter.parse_output(SIMPLE_HOST_XML, {})
    assert len(result.ports) == 3

    ports_by_number = {p["number"]: p for p in result.ports}
    assert 22 in ports_by_number
    assert 80 in ports_by_number
    assert 443 in ports_by_number

    ssh_port = ports_by_number[22]
    assert ssh_port["service"] == "ssh"
    assert "OpenSSH" in ssh_port["version"]
    assert ssh_port["state"] == "open"
    assert ssh_port["protocol"] == "tcp"
    assert ssh_port["host_ip"] == "10.0.0.1"

    https_port = ports_by_number[443]
    assert https_port["state"] == "filtered"
    assert "ssl" in (https_port["service"] or "")


def test_parse_os_detection(adapter: NmapAdapter):
    result = adapter.parse_output(OS_DETECTION_XML, {})
    assert len(result.hosts) == 1
    host = result.hosts[0]
    assert "Windows 10" in host["os"]
    assert host["os_accuracy"] == 95


def test_os_finding_created(adapter: NmapAdapter):
    result = adapter.parse_output(OS_DETECTION_XML, {})
    os_findings = [f for f in result.findings if "OS Detected" in f["title"]]
    assert len(os_findings) == 1
    assert "Windows 10" in os_findings[0]["description"]
    assert os_findings[0]["severity"] == "info"


def test_parse_vuln_script(adapter: NmapAdapter):
    result = adapter.parse_output(VULN_SCRIPT_XML, {})
    vuln_findings = [f for f in result.findings if "smb-vuln-ms17-010" in f["title"]]
    assert len(vuln_findings) == 1
    f = vuln_findings[0]
    assert f["severity"] in ("high", "critical", "medium")
    assert f["cve"] == "CVE-2017-0143"
    assert f["host_ip"] == "10.1.1.1"


def test_parse_multi_host(adapter: NmapAdapter):
    result = adapter.parse_output(MULTI_HOST_XML, {})
    assert len(result.hosts) == 2
    ips = {h["ip"] for h in result.hosts}
    assert ips == {"10.0.0.1", "10.0.0.2"}
    assert len(result.ports) == 3


def test_no_xml_returns_empty(adapter: NmapAdapter):
    result = adapter.parse_output(NO_XML_OUTPUT, {})
    assert result.raw_output == NO_XML_OUTPUT
    assert result.hosts == []
    assert result.ports == []


def test_truncated_xml_recovers_gracefully(adapter: NmapAdapter):
    # Should not raise — may return empty or partial results
    result = adapter.parse_output(TRUNCATED_XML, {})
    assert isinstance(result, ToolResult)


def test_service_version_finding(adapter: NmapAdapter):
    result = adapter.parse_output(SIMPLE_HOST_XML, {})
    version_findings = [f for f in result.findings if "Service:" in f["title"]]
    # ssh and nginx have version strings → 2 version findings
    assert len(version_findings) >= 2


# ---------------------------------------------------------------------------
# Tests — build_command
# ---------------------------------------------------------------------------

def test_build_command_basic(adapter: NmapAdapter):
    cmd = adapter.build_command({"flags": "-sV", "target": "10.0.0.1"})
    assert cmd[0] == "nmap"
    assert "-sV" in cmd
    assert "-oX" in cmd
    assert "-" in cmd  # XML to stdout
    assert "10.0.0.1" in cmd


def test_build_command_with_ports(adapter: NmapAdapter):
    cmd = adapter.build_command({"flags": "-sV", "target": "10.0.0.1", "ports": "22,80,443"})
    assert "-p" in cmd
    assert "22,80,443" in cmd


def test_build_command_no_empty_strings(adapter: NmapAdapter):
    cmd = adapter.build_command({"flags": "-T4 -F", "target": "192.168.1.0/24"})
    assert "" not in cmd


# ---------------------------------------------------------------------------
# Tests — profiles
# ---------------------------------------------------------------------------

def test_default_profiles_not_empty(adapter: NmapAdapter):
    profiles = adapter.get_default_profiles()
    assert len(profiles) >= 5
    for p in profiles:
        assert "name" in p
        assert "config" in p
        assert "flags" in p["config"]


# ---------------------------------------------------------------------------
# Tests — check_installed
# ---------------------------------------------------------------------------

def test_check_installed_returns_status(adapter: NmapAdapter):
    from backend.adapters.base import ToolStatus
    status = adapter.check_installed()
    assert isinstance(status, ToolStatus)
