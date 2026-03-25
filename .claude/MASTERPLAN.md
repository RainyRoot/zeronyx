# ZERONYX — Projekt-Masterplan

> **Zweck dieses Dokuments:** Dies ist der übergeordnete Masterplan für das Projekt ZeroNyx. Es dient als Referenz für die Planung und Umsetzung jeder einzelnen Phase. Wenn du (Claude Code) an einem Task arbeitest, lies zuerst diesen Plan um den Gesamtkontext zu verstehen, bevor du mit der Implementierung beginnst.

---

## 1. Was ist ZeroNyx?

ZeroNyx ist eine **Desktop-basierte All-in-One Pentesting Suite**, die den gesamten Workflow eines Penetrationstesters in einer einzigen Oberfläche vereint. Von Reconnaissance über Vulnerability Scanning bis Exploitation und Dokumentation — alles in einem Tool.

**Tagline:** *From Zero to Pwned*

### Kernprinzipien

- **Orchestrator, nicht Einbettung:** ZeroNyx bettet keine externen Tools ein. Es startet sie als Subprocesses, parst deren Output und stellt die Ergebnisse einheitlich dar. Das ist entscheidend für GPL-Compliance.
- **Projekt-basiert:** Ein Projekt = Ein Engagement. Alle Daten, Scans, Findings und Reports gehören zu einem Projekt.
- **Free muss gut sein:** Die Community-Version ist kein verkrüppeltes Demo, sondern ein echtes, nützliches Tool. Pro bietet Automatisierung, AI und Profi-Features.
- **Plugin-first:** Das Plugin-System wird von Anfang an eingeplant, nicht nachträglich draufgeschraubt.
- **Kein Telemetry:** ZeroNyx sammelt keine Nutzungsdaten. Vertrauen ist in der Security-Community alles.

---

## 2. Tech-Stack

| Komponente | Technologie | Hinweise |
|---|---|---|
| Desktop Shell | **Electron 33+** | Startet Python-Backend als Child-Process |
| Frontend | **React 18 + TypeScript** | Gesamte UI |
| UI Framework | **Tailwind CSS + shadcn/ui** | Dark Theme als Default |
| State Management | **Zustand** | Leichtgewichtig, TS-first |
| Backend | **Python 3.12 + FastAPI** | Async, Auto-generierte API-Docs |
| Echtzeit | **WebSocket** | Live-Streaming von Scan-Output |
| API | **REST (FastAPI)** | CRUD-Operationen |
| Datenbank | **SQLite** (lokal, eine .db pro Projekt) | Später optional PostgreSQL für Team-Modus |
| ORM | **SQLAlchemy 2.0 + Alembic** | Type-safe Models, Migrations |
| Task Queue | **Celery + Redis** | Parallele Scans, Background Jobs |
| Plugin Runtime | **Python (Backend) + React (Frontend)** | Plugins können beides erweitern |

### Architektur-Übersicht

```
┌─────────────────────────────────────────────────┐
│                   ELECTRON SHELL                 │
│  (Main Process: App Lifecycle, Auto-Update, IPC) │
├─────────────────────────────────────────────────┤
│              REACT FRONTEND (Renderer)           │
│  ┌───────────┬──────────┬──────────┬──────────┐ │
│  │ Dashboard │  Scans   │  Proxy   │ Findings │ │
│  ├───────────┴──────────┴──────────┴──────────┤ │
│  │         Plugin UI Slots                     │ │
│  ├─────────────────────────────────────────────┤ │
│  │   Zustand Store  │  WebSocket Client        │ │
│  └──────────────────┴──────────────────────────┘ │
├──────────────── REST + WebSocket ────────────────┤
│              PYTHON BACKEND (FastAPI)             │
│  ┌─────────────────────────────────────────────┐ │
│  │  API Layer (REST Endpoints + WS Endpoints)  │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Services (Scan, AI, Chain, Report, Plugin) │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Tool Adapters (Nmap, Nuclei, SQLMap, ...)  │ │
│  │  → Subprocess calls, NIEMALS linking/import │ │
│  ├─────────────────────────────────────────────┤ │
│  │  Parsers (XML, JSON, Text → unified Model)  │ │
│  ├─────────────────────────────────────────────┤ │
│  │  SQLAlchemy Models + Alembic Migrations     │ │
│  └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  SQLite (.db/Projekt)  │  Redis  │  Filesystem  │
└─────────────────────────────────────────────────┘
          ↕ subprocess
┌─────────────────────────────────────────────────┐
│  Externe Tools (auf System installiert):         │
│  nmap, nuclei, nikto, gobuster, ffuf, hydra,    │
│  sqlmap, searchsploit, msfconsole (msfrpcd)     │
└─────────────────────────────────────────────────┘
```

---

## 3. Projektstruktur (Monorepo)

```
zeronyx/
├── electron/                  # Electron Main Process
│   ├── main.ts                # App Entry, Window Management
│   ├── preload.ts             # Context Bridge
│   ├── backend-manager.ts     # Python-Backend starten/stoppen
│   └── updater.ts             # Auto-Update Logic
├── frontend/                  # React App
│   ├── src/
│   │   ├── components/        # Wiederverwendbare UI-Komponenten
│   │   │   ├── ui/            # shadcn/ui Basis-Komponenten
│   │   │   ├── layout/        # Sidebar, TabBar, StatusBar
│   │   │   ├── terminal/      # xterm.js Embedded Terminal
│   │   │   └── common/        # Tables, Forms, Modals
│   │   ├── pages/             # Hauptansichten
│   │   │   ├── Dashboard/
│   │   │   ├── Scans/
│   │   │   ├── Proxy/
│   │   │   ├── Findings/
│   │   │   ├── Targets/
│   │   │   ├── Reports/
│   │   │   └── Settings/
│   │   ├── stores/            # Zustand State
│   │   ├── hooks/             # useWebSocket, useApi, useScan
│   │   ├── services/          # API Client, WS Client
│   │   ├── plugins/           # Plugin UI Slot System
│   │   └── types/             # TypeScript Interfaces
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                   # Python FastAPI
│   ├── main.py                # FastAPI App Entry
│   ├── api/
│   │   ├── routes/            # REST Endpoints
│   │   │   ├── projects.py
│   │   │   ├── targets.py
│   │   │   ├── scans.py
│   │   │   ├── findings.py
│   │   │   └── settings.py
│   │   └── websocket/         # WS Endpoints
│   │       └── scan_stream.py
│   ├── adapters/              # Tool Adapter Pattern
│   │   ├── base.py            # Abstract ToolAdapter
│   │   ├── nmap_adapter.py
│   │   ├── nuclei_adapter.py
│   │   ├── nikto_adapter.py
│   │   ├── gobuster_adapter.py
│   │   ├── hydra_adapter.py
│   │   ├── sqlmap_adapter.py
│   │   ├── metasploit_adapter.py
│   │   ├── searchsploit_adapter.py
│   │   └── shodan_adapter.py
│   ├── parsers/               # Tool Output → Unified Model
│   │   ├── nmap_parser.py
│   │   ├── nuclei_parser.py
│   │   └── ...
│   ├── services/              # Business Logic
│   │   ├── scan_service.py
│   │   ├── ai_service.py
│   │   ├── chain_engine.py    # Pro: Automated Workflows
│   │   ├── report_service.py
│   │   ├── obsidian_service.py
│   │   └── plugin_manager.py
│   ├── models/                # SQLAlchemy Models
│   │   ├── project.py
│   │   ├── target.py
│   │   ├── scan.py
│   │   ├── host.py
│   │   ├── port.py
│   │   ├── finding.py
│   │   ├── credential.py
│   │   └── note.py
│   ├── migrations/            # Alembic
│   ├── config.py
│   └── requirements.txt
├── plugins/                   # Plugin SDK + Beispiele
│   ├── sdk/
│   ├── examples/
│   └── README.md
├── shared/                    # Shared Types (via OpenAPI codegen)
├── scripts/                   # Build, Dev, Setup
│   ├── dev.sh                 # Startet Frontend + Backend für Dev
│   ├── build.sh               # Production Build
│   └── setup.sh               # Erstinstallation Dependencies
├── docs/                      # Dokumentation
│   ├── ARCHITECTURE.md
│   ├── PLUGIN_SDK.md
│   └── CONTRIBUTING.md
├── package.json               # Root Monorepo (npm workspaces)
├── LICENSE                    # Community: MIT/Apache 2.0
└── README.md
```

---

## 4. Datenbank-Schema (Core)

Jedes Projekt bekommt eine eigene SQLite-Datei (`{project_name}.zeronyx.db`).

```sql
-- Projekt-Metadaten (in einer globalen app.db)
CREATE TABLE projects (
    id          TEXT PRIMARY KEY,  -- UUID
    name        TEXT NOT NULL,
    description TEXT,
    scope       TEXT,              -- JSON: erlaubte IPs/Domains/CIDRs
    status      TEXT DEFAULT 'active',  -- active, archived, completed
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ab hier: pro Projekt-Datenbank

CREATE TABLE targets (
    id          TEXT PRIMARY KEY,
    value       TEXT NOT NULL,     -- IP, Domain, CIDR
    type        TEXT NOT NULL,     -- ip, domain, cidr, url
    notes       TEXT,
    tags        TEXT,              -- JSON array
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scans (
    id          TEXT PRIMARY KEY,
    target_id   TEXT REFERENCES targets(id),
    tool        TEXT NOT NULL,     -- nmap, nuclei, nikto, etc.
    profile     TEXT,              -- Scan-Preset Name
    config      TEXT,              -- JSON: alle Parameter
    status      TEXT DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    started_at  DATETIME,
    finished_at DATETIME,
    error       TEXT
);

CREATE TABLE scan_results (
    id          TEXT PRIMARY KEY,
    scan_id     TEXT REFERENCES scans(id),
    raw_output  TEXT,              -- Roher Tool-Output
    parsed      TEXT,              -- JSON: geparstes Ergebnis
    format      TEXT               -- xml, json, text
);

CREATE TABLE hosts (
    id          TEXT PRIMARY KEY,
    ip          TEXT NOT NULL,
    hostname    TEXT,
    os          TEXT,
    os_accuracy INTEGER,
    mac         TEXT,
    vendor      TEXT,
    state       TEXT DEFAULT 'up',
    last_seen   DATETIME,
    UNIQUE(ip)
);

CREATE TABLE ports (
    id          TEXT PRIMARY KEY,
    host_id     TEXT REFERENCES hosts(id),
    number      INTEGER NOT NULL,
    protocol    TEXT DEFAULT 'tcp',  -- tcp, udp
    state       TEXT DEFAULT 'open',
    service     TEXT,
    version     TEXT,
    banner      TEXT,
    scan_id     TEXT REFERENCES scans(id),
    UNIQUE(host_id, number, protocol)
);

CREATE TABLE findings (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    severity    TEXT NOT NULL,     -- critical, high, medium, low, info
    cvss        REAL,
    cve         TEXT,              -- CVE-ID falls vorhanden
    description TEXT,
    remediation TEXT,
    tool_source TEXT,              -- welches Tool hat es gefunden
    scan_id     TEXT REFERENCES scans(id),
    host_id     TEXT REFERENCES hosts(id),
    port_id     TEXT REFERENCES ports(id),
    status      TEXT DEFAULT 'open',  -- open, confirmed, false_positive, resolved
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finding_evidence (
    id          TEXT PRIMARY KEY,
    finding_id  TEXT REFERENCES findings(id),
    type        TEXT NOT NULL,     -- screenshot, request, response, output, note
    title       TEXT,
    data        TEXT,              -- Text-Content oder Dateipfad
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credentials (
    id          TEXT PRIMARY KEY,
    service     TEXT,              -- ssh, ftp, http, etc.
    host_id     TEXT REFERENCES hosts(id),
    port_id     TEXT REFERENCES ports(id),
    username    TEXT,
    password    TEXT,
    hash        TEXT,
    hash_type   TEXT,
    source_scan TEXT REFERENCES scans(id),
    verified    BOOLEAN DEFAULT FALSE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id          TEXT PRIMARY KEY,
    target_id   TEXT REFERENCES targets(id),
    host_id     TEXT REFERENCES hosts(id),
    finding_id  TEXT REFERENCES findings(id),
    content     TEXT NOT NULL,
    tags        TEXT,              -- JSON array
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pro-Features
CREATE TABLE chains (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    steps       TEXT NOT NULL,     -- JSON: Array von Chain-Steps
    trigger_on  TEXT,              -- manual, on_scan_complete, scheduled
    enabled     BOOLEAN DEFAULT TRUE,
    last_run    DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_analyses (
    id          TEXT PRIMARY KEY,
    context_type TEXT NOT NULL,    -- scan, finding, project
    context_id  TEXT NOT NULL,
    provider    TEXT,              -- ollama, openai, anthropic
    model       TEXT,
    prompt      TEXT,
    response    TEXT,
    tokens_used INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Tool Adapter Pattern

Jedes externe Tool wird nach diesem Pattern integriert. **Dies ist die wichtigste Abstraktion im gesamten Projekt.**

```python
# backend/adapters/base.py

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Any
from dataclasses import dataclass
from enum import Enum

class ToolStatus(Enum):
    NOT_INSTALLED = "not_installed"
    INSTALLED = "installed"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class ToolResult:
    raw_output: str
    parsed: dict[str, Any]
    findings: list[dict]  # Normalisierte Findings
    hosts: list[dict]     # Entdeckte Hosts
    ports: list[dict]     # Entdeckte Ports
    credentials: list[dict]  # Gefundene Credentials

class ToolAdapter(ABC):
    """Base class für alle Tool-Integrationen.
    
    WICHTIG: Tools werden IMMER als Subprocess gestartet.
    Niemals als Python-Import/Library einbinden (GPL-Compliance).
    """

    @abstractmethod
    def get_name(self) -> str:
        """Tool-Name für UI und Logging."""

    @abstractmethod
    def get_binary_path(self) -> str | None:
        """Prüft ob das Tool installiert ist, gibt Pfad zurück."""

    @abstractmethod
    def check_installed(self) -> ToolStatus:
        """Prüft ob das Tool verfügbar ist."""

    @abstractmethod
    def build_command(self, config: dict) -> list[str]:
        """Baut den CLI-Befehl aus der Scan-Config.
        
        Args:
            config: Dict mit allen Scan-Parametern aus dem UI-Formular
        Returns:
            Liste von Command-Teilen, z.B. ["nmap", "-sV", "-oX", "-", "10.0.0.1"]
        """

    @abstractmethod
    async def stream_output(self, process) -> AsyncGenerator[str, None]:
        """Streamt stdout/stderr Zeile für Zeile (für WebSocket an Frontend)."""

    @abstractmethod
    def parse_output(self, raw_output: str, config: dict) -> ToolResult:
        """Parst den finalen Output in das einheitliche Datenmodell.
        
        Dies ist die zentrale Methode die Tool-spezifischen Output
        (XML, JSON, Text) in normalisierte Findings/Hosts/Ports konvertiert.
        """

    @abstractmethod
    def get_default_profiles(self) -> list[dict]:
        """Vordefinierte Scan-Profile für das UI.
        
        Returns:
            [{"name": "Quick Scan", "config": {"flags": "-T4 -F"}}, ...]
        """

    async def run(self, config: dict) -> AsyncGenerator[str | ToolResult, None]:
        """Hauptmethode: Startet Tool, streamt Output, parst Ergebnis.
        
        Yields:
            str: Einzelne Output-Zeilen (für Live-Stream)
            ToolResult: Finales geparstes Ergebnis (letztes yield)
        """
        # Implementation in base class:
        # 1. build_command(config)
        # 2. subprocess starten
        # 3. stream_output() yielden
        # 4. parse_output() als letztes yielden
```

### Beispiel: NmapAdapter

```python
# backend/adapters/nmap_adapter.py

class NmapAdapter(ToolAdapter):
    def get_name(self) -> str:
        return "nmap"

    def get_binary_path(self) -> str | None:
        return shutil.which("nmap")

    def build_command(self, config: dict) -> list[str]:
        cmd = ["nmap"]
        cmd.extend(config.get("flags", "-sV").split())
        cmd.extend(["-oX", "-"])  # XML Output an stdout
        cmd.append(config["target"])
        return cmd

    def parse_output(self, raw_output: str, config: dict) -> ToolResult:
        # XML parsen → Hosts, Ports, Services extrahieren
        # → ToolResult mit normalisierten Daten zurückgeben
        ...

    def get_default_profiles(self) -> list[dict]:
        return [
            {"name": "Quick Scan", "config": {"flags": "-T4 -F"}},
            {"name": "Full Port Scan", "config": {"flags": "-p- -T4"}},
            {"name": "Service Detection", "config": {"flags": "-sV -sC"}},
            {"name": "OS Detection", "config": {"flags": "-O -sV"}},
            {"name": "Aggressive", "config": {"flags": "-A -T4"}},
            {"name": "UDP Scan", "config": {"flags": "-sU --top-ports 100"}},
            {"name": "Vuln Scripts", "config": {"flags": "-sV --script vuln"}},
        ]
```

**Dieses Pattern gilt für JEDES Tool.** Wenn du einen neuen Adapter schreibst, folge exakt dieser Struktur.

---

## 6. Feature-Matrix: Free vs. Pro

| Feature | Free (Community) | Pro |
|---|:---:|:---:|
| Einzelne Tools starten & Ergebnisse sehen | ✓ | ✓ |
| Projekt-Management (Targets, Scopes) | ✓ | ✓ |
| Nmap, Gobuster, Nikto, Hydra Integration | ✓ | ✓ |
| SearchSploit / Exploit-DB Lookup | ✓ | ✓ |
| Manuelle Ergebnis-Analyse | ✓ | ✓ |
| Basic Obsidian-Export (Markdown) | ✓ | ✓ |
| Community Plugins (installieren) | ✓ | ✓ |
| Eingebetteter Terminal (xterm.js) | ✓ | ✓ |
| Max. Projekte | 3 | Unbegrenzt |
| Proxy/Interceptor | Nur Logging | Modify + Replay |
| Metasploit | Module suchen | Full (Sessions, Meterpreter) |
| Shodan/Censys Integration | ✗ | ✓ |
| Vuln-Korrelation (Cross-Tool) | ✗ | ✓ |
| Automatisierte Chains (Workflows) | ✗ | ✓ |
| AI-Analyse & Empfehlungen | 5/Tag | Unbegrenzt |
| AI-Report-Generierung | ✗ | ✓ |
| SQLMap Automation | ✗ | ✓ |
| Advanced Reporting (PDF, HTML) | ✗ | ✓ |
| Obsidian Auto-Sync (Echtzeit) | ✗ | ✓ |
| Plugin Marketplace (publizieren) | ✗ | ✓ |
| Custom Chains erstellen | ✗ | ✓ |
| Team/Collaboration | ✗ | ✓ |

---

## 7. Lizenz-Compliance

**Goldene Regel: Kein Tool einbetten, alles als Subprocess.**

| Tool | Lizenz | Integration | Compliant? |
|---|---|---|---|
| Nmap | GPL 2.0+ | Subprocess + XML parsen | ✓ |
| Masscan | AGPL 3.0 | Subprocess | ✓ |
| SQLMap | GPL 2.0 | Subprocess | ✓ |
| Metasploit FW | BSD 3-Clause | RPC API (msfrpcd) | ✓ |
| Nuclei | MIT | Subprocess + JSON | ✓ |
| Nikto | GPL | Subprocess | ✓ |
| Gobuster | Apache 2.0 | Subprocess | ✓ |
| ffuf | MIT | Subprocess | ✓ |
| Hydra | AGPL 3.0 | Subprocess | ✓ |
| SearchSploit | GPL | Subprocess | ✓ |
| mitmproxy | MIT | Python Library Import | ✓ |

ZeroNyx **liefert keines dieser Tools mit**. Der User muss sie installiert haben. ZeroNyx prüft beim Start welche verfügbar sind.

---

## 8. Phasenplan

### Phase 1: Foundation (6-8 Wochen)

**Ziel:** Lauffähige Desktop-App mit Grundstruktur, Nmap als erstes Tool.

| # | Task | Beschreibung | Aufwand |
|---|---|---|---|
| 1.1 | Electron Boilerplate | Electron + React + TS Projekt, Build-Pipeline, Hot Reload | 2-3 Tage |
| 1.2 | Dark Theme UI Shell | Tailwind + shadcn/ui, Main Layout (Sidebar, Tabs, StatusBar) | 2-3 Tage |
| 1.3 | Python Backend Setup | FastAPI Projekt, Projektstruktur, Auto-Start durch Electron | 2-3 Tage |
| 1.4 | WebSocket Bridge | WS-Verbindung Frontend ↔ Backend, Reconnect, Message-Protocol | 2 Tage |
| 1.5 | REST API Foundation | Basis-Endpoints, Error Handling, CORS | 1-2 Tage |
| 1.6 | Datenbank + Migrations | SQLite + SQLAlchemy Models (projects, targets, scans, hosts, ports) | 2-3 Tage |
| 1.7 | Projekt-Management UI | Erstellen/Öffnen/Löschen, Dashboard mit Übersicht | 3-4 Tage |
| 1.8 | Target-Management | Targets zu Projekt hinzufügen, Scope definieren | 2 Tage |
| 1.9 | Tool-Adapter Base Class | Abstract ToolAdapter mit start/stop/parse/stream | 1-2 Tage |
| 1.10 | Nmap Adapter | Subprocess, XML parsen, Findings extrahieren | 3-4 Tage |
| 1.11 | Nmap UI | Scan-Formular, Live-Output, Ergebnis-Tabelle (Hosts/Ports) | 3-4 Tage |
| 1.12 | Tool Health Check | Beim Start prüfen welche Tools installiert sind | 1 Tag |
| 1.13 | Settings/Config | App-Settings (Pfade, Theme, Tool-Pfade) | 1-2 Tage |
| 1.14 | Testing + Bugfixing | Unit Tests Backend, E2E kritische Flows | 3-4 Tage |

**Milestone:** Projekt erstellen → Nmap-Scan starten → Live-Output sehen → Ergebnisse in Tabelle anzeigen.

---

### Phase 2: Core Tools (8-10 Wochen)

**Ziel:** Alle Free-Tier Tools integriert, grundlegende UI komplett.

| # | Task | Beschreibung |
|---|---|---|
| 2.1 | Gobuster/ffuf Adapter + UI | Directory Bruteforce mit Wordlist-Auswahl |
| 2.2 | Nuclei Adapter + UI | Vulnerability Scanning, Template-Manager |
| 2.3 | Nikto Adapter + UI | Web-Server Scanner |
| 2.4 | Hydra Adapter + UI | Credential Attacks, Service-Auswahl |
| 2.5 | SearchSploit Adapter + UI | Exploit-Suche, Auto-Lookup nach Nmap-Scans |
| 2.6 | Terminal-Emulator | xterm.js einbetten für direkte CLI-Nutzung |
| 2.7 | Target-Management erweitern | Bulk-Import, CIDR-Support, Scope-Validation |
| 2.8 | Scan-History | Alle bisherigen Scans anzeigen, filtern, erneut starten |
| 2.9 | Basic Obsidian-Export | Projekt als Obsidian-Vault exportieren (Markdown + Wikilinks) |
| 2.10 | Credential Store | Gefundene Credentials zentral anzeigen und verwalten |

**Milestone:** Kompletter Basis-Pentest durchführbar. Alle Free-Tools funktionieren.

---

### Phase 3: Advanced Tools & Proxy (8-12 Wochen)

**Ziel:** Proxy/Interceptor und Metasploit, Cross-Tool-Korrelation.

| # | Task | Beschreibung |
|---|---|---|
| 3.1 | HTTP(S) Proxy (mitmproxy) | Eigener Proxy, Request/Response Logging |
| 3.2 | Proxy UI | Split-View, History, Filter, Search |
| 3.3 | Proxy Pro Features | Request Modify, Replay, Intruder-ähnlich |
| 3.4 | Metasploit Adapter | msfrpcd Connection, Module Browser |
| 3.5 | Metasploit UI | Module suchen, Auxiliary ausführen (Free), Exploit + Sessions (Pro) |
| 3.6 | SQLMap Adapter + UI | Injection Testing, Übernahme von Proxy-Requests |
| 3.7 | Shodan Adapter + UI | Passive Recon, API-Key-Management |
| 3.8 | Censys Adapter + UI | Alternative/Ergänzung zu Shodan |
| 3.9 | Finding-Normalisierung | Alle Tool-Ergebnisse → einheitliches Finding-Modell |
| 3.10 | Cross-Tool-Korrelation (Pro) | Gleiche Hosts/Ports/Vulns aus verschiedenen Tools zusammenführen |

**Milestone:** Vollständiger Pentest-Workflow inkl. Web-Testing und Exploitation.

---

### Phase 4: AI & Automation (6-8 Wochen)

**Ziel:** AI-Features und Chain-Engine für Pro-Version.

| # | Task | Beschreibung |
|---|---|---|
| 4.1 | AI Service | Provider-Abstraktion (Ollama, OpenAI, Claude) |
| 4.2 | AI Scan-Analyse | "AI Analyse" Button nach jedem Scan |
| 4.3 | AI Exploit-Empfehlungen | Basierend auf Services/Versionen Exploits vorschlagen |
| 4.4 | AI False-Positive-Erkennung | AI bewertet Findings |
| 4.5 | Chain Engine (Pro) | Definierbare Workflows: Scan A → Parse → Scan B |
| 4.6 | Standard-Chains | Quick Recon, Full Web Audit, Network Sweep |
| 4.7 | AI Report-Generierung (Pro) | Executive Summary + Tech Details automatisch |
| 4.8 | Obsidian Auto-Sync (Pro) | Echtzeit-Sync ins Vault |
| 4.9 | Data Sanitization | IPs/Hostnames anonymisieren vor Cloud-API-Calls |

**Milestone:** AI analysiert Ergebnisse, Chains automatisieren Workflows, Reports werden generiert.

---

### Phase 5: Plugin-System & Polish (6-8 Wochen)

**Ziel:** Plugin-System, UI-Polish, Performance.

| # | Task | Beschreibung |
|---|---|---|
| 5.1 | Plugin Manifest Spec | manifest.json Format definieren |
| 5.2 | Plugin Loader (Backend) | Python-Plugins laden, validieren, sandboxen |
| 5.3 | Plugin UI Slots (Frontend) | Definierte Bereiche wo Plugins React-Komponenten rendern |
| 5.4 | Plugin Permission System | Deklarative Permissions, User-Bestätigung |
| 5.5 | Plugin SDK + Docs | Dokumentation und Beispiele für Plugin-Entwickler |
| 5.6 | 3-5 Beispiel-Plugins | Referenz-Implementierungen |
| 5.7 | UI/UX Polish | Animationen, Keyboard Shortcuts, Accessibility |
| 5.8 | Performance-Optimierung | Große Scan-Ergebnisse, virtualisierte Listen, Memory |
| 5.9 | Auto-Updater | Electron auto-update für neue Versionen |

**Milestone:** Plugin-System funktioniert, App fühlt sich polished an.

---

### Phase 6: Launch & Marketplace (4-6 Wochen)

**Ziel:** Öffentlicher Launch.

| # | Task | Beschreibung |
|---|---|---|
| 6.1 | Lizenz-System | RSA-signierte License Keys, Offline-fähig |
| 6.2 | Payment Integration | Stripe oder Paddle |
| 6.3 | Plugin Marketplace | Backend + Frontend für Plugin-Veröffentlichung |
| 6.4 | Website | Landing Page, Docs, Download-Seite |
| 6.5 | GitHub Repo | Community-Version veröffentlichen, README, Contributing Guide |
| 6.6 | Launch Marketing | Reddit r/netsec, Twitter/X, HackerOne, Bug-Bounty-Foren |

**Milestone:** ZeroNyx ist live. Free auf GitHub, Pro zum Kauf.

---

## 9. AI-Integration Details

### Provider-Strategie

| Provider | Use Case | Kosten |
|---|---|---|
| Ollama (lokal) | Default. Offline, Datenschutz, keine API-Kosten | Kostenlos |
| OpenAI GPT-4 | Komplexe Analysen, beste Qualität | Pay-per-Use |
| Anthropic Claude | Starke technische Analyse | Pay-per-Use |
| Eigener Fine-Tuned | Spezialisiert auf Security (Zukunft) | Trainingskosten |

### Datenschutz

- Ollama als Default-Empfehlung (alles lokal)
- Opt-in für Cloud-APIs (User muss explizit bestätigen)
- Data-Sanitization: IPs/Hostnames optional anonymisieren
- Kein Telemetry

### AI-Prompting-Strategie

Jeder AI-Call bekommt strukturierten Kontext:

```
Du bist ein erfahrener Penetrationstester. Analysiere die folgenden Scan-Ergebnisse.

Tool: {tool_name}
Target: {target}
Scan-Typ: {scan_profile}

Ergebnisse:
{parsed_results_json}

Aufgabe:
1. Priorisiere die Findings nach Risiko
2. Identifiziere False Positives
3. Schlage konkrete nächste Schritte vor
4. Bewerte den Gesamtzustand des Targets

Antworte strukturiert im JSON-Format:
{
  "risk_assessment": "...",
  "prioritized_findings": [...],
  "false_positives": [...],
  "next_steps": [...],
  "summary": "..."
}
```

---

## 10. Obsidian-Integration Details

### Export-Struktur (Free)

```
zeronyx-export/
├── README.md               # Projekt-Übersicht
├── Targets/
│   ├── 10.0.0.1.md         # Pro Target eine Datei
│   └── example.com.md
├── Scans/
│   ├── nmap-2024-01-15.md   # Pro Scan eine Datei
│   └── nuclei-2024-01-15.md
├── Findings/
│   ├── CRITICAL-SQLi-login.md
│   └── HIGH-outdated-apache.md
├── Evidence/
│   ├── screenshots/
│   └── requests/
└── Credentials/
    └── found-credentials.md
```

### Markdown-Format mit YAML Frontmatter

```markdown
---
type: finding
severity: critical
cvss: 9.8
cve: CVE-2024-XXXXX
host: 10.0.0.1
port: 443
service: apache/2.4.49
tool: nuclei
status: open
tags: [web, rce, critical]
date: 2024-01-15
---

# SQL Injection in Login Form

## Beschreibung
Gefunden von [[Scans/nuclei-2024-01-15|Nuclei Scan]] auf [[Targets/10.0.0.1]].
...

## Evidence
![[Evidence/screenshots/sqli-login.png]]

## Remediation
...
```

---

## 11. Lizenz- & Geschäftsmodell

| Plan | Preis | Zielgruppe |
|---|---|---|
| Community (Free) | 0 € | Einsteiger, Studenten, GitHub-Community |
| Pro Individual | 149 € / Jahr | Freelancer, Bug-Bounty-Profis |
| Pro Team | 99 € / User / Jahr (min. 3) | Security-Firmen, Red Teams |
| Enterprise | Auf Anfrage | Großunternehmen |

### License-Key-System

- RSA-signiertes JWT mit Ablaufdatum
- Offline-fähig (Key enthält alle Infos)
- Optionale Online-Validierung (1x/Woche, graceful bei Offline)
- Kein aggressives DRM — Security-Leute cracken das sofort, lieber Vertrauen + Mehrwert

### Revenue Streams

1. Pro-Lizenzen (Haupteinnahme)
2. Plugin Marketplace (30% Commission)
3. Enterprise-Lizenzen
4. Optional: Managed Cloud-Version (SaaS, Zukunft)

---

## 12. Wichtige Konventionen für die Entwicklung

### Code-Style

- **Python:** PEP 8, Type Hints überall, async/await für I/O
- **TypeScript:** Strict mode, keine `any` Types, Interfaces statt Types wo möglich
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Branches:** `main` (stable), `develop` (integration), `feature/*`, `bugfix/*`

### Sicherheit der Suite selbst

- Keine Credentials im Klartext speichern (OS Keychain oder verschlüsselt)
- Im Remote/VPS-Modus: Auth-Token für API-Zugang
- HTTPS für Remote-Verbindungen
- Plugins laufen in Sandbox mit Permission-System

### Error Handling

- Backend: Structured Error Responses mit Error Codes
- Frontend: Toast-Notifications für User-facing Errors
- Logging: Strukturiertes Logging (JSON) mit Log-Levels
- Scan-Fehler: Graceful handling, User bekommt klare Fehlermeldung

### Testing

- Backend: pytest, Coverage > 80% für Core-Services
- Frontend: Vitest + React Testing Library
- Integration: Playwright für E2E
- Adapter: Jeder Adapter hat Mock-Tests mit Sample-Output

---

## 13. Nächste Schritte

Wenn du mit Phase 1 beginnst, starte mit diesem Workflow:

1. **Lies diesen gesamten Plan** um den Kontext zu verstehen
2. **Erstelle die Monorepo-Struktur** (Task 1.1)
3. **Arbeite die Tasks sequentiell ab** (1.1 → 1.2 → ... → 1.14)
4. **Bei jedem Task:** Plane erst, implementiere dann, teste zum Schluss
5. **Halte dich an die Konventionen** aus Abschnitt 12

Für jeden einzelnen Task kannst du mich (Claude) um eine detailliertere Planung bitten. Dieser Plan ist der übergeordnete Rahmen — die einzelnen Tasks werden bei Bedarf weiter heruntergebrochen.

---

*ZeroNyx — From Zero to Pwned*
