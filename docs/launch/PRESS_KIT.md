# ZeroNyx Press Kit

Everything journalists, bloggers, and community members need to cover or share ZeroNyx.

---

## One-Liner

> ZeroNyx is a desktop-based all-in-one pentesting suite — from reconnaissance to exploitation and reporting in a single, open-source application.

## Short Description (tweet-length)

> ZeroNyx unifies Nmap, Nuclei, SQLMap, Metasploit, mitmproxy, AI analysis, and more in one desktop app. Free, open-source, offline-first. No telemetry.

## Medium Description (2-3 sentences)

> ZeroNyx is an open-source desktop pentesting suite built for professionals. It orchestrates every tool in your engagement — Nmap, Nuclei, Hydra, SQLMap, Metasploit, and more — while adding AI-powered analysis, automated chain workflows, and professional report generation. The Community edition is free forever; Pro ($9/mo) unlocks AI and automation features.

## Full Description

ZeroNyx is a desktop-based all-in-one pentesting suite that unifies the entire penetration testing workflow in a single application. Built with Electron, React, and a Python/FastAPI backend, it orchestrates your existing security tools as subprocesses — parsing their output, normalizing findings, and surfacing actionable intelligence.

**What it replaces:**
- Juggling 10+ terminal windows during an engagement
- Manually correlating findings across different tool outputs
- Writing reports by hand after hours of scanning
- Forgetting which scan you ran and when

**What it adds:**
- Unified scan interface with real-time WebSocket output streaming
- Normalized finding management with CVSS scoring and CVE linkage
- AI analysis via Ollama (local), OpenAI, or Anthropic
- Chain automation for multi-step workflows
- Built-in HTTP(S) proxy with request replay
- Professional HTML/PDF report generation
- Plugin system with SDK and marketplace

ZeroNyx follows a strict "orchestrator, not bundler" philosophy: it never bundles external tool binaries. Your existing Nmap, Nuclei, SQLMap installations work as-is — ZeroNyx just makes them 10x more productive.

---

## Key Facts

| | |
|---|---|
| **Launch date** | 2026 |
| **License** | MIT (Community), Commercial (Pro/Enterprise) |
| **Platform** | Linux, macOS, Windows |
| **Tech stack** | Electron, React, TypeScript, Python, FastAPI, SQLite |
| **Price** | Free / $9/mo / $49/mo |
| **GitHub** | github.com/RainyRoot/zeronyx |
| **Website** | zeronyx.io |
| **Contact** | hello@zeronyx.io |

---

## Integrated Tools

nmap · nuclei · nikto · gobuster · ffuf · hydra · sqlmap · searchsploit · msfconsole · mitmproxy · shodan · censys · ollama · openai · anthropic

---

## Target Audience

- Professional penetration testers
- Bug bounty hunters
- Red team operators
- Security students learning the trade
- Security consultancies (Enterprise tier)

---

## Differentiators vs. Competitors

| | ZeroNyx | Burp Suite | Cobalt Strike | Kali Linux (manual) |
|---|---|---|---|---|
| All-in-one desktop | ✓ | Proxy only | Post-exploit only | No |
| Open source | ✓ | No | No | Yes (tools only) |
| AI analysis | ✓ | No | No | No |
| Local-first | ✓ | ✓ | No | ✓ |
| Plugin SDK | ✓ | ✓ (paid) | No | No |
| Free tier | Full-featured | Limited | No | Tools only |

---

## Quotes

> "I've been waiting for something that actually ties all the tools together without getting in the way. ZeroNyx does exactly that." — Beta tester, senior pentester

> "The AI analysis caught three false positives that would have gone in the report. That alone saves me an hour per engagement." — Beta tester, bug bounty hunter

---

## Screenshots

Screenshots are available at: `docs/launch/screenshots/`

Suggested captions:
1. **Dashboard** — Project overview with active scan count and recent findings
2. **Scan Interface** — Nmap scan running with live output stream
3. **Findings** — Normalized findings grid with severity badges and CVSS scores
4. **AI Analysis** — Scan analyzed with risk prioritization and next steps
5. **Proxy** — HTTP request/response inspector with search
6. **Chains** — Visual chain builder with step configuration
7. **Plugin Marketplace** — Browse and install community plugins
8. **Settings / License** — License activation and tool health

---

## Media Kit Assets

- **Logo SVG** — `docs/launch/assets/logo.svg`
- **Logo PNG (dark bg)** — `docs/launch/assets/logo-dark.png`
- **Logo PNG (light bg)** — `docs/launch/assets/logo-light.png`
- **Banner 1200×630** — `docs/launch/assets/og-banner.png`
- **Icon 512×512** — `docs/launch/assets/icon-512.png`

Brand colors:
- Primary red: `#e53e3e`
- Background: `#0a0a0d`
- Surface: `#111114`
- Accent purple (Pro): `#7c3aed`
