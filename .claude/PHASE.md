# ZERONYX — Phase Tracker

> **Anweisung an Claude Code:** Lies diese Datei zu Beginn jeder Session. Sie zeigt dir was bereits erledigt ist, wo wir gerade stehen und was der nächste Task ist. Wenn du einen Task abschließt, setze das Häkchen von `[ ]` auf `[x]` und trage das Datum ein. Ändere den Status der aktuellen Phase entsprechend. Lies MASTERPLAN.md für den vollständigen Kontext zu jedem Task.

---

## Aktueller Stand

| Info | Wert |
|---|---|
| **Aktuelle Phase** | Phase 1: Foundation |
| **Aktueller Task** | 1.3 — Python Backend Setup |
| **Gesamtfortschritt** | 2 / 59 Tasks |
| **Letztes Update** | 2026-03-25 |

---

## Phase 1: Foundation ⏳

**Status:** `IN PROGRESS` | **Fortschritt:** 2/14
**Ziel:** Lauffähige Desktop-App mit Grundstruktur, Nmap als erstes Tool integriert.
**Milestone:** Projekt erstellen → Nmap-Scan starten → Live-Output sehen → Ergebnisse in Tabelle.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 1.1 | Electron + React + TS Boilerplate aufsetzen, Build-Pipeline, Hot Reload | ✅ | 2026-03-25 | electron-vite, npm workspaces, Tailwind inline config |
| 1.2 | Dark Theme UI Shell: Tailwind + shadcn/ui, Sidebar, Tabs, StatusBar | ✅ | 2026-03-25 | HashRouter, Zustand nav store, Radix Tooltips |
| 1.3 | Python Backend Setup: FastAPI, Projektstruktur, Auto-Start durch Electron | ⬜ | — | |
| 1.4 | WebSocket Bridge: Frontend ↔ Backend, Reconnect-Logic, Message-Protocol | ⬜ | — | |
| 1.5 | REST API Foundation: Basis-Endpoints, Error Handling, CORS | ⬜ | — | |
| 1.6 | Datenbank + Migrations: SQLite + SQLAlchemy Models + Alembic | ⬜ | — | |
| 1.7 | Projekt-Management UI: Erstellen, Öffnen, Löschen, Dashboard | ⬜ | — | |
| 1.8 | Target-Management: Targets hinzufügen, Scope definieren | ⬜ | — | |
| 1.9 | Tool-Adapter Base Class: Abstract Python Class (start/stop/parse/stream) | ⬜ | — | |
| 1.10 | Nmap Adapter: Subprocess starten, XML parsen, Findings extrahieren | ⬜ | — | |
| 1.11 | Nmap UI: Scan-Formular, Live-Terminal-Output, Ergebnis-Tabelle | ⬜ | — | |
| 1.12 | Tool Health Check: Beim Start prüfen welche Tools installiert sind | ⬜ | — | |
| 1.13 | Settings/Config: App-Settings (Pfade, Theme, Tool-Pfade) | ⬜ | — | |
| 1.14 | Testing + Bugfixing: Unit Tests Backend, E2E kritische Flows | ⬜ | — | |

**Phase 1 abgeschlossen:** ⬜ — Datum: —

---

## Phase 2: Core Tools ⏳

**Status:** `WARTET AUF PHASE 1` | **Fortschritt:** 0/10
**Ziel:** Alle Free-Tier Tools integriert, grundlegende UI komplett.
**Milestone:** Kompletter Basis-Pentest durchführbar. Alle Free-Tools funktionieren.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 2.1 | Gobuster/ffuf Adapter + UI (Directory Bruteforce, Wordlist-Auswahl) | ⬜ | — | |
| 2.2 | Nuclei Adapter + UI (Vulnerability Scanning, Template-Manager) | ⬜ | — | |
| 2.3 | Nikto Adapter + UI (Web-Server Scanner) | ⬜ | — | |
| 2.4 | Hydra Adapter + UI (Credential Attacks, Service-Auswahl) | ⬜ | — | |
| 2.5 | SearchSploit Adapter + UI (Exploit-Suche, Auto-Lookup nach Nmap) | ⬜ | — | |
| 2.6 | Terminal-Emulator einbetten (xterm.js für direkte CLI-Nutzung) | ⬜ | — | |
| 2.7 | Target-Management erweitern (Bulk-Import, CIDR, Scope-Validation) | ⬜ | — | |
| 2.8 | Scan-History (Alle Scans anzeigen, filtern, erneut starten) | ⬜ | — | |
| 2.9 | Basic Obsidian-Export (Markdown + Wikilinks + YAML Frontmatter) | ⬜ | — | |
| 2.10 | Credential Store (Gefundene Credentials zentral verwalten) | ⬜ | — | |

**Phase 2 abgeschlossen:** ⬜ — Datum: —

---

## Phase 3: Advanced Tools & Proxy ⏳

**Status:** `WARTET AUF PHASE 2` | **Fortschritt:** 0/10
**Ziel:** Proxy/Interceptor, Metasploit, SQLMap, Shodan, Cross-Tool-Korrelation.
**Milestone:** Vollständiger Pentest-Workflow inkl. Web-Testing und Exploitation.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 3.1 | HTTP(S) Proxy auf Basis mitmproxy (Request/Response Logging) | ⬜ | — | |
| 3.2 | Proxy UI: Split-View, History, Filter, Search | ⬜ | — | |
| 3.3 | Proxy Pro Features: Request Modify, Replay, Intruder-ähnlich | ⬜ | — | |
| 3.4 | Metasploit Adapter: msfrpcd Connection, Module Browser | ⬜ | — | |
| 3.5 | Metasploit UI: Module suchen, Auxiliary (Free), Exploit+Sessions (Pro) | ⬜ | — | |
| 3.6 | SQLMap Adapter + UI (Injection Testing, Proxy-Request-Übernahme) | ⬜ | — | |
| 3.7 | Shodan Adapter + UI (Passive Recon, API-Key-Management) | ⬜ | — | |
| 3.8 | Censys Adapter + UI (Alternative/Ergänzung zu Shodan) | ⬜ | — | |
| 3.9 | Finding-Normalisierung (Alle Tools → einheitliches Finding-Modell) | ⬜ | — | |
| 3.10 | Cross-Tool-Korrelation Pro (Hosts/Ports/Vulns zusammenführen) | ⬜ | — | |

**Phase 3 abgeschlossen:** ⬜ — Datum: —

---

## Phase 4: AI & Automation ⏳

**Status:** `WARTET AUF PHASE 3` | **Fortschritt:** 0/9
**Ziel:** AI-Features und Chain-Engine für Pro-Version.
**Milestone:** AI analysiert Ergebnisse, Chains automatisieren Workflows, Reports werden generiert.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 4.1 | AI Service: Provider-Abstraktion (Ollama, OpenAI, Claude) | ⬜ | — | |
| 4.2 | AI Scan-Analyse ("AI Analyse" Button nach jedem Scan) | ⬜ | — | |
| 4.3 | AI Exploit-Empfehlungen (basierend auf Services/Versionen) | ⬜ | — | |
| 4.4 | AI False-Positive-Erkennung (AI bewertet Findings) | ⬜ | — | |
| 4.5 | Chain Engine Pro (Definierbare Workflows: Scan A → Parse → Scan B) | ⬜ | — | |
| 4.6 | Standard-Chains (Quick Recon, Full Web Audit, Network Sweep) | ⬜ | — | |
| 4.7 | AI Report-Generierung Pro (Executive Summary + Tech Details) | ⬜ | — | |
| 4.8 | Obsidian Auto-Sync Pro (Echtzeit-Sync ins Vault) | ⬜ | — | |
| 4.9 | Data Sanitization (IPs/Hostnames anonymisieren vor Cloud-APIs) | ⬜ | — | |

**Phase 4 abgeschlossen:** ⬜ — Datum: —

---

## Phase 5: Plugin-System & Polish ⏳

**Status:** `WARTET AUF PHASE 4` | **Fortschritt:** 0/9
**Ziel:** Plugin-System, UI-Polish, Performance.
**Milestone:** Plugin-System funktioniert, App fühlt sich polished an.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 5.1 | Plugin Manifest Spec (manifest.json Format definieren) | ⬜ | — | |
| 5.2 | Plugin Loader Backend (Python-Plugins laden, validieren, sandboxen) | ⬜ | — | |
| 5.3 | Plugin UI Slots Frontend (Bereiche wo Plugins React-Komponenten rendern) | ⬜ | — | |
| 5.4 | Plugin Permission System (Deklarative Permissions, User-Bestätigung) | ⬜ | — | |
| 5.5 | Plugin SDK + Docs (Dokumentation + Beispiele für Entwickler) | ⬜ | — | |
| 5.6 | 3-5 Beispiel-Plugins als Referenz-Implementierung | ⬜ | — | |
| 5.7 | UI/UX Polish (Animationen, Keyboard Shortcuts, Accessibility) | ⬜ | — | |
| 5.8 | Performance-Optimierung (Große Scans, virtualisierte Listen, Memory) | ⬜ | — | |
| 5.9 | Auto-Updater (Electron auto-update) | ⬜ | — | |

**Phase 5 abgeschlossen:** ⬜ — Datum: —

---

## Phase 6: Launch & Marketplace ⏳

**Status:** `WARTET AUF PHASE 5` | **Fortschritt:** 0/7
**Ziel:** Öffentlicher Launch, Marketplace, Lizenz-System.
**Milestone:** ZeroNyx ist live. Free auf GitHub, Pro zum Kauf.

| # | Task | Status | Erledigt am | Notizen |
|---|---|---|---|---|
| 6.1 | Lizenz-System (RSA-signierte License Keys, Offline-fähig) | ⬜ | — | |
| 6.2 | Payment Integration (Stripe oder Paddle) | ⬜ | — | |
| 6.3 | Plugin Marketplace Backend + Frontend | ⬜ | — | |
| 6.4 | Website (Landing Page, Docs, Download-Seite) | ⬜ | — | |
| 6.5 | GitHub Repo aufsetzen (Community-Version, README, Contributing) | ⬜ | — | |
| 6.6 | Launch Marketing (Reddit, Twitter/X, HackerOne, Foren) | ⬜ | — | |
| 6.7 | Finale QA + Security-Audit der Suite selbst | ⬜ | — | |

**Phase 6 abgeschlossen:** ⬜ — Datum: —

---

## Änderungslog

> Claude Code: Trage hier jede abgeschlossene Session ein mit Datum und was gemacht wurde.

| Datum | Phase | Tasks | Zusammenfassung |
|---|---|---|---|
| 2026-03-25 | Phase 1 | 1.1 | Electron + React + TS Boilerplate: electron-vite, npm workspaces, Tailwind, FastAPI placeholder, Build-Pipeline ✓ |
| 2026-03-25 | Phase 1 | 1.2 | Dark Theme UI Shell: Sidebar, TabBar, StatusBar, AppShell, 6 Page-Stubs, React Router, Zustand nav store ✓ |

---

## Blocker & offene Fragen

> Claude Code: Trage hier Probleme ein die den Fortschritt blockieren oder Entscheidungen die vom User getroffen werden müssen.

| # | Beschreibung | Status | Gelöst am |
|---|---|---|---|
| — | Noch keine Blocker | — | — |

---

## Entscheidungen

> Claude Code: Dokumentiere hier wichtige Architektur- oder Design-Entscheidungen die während der Entwicklung getroffen werden, damit spätere Sessions den Kontext haben.

| # | Datum | Entscheidung | Begründung |
|---|---|---|---|
| D1 | 2026-03-25 | Electron + React + TS Frontend, Python/FastAPI Backend | Beste Kombination aus Security-Tool-Ecosystem (Python) und moderner UI (React) |
| D2 | 2026-03-25 | Alle Tools als Subprocess, nie einbetten | GPL-Compliance, saubere Trennung |
| D3 | 2026-03-25 | SQLite pro Projekt, eine .db Datei | Portabilität, einfaches Backup/Sharing |
| D4 | 2026-03-25 | Ollama als Default-AI-Provider | Datenschutz, keine Kosten, offline-fähig |
| D5 | 2026-03-25 | Plugin-System von Anfang an einplanen | Architektur muss Plugin-Slots vorsehen, nachträglich schwer |

---

*Referenz: Lies MASTERPLAN.md für vollständige Details zu jedem Task, Architektur, DB-Schema und Konventionen.*
