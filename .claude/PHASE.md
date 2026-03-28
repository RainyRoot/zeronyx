# ZeroNyx — Aktueller Entwicklungsstand

## Phase 1: Foundation

| # | Task | Status | Branch | Datum |
|---|---|:---:|---|---|
| 1.1 | Electron + React + TS Boilerplate | ✅ | dev | 2026-03-25 |
| 1.2 | Dark Theme UI Shell | ✅ | dev | 2026-03-25 |
| 1.3 | Python Backend Setup | ✅ | dev | 2026-03-25 |
| 1.4 | WebSocket Bridge | ✅ | dev | 2026-03-25 |
| 1.5 | REST API Foundation | ✅ | dev | 2026-03-25 |
| 1.6 | Datenbank + Migrations | ✅ | dev | 2026-03-25 |
| 1.7 | Projekt-Management UI | ✅ | dev | 2026-03-25 |
| 1.8 | Target-Management | ✅ | dev | 2026-03-25 |
| 1.9 | Tool-Adapter Base Class | ✅ | dev | 2026-03-25 |
| 1.10 | Nmap Adapter | ✅ | dev | 2026-03-25 |
| 1.11 | Nmap UI | ✅ | dev | 2026-03-25 |
| 1.12 | Tool Health Check | ✅ | dev | 2026-03-25 |
| 1.13 | Settings/Config | ✅ | dev | 2026-03-25 |
| 1.14 | Testing + Bugfixing | ✅ | dev | 2026-03-25 |

---

## Phase 2: Core Tools

**Ziel:** Alle Free-Tier Tools integriert, Unified Scan Interface, Scan-History, Credential Store.

**Architektur-Entscheidungen für Phase 2:**
- **Unified Scan Interface**: "New Scan" mit Tool-Auswahl statt einzelner Pages pro Tool
- **Tool-Badge System**: Farbige Badges in der History (Nuclei=rot, Nikto=orange, etc.)
- **SearchSploit Auto-Lookup**: Nach Nmap-Scan automatisch SearchSploit im Hintergrund
- **Credential Store**: Credentials direkt in Hydra-Folge-Scans verwendbar

| # | Task | Status | Branch | Datum |
|---|---|:---:|---|---|
| 2.1 | Gobuster/ffuf Adapter + UI | ✅ | dev | 2026-03-25 |
| 2.2 | Nuclei Adapter + UI | ✅ | dev | 2026-03-26 |
| 2.3 | Nikto Adapter + UI | ✅ | dev | 2026-03-26 |
| 2.4 | Hydra Adapter + UI | ✅ | dev | 2026-03-26 |
| 2.5 | SearchSploit Adapter + UI + Auto-Lookup | ✅ | dev | 2026-03-26 |
| 2.6 | Terminal-Emulator (xterm.js) | ✅ | dev | 2026-03-26 |
| 2.7 | Target-Management erweitern (Bulk, CIDR, Scope) | ✅ | dev | 2026-03-27 |
| 2.8 | Scan-History (Timeline, Filter, Re-Run) | ✅ | dev | 2026-03-27 |
| 2.9 | Basic Obsidian-Export | ✅ | dev | 2026-03-27 |
| 2.10 | Credential Store | ✅ | dev | 2026-03-27 |

**Milestone:** Kompletter Basis-Pentest durchführbar. Alle Free-Tools funktionieren. Unified Scan Interface.

---

## Phase 3: Advanced Tools & Proxy

**Ziel:** Proxy/Interceptor und Metasploit, Cross-Tool-Korrelation.

| # | Task | Status | Branch | Datum |
|---|---|:---:|---|---|
| 3.1 | HTTP(S) Proxy (mitmproxy) | ✅ | dev | 2026-03-27 |
| 3.2 | Proxy UI | ✅ | dev | 2026-03-27 |
| 3.3 | Proxy Pro Features (Modify, Replay) | ✅ | dev | 2026-03-27 |
| 3.4 | Metasploit Adapter | ✅ | dev | 2026-03-27 |
| 3.5 | Metasploit UI | ✅ | dev | 2026-03-27 |
| 3.6 | SQLMap Adapter + UI | ✅ | dev | 2026-03-28 |
| 3.7 | Shodan Adapter + UI | ✅ | dev | 2026-03-28 |
| 3.8 | Censys Adapter + UI | ✅ | dev | 2026-03-28 |
| 3.9 | Finding-Normalisierung | ✅ | dev | 2026-03-28 |
| 3.10 | Cross-Tool-Korrelation | ✅ | dev | 2026-03-28 |

---

## Phase 4: AI & Automation

**Ziel:** AI-Features und Chain-Engine für Pro-Version.

| # | Task | Status | Branch | Datum |
|---|---|:---:|---|---|
| 4.1 | AI Service (Ollama, OpenAI, Anthropic) + DB + Settings | ✅ | dev | 2026-03-28 |
| 4.2 | AI Scan-Analyse Button + Result Panel | ✅ | dev | 2026-03-28 |
| 4.3 | AI Exploit-Empfehlungen | ✅ | dev | 2026-03-28 |
| 4.4 | AI False-Positive-Erkennung | ✅ | dev | 2026-03-28 |
| 4.5 | Chain Engine + DB Model | ✅ | dev | 2026-03-28 |
| 4.6 | Standard-Chains (Quick Recon, Full Web Audit, Network Sweep, Credential Attack) | ✅ | dev | 2026-03-28 |
| 4.7 | AI Report-Generierung | ✅ | dev | 2026-03-28 |
| 4.8 | Obsidian Auto-Sync | ✅ | dev | 2026-03-28 |
| 4.9 | Data Sanitization | ✅ | dev | 2026-03-28 |

---

## Phase 5: Plugin-System & Polish

**Ziel:** Plugin-System, UI-Polish, Performance, Auto-Update.

| # | Task | Status | Branch | Datum |
|---|---|:---:|---|---|
| 5.1 | Plugin Manifest Spec (JSON Schema + TS/Python types) | ✅ | dev | 2026-03-28 |
| 5.2 | Plugin Loader Backend (service, REST routes, hook system) | ✅ | dev | 2026-03-28 |
| 5.3 | Plugin UI Slots (PluginSlot, plugin store, plugins page) | ✅ | dev | 2026-03-28 |
| 5.4 | Plugin Permission System (dialog, risk levels) | ✅ | dev | 2026-03-28 |
| 5.5 | Plugin SDK + Docs (Python base class, PLUGIN_SDK.md) | ✅ | dev | 2026-03-28 |
| 5.6 | 3 Example Plugins (whois-lookup, cve-search, export-csv) | ✅ | dev | 2026-03-28 |
| 5.7 | UI/UX Polish (shortcuts, toasts, empty states, skeletons) | ✅ | dev | 2026-03-28 |
| 5.8 | Performance Optimierung (virtual lists, React.memo) | ✅ | dev | 2026-03-28 |
| 5.9 | Auto-Updater (electron-updater, GitHub releases) | ✅ | dev | 2026-03-28 |

---

## Phasen-Übersicht

| Phase | Titel | Status |
|---|---|:---:|
| 1 | Foundation | ✅ |
| 2 | Core Tools | ✅ |
| 3 | Advanced Tools & Proxy | ✅ |
| 4 | AI & Automation | ✅ |
| 5 | Plugin-System & Polish | ✅ |
| 6 | Launch & Marketplace | ⏳ |

---

## Legende
- ✅ Abgeschlossen
- 🔄 In Arbeit
- ⏳ Ausstehend
