"""Hydra credential brute-force adapter — Task 2.4.

Hydra is run as a subprocess.  The adapter collects all output and
parses found credential lines into the unified ToolResult model.

Supported config keys
---------------------
host / target   — target host or IP
port            — explicit port (optional; auto-detected by hydra for most services)
service         — protocol to attack: ssh, ftp, telnet, http-get, http-post-form,
                  smb, rdp, mysql, postgres, vnc, smtp, pop3, imap, snmp
username        — single username to test (mutually exclusive with userlist)
userlist        — path to username wordlist
password        — single password to test (mutually exclusive with passlist)
passlist        — path to password wordlist
threads         — task parallelism (default 16)
stop_on_first   — bool, stop as soon as one valid credential is found (default True)
http_path       — URL path for http-get/http-post-form (default "/")
http_post_data  — POST form data string for http-post-form
extra_args      — raw extra flags appended verbatim (optional, for power users)
"""

from __future__ import annotations

import re
import shutil
from typing import Any

from backend.adapters import register
from backend.adapters.base import ToolAdapter, ToolResult

# ---------------------------------------------------------------------------
# Output parsing patterns
# ---------------------------------------------------------------------------

# Standard found-credential line:
#   [22][ssh] host: 192.168.1.1   login: root   password: toor
#   [80][http-get] host: 192.168.1.1   login: admin   password: admin123
_FOUND_RE = re.compile(
    r"^\[(\d+)\]\[([^\]]+)\]\s+host:\s+(\S+)\s+login:\s+(\S+)\s+password:\s+(.+)$",
    re.IGNORECASE,
)

# Hydra sometimes prints a summary line like:
#   1 valid password found.
_SUMMARY_RE = re.compile(r"(\d+)\s+valid\s+passwords?\s+found", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Service definitions — label + typical default port
# ---------------------------------------------------------------------------

HYDRA_SERVICES: list[dict[str, Any]] = [
    {"id": "ssh",            "label": "SSH",             "port": 22},
    {"id": "ftp",            "label": "FTP",             "port": 21},
    {"id": "telnet",         "label": "Telnet",          "port": 23},
    {"id": "http-get",       "label": "HTTP GET",        "port": 80},
    {"id": "http-post-form", "label": "HTTP POST Form",  "port": 80},
    {"id": "smb",            "label": "SMB",             "port": 445},
    {"id": "rdp",            "label": "RDP",             "port": 3389},
    {"id": "mysql",          "label": "MySQL",           "port": 3306},
    {"id": "postgres",       "label": "PostgreSQL",      "port": 5432},
    {"id": "vnc",            "label": "VNC",             "port": 5900},
    {"id": "smtp",           "label": "SMTP",            "port": 25},
    {"id": "pop3",           "label": "POP3",            "port": 110},
    {"id": "imap",           "label": "IMAP",            "port": 143},
    {"id": "snmp",           "label": "SNMP",            "port": 161},
]


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

@register
class HydraAdapter(ToolAdapter):
    """THC Hydra credential brute-force adapter."""

    DEFAULT_TIMEOUT: int = 3600  # 1 hour hard cap

    # ------------------------------------------------------------------
    # ToolAdapter interface
    # ------------------------------------------------------------------

    def get_name(self) -> str:
        return "hydra"

    def get_binary_path(self) -> str | None:
        return shutil.which("hydra")

    def build_command(self, config: dict[str, Any]) -> list[str]:
        host:    str  = config.get("host") or config.get("target", "")
        service: str  = config.get("service", "ssh")
        threads: int  = int(config.get("threads", 16))
        port:    Any  = config.get("port")
        stop_on_first: bool = bool(config.get("stop_on_first", True))

        cmd: list[str] = ["hydra", "-v"]

        # Username source
        username: str = config.get("username", "")
        userlist: str = config.get("userlist", "")
        if userlist:
            cmd += ["-L", userlist]
        elif username:
            cmd += ["-l", username]
        else:
            cmd += ["-l", "admin"]  # safe fallback — unlikely to bruteforce nothing

        # Password source
        password: str = config.get("password", "")
        passlist: str = config.get("passlist", "")
        if passlist:
            cmd += ["-P", passlist]
        elif password:
            cmd += ["-p", password]
        else:
            cmd += ["-p", "password"]  # safe fallback

        # Threads
        cmd += ["-t", str(threads)]

        # Stop on first hit
        if stop_on_first:
            cmd.append("-f")

        # Port override
        if port:
            cmd += ["-s", str(port)]

        # Extra user-supplied flags (advanced use)
        extra: str = config.get("extra_args", "")
        if extra:
            cmd.extend(extra.split())

        # Target host + service (service-specific formatting)
        if service == "http-get":
            http_path: str = config.get("http_path", "/")
            cmd.append(f"{host}")
            cmd.append(f"http-get")
            cmd.append(http_path)
        elif service == "http-post-form":
            http_path = config.get("http_path", "/login")
            post_data: str = config.get("http_post_data", "username=^USER^&password=^PASS^:F=incorrect")
            cmd.append(f"{host}")
            cmd.append("http-post-form")
            cmd.append(f"{http_path}:{post_data}")
        else:
            cmd += [host, service]

        return [p for p in cmd if p]

    def get_default_profiles(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "SSH Default Creds",
                "description": "Test common SSH default credentials",
                "config": {
                    "service": "ssh",
                    "userlist": "/usr/share/wordlists/metasploit/unix_users.txt",
                    "passlist": "/usr/share/wordlists/metasploit/unix_passwords.txt",
                    "threads": 4,
                    "stop_on_first": True,
                },
            },
            {
                "name": "FTP Default Creds",
                "description": "Test common FTP credentials",
                "config": {
                    "service": "ftp",
                    "userlist": "/usr/share/wordlists/metasploit/unix_users.txt",
                    "passlist": "/usr/share/wordlists/metasploit/unix_passwords.txt",
                    "threads": 4,
                    "stop_on_first": True,
                },
            },
            {
                "name": "HTTP Basic Auth",
                "description": "Brute-force HTTP GET basic authentication",
                "config": {
                    "service": "http-get",
                    "http_path": "/",
                    "userlist": "/usr/share/wordlists/metasploit/http_default_users.txt",
                    "passlist": "/usr/share/wordlists/metasploit/http_default_pass.txt",
                    "threads": 16,
                    "stop_on_first": True,
                },
            },
            {
                "name": "MySQL Root Brute",
                "description": "Test MySQL root password",
                "config": {
                    "service": "mysql",
                    "username": "root",
                    "passlist": "/usr/share/wordlists/rockyou.txt",
                    "threads": 4,
                    "stop_on_first": True,
                },
            },
            {
                "name": "SMB Admin",
                "description": "Test SMB with common admin credentials",
                "config": {
                    "service": "smb",
                    "userlist": "/usr/share/wordlists/metasploit/unix_users.txt",
                    "passlist": "/usr/share/wordlists/metasploit/unix_passwords.txt",
                    "threads": 1,  # SMB is single-threaded in hydra
                    "stop_on_first": True,
                },
            },
        ]

    # ------------------------------------------------------------------
    # Output parsing
    # ------------------------------------------------------------------

    def parse_output(self, raw_output: str, config: dict[str, Any]) -> ToolResult:
        host:    str = config.get("host") or config.get("target", "")
        service: str = config.get("service", "ssh")
        credentials: list[dict[str, Any]] = []
        findings:    list[dict[str, Any]] = []
        total_valid: int = 0

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue

            # Found credential line
            m = _FOUND_RE.match(line)
            if m:
                port_str = m.group(1)
                svc      = m.group(2).lower()
                cred_host = m.group(3)
                username  = m.group(4)
                password  = m.group(5).strip()

                cred: dict[str, Any] = {
                    "host":     cred_host,
                    "port":     int(port_str),
                    "service":  svc,
                    "username": username,
                    "password": password,
                }
                credentials.append(cred)
                findings.append({
                    "title":       f"Valid credential: {username}@{cred_host}",
                    "severity":    "high",
                    "description": (
                        f"Hydra found valid credentials for {svc} on "
                        f"{cred_host}:{port_str} — "
                        f"username: {username}, password: {password}"
                    ),
                    "tool_source": "hydra",
                })
                continue

            # Summary line — extract count
            m2 = _SUMMARY_RE.search(line)
            if m2:
                total_valid = int(m2.group(1))

        if total_valid == 0:
            total_valid = len(credentials)

        return ToolResult(
            raw_output=raw_output,
            parsed={
                "host":        host,
                "service":     service,
                "total_found": total_valid,
                "credentials": credentials,
            },
            findings=findings,
            credentials=credentials,
        )
