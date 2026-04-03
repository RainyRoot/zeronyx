# ZeroNyx

**From Zero to Pwned** - a desktop-based all-in-one pentesting suite for professionals.

ZeroNyx unifies your entire pentest workflow in a single application: reconnaissance, vulnerability scanning, exploitation, credential management, and report generation - all backed by a local Python/FastAPI engine and a React/Electron UI.

---

## Features

| Category | What's included |
|---|---|
| **Scanning** | Nmap, Nuclei, Nikto, Gobuster/ffuf, Hydra, SQLMap, SearchSploit |
| **Advanced** | Metasploit integration, HTTP(S) proxy (mitmproxy), Shodan/Censys OSINT |
| **AI Analysis** | Ollama (local), OpenAI, Anthropic — risk prioritization, false-positive detection, report generation |
| **Automation** | Chain Engine — multi-step workflows triggered on scan completion or schedule |
| **Management** | Unified findings, credential store, scan history, target scope |
| **Reporting** | HTML/PDF reports with AI-generated executive summaries |
| **Plugins** | Full plugin system with SDK, marketplace, and permission model |
| **Integration** | Obsidian vault sync, auto-updater, keyboard shortcuts |

---

## Quick Start

### 1. Download

Grab the latest release from [GitHub Releases](https://github.com/RainyRoot/zeronyx/releases):

| Platform | File |
|---|---|
| Linux | `.AppImage` or `.deb` |
| macOS | `.dmg` |
| Windows | `.exe` installer |

### 2. Install external tools

ZeroNyx wraps external tools as subprocesses - install them via your package manager:

```bash
# Kali / Debian / Ubuntu
sudo apt install nmap nuclei nikto gobuster hydra sqlmap exploitdb

# macOS
brew install nmap hydra sqlmap
```

### 3. Docker (no installation required)

The Docker image runs the full ZeroNyx web UI + backend in a single container. Open your browser at `http://localhost:8742` once it starts.

**Docker Compose (recommended):**

```bash
curl -O https://raw.githubusercontent.com/RainyRoot/zeronyx/main/docker-compose.yml
docker compose up -d
```

**Plain Docker:**

```bash
docker pull ghcr.io/rainyroot/zeronyx:latest
docker run -d \
  --name zeronyx \
  -p 8742:8742 \
  -v zeronyx-data:/data \
  ghcr.io/rainyroot/zeronyx:latest
```

**Available image tags:**

| Tag | Source |
|---|---|
| `latest` | Latest stable build from `main` |
| `dev` | Latest development build from `dev` |
| `sha-<commit>` | Specific commit build |

**Data persistence:**

All project databases and settings are stored in the `/data` volume. Mount it to a host path to keep data across container recreations:

```bash
docker run -d \
  --name zeronyx \
  -p 8742:8742 \
  -v /path/on/host:/data \
  ghcr.io/rainyroot/zeronyx:latest
```

**Configuration via environment variables:**

| Variable | Default | Description |
|---|---|---|
| `ZERONYX_PORT` | `8742` | Port the server listens on |
| `ZERONYX_DATA_DIR` | `/data` | Where SQLite databases are stored |
| `ZERONYX_ENV` | `production` | Set to `development` to enable API docs at `/docs` |

> **Note:** The Docker image includes the web UI and backend API only. Scanning tools (nmap, nuclei, etc.) are not bundled — install them in the container or use the desktop Electron release for full tool integration.

### 4. Run from source (development)

```bash
git clone https://github.com/RainyRoot/zeronyx.git
cd zeronyx

# Install frontend dependencies
npm install

# Set up Python backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Start dev server (frontend + backend)
npm run dev
```

---

## Architecture

```
Electron Shell (Main Process)
  └─ React Frontend (Renderer)
       └─ REST + WebSocket ──► Python FastAPI Backend
                                    └─ subprocess calls
                                         └─ nmap, nuclei, sqlmap, ...
```

- **Frontend:** React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **Desktop:** Electron 33 + electron-builder
- **State:** Zustand
- **Database:** SQLite (one `.db` per project)

---

## Project Structure

```
zeronyx/
├── electron/          # Electron main process
├── frontend/          # React app (Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── stores/    # Zustand state
│       └── types/
├── backend/           # Python FastAPI backend
│   ├── adapters/      # Tool adapters (nmap, nuclei, ...)
│   ├── api/routes/    # REST endpoints
│   ├── models/        # SQLAlchemy models
│   ├── services/      # Business logic
│   └── migrations/    # Alembic migrations
├── plugins/           # Plugin SDK + example plugins
├── docs/              # Architecture docs + Plugin SDK reference
├── scripts/           # Build, dev, setup scripts
└── website/           # Landing page
```

---

## Editions

| Feature | Community (Free) | Pro ($9/mo) | Enterprise ($49/mo) |
|---|:---:|:---:|:---:|
| All scanning tools | ✓ | ✓ | ✓ |
| Findings management | ✓ | ✓ | ✓ |
| HTTP(S) Proxy | ✓ | ✓ | ✓ |
| Credential store | ✓ | ✓ | ✓ |
| Basic HTML reports | ✓ | ✓ | ✓ |
| Plugin installation | ✓ | ✓ | ✓ |
| AI Analysis | — | ✓ | ✓ |
| Chain Automation | — | ✓ | ✓ |
| Obsidian Auto-Sync | — | ✓ | ✓ |
| Plugin Marketplace | — | ✓ | ✓ |
| Advanced PDF reports | — | ✓ | ✓ |
| Team / multi-user | — | — | ✓ |
| Custom report branding | — | — | ✓ |

[**Get Pro →**](https://zeronyx.io/#pricing)

---

## Plugin SDK

ZeroNyx has a first-class plugin system. Build your own integrations:

```python
from zeronyx.sdk import ZeroNyxPlugin, PluginContext

class MyPlugin(ZeroNyxPlugin):
    async def on_scan_complete(self, ctx: PluginContext) -> None:
        findings = await ctx.api.get_findings(ctx.scan.id)
        # do something with findings...
```

Full documentation: [docs/PLUGIN_SDK.md](docs/PLUGIN_SDK.md)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Bug reports and feature requests go to [GitHub Issues](https://github.com/RainyRoot/zeronyx/issues).

---

## License

The **Community edition** is released under the [MIT License](LICENSE).

The **Pro and Enterprise** editions require a paid license key. See [zeronyx.io/#pricing](https://zeronyx.io/#pricing).

---

## Disclaimer

ZeroNyx is intended for authorized security testing only. Use it only against systems you own or have explicit written permission to test. The authors accept no liability for misuse.
