# ZeroNyx — Build Progress

> Chronologisches Log aller abgeschlossenen Tasks.
> Wird von Claude Code am Ende jedes Tasks automatisch erweitert.

---

## Phase 1: Foundation

### ✅ Task 1.1 — Electron + React + TS Boilerplate
**Datum:** 2026-03-25 | **Branch:** `dev`

| Datei | Zweck |
|---|---|
| [electron/main.ts](electron/main.ts) | Electron Main Process, Window-Management, Backend-Start |
| [electron/preload.ts](electron/preload.ts) | Context Bridge, sichere IPC-API für Renderer |
| [electron/backend-manager.ts](electron/backend-manager.ts) | Python-Backend starten/stoppen/health-check |
| [electron.vite.config.ts](electron.vite.config.ts) | Build-Pipeline, Hot Reload, Tailwind CSS inline config |
| [frontend/index.html](frontend/index.html) | HTML Entry mit CSP-Header |
| [frontend/src/main.tsx](frontend/src/main.tsx) | React 18 Entry Point |
| [frontend/src/App.tsx](frontend/src/App.tsx) | App Root Component (Placeholder) |
| [frontend/src/index.css](frontend/src/index.css) | Tailwind Base Styles |
| [frontend/tailwind.config.ts](frontend/tailwind.config.ts) | Tailwind Theme-Config (brand colors) |
| [frontend/package.json](frontend/package.json) | Frontend Workspace (React, Zustand, Tailwind) |
| [backend/main.py](backend/main.py) | FastAPI Placeholder mit `/health` Endpoint |
| [backend/requirements.txt](backend/requirements.txt) | Python Dependencies |
| [scripts/setup.sh](scripts/setup.sh) | Erstinstallation (npm install + Python venv) |
| [scripts/dev.sh](scripts/dev.sh) | Backend standalone starten (für API-Tests) |
| [package.json](package.json) | Root Monorepo, npm workspaces, electron-builder config |
| [tsconfig.json](tsconfig.json) / [tsconfig.node.json](tsconfig.node.json) | TypeScript Project References |

---

### ✅ Task 1.2 — Dark Theme UI Shell
**Datum:** 2026-03-25 | **Branch:** `dev`

| Datei | Zweck |
|---|---|
| [frontend/src/lib/utils.ts](frontend/src/lib/utils.ts) | `cn()` Utility (clsx + tailwind-merge) |
| [frontend/src/types/index.ts](frontend/src/types/index.ts) | Shared TypeScript Types (Tab, PageId, BackendStatus) |
| [frontend/src/stores/navigationStore.ts](frontend/src/stores/navigationStore.ts) | Zustand Store: Tab-Management, Navigation State |
| [frontend/src/components/layout/Sidebar.tsx](frontend/src/components/layout/Sidebar.tsx) | Schmale Icon-Sidebar mit Radix Tooltips, aktiver State |
| [frontend/src/components/layout/TabBar.tsx](frontend/src/components/layout/TabBar.tsx) | Browser-artiger Tab-System mit Close-Button |
| [frontend/src/components/layout/StatusBar.tsx](frontend/src/components/layout/StatusBar.tsx) | Statusleiste: Backend-Status, Projektname, Version |
| [frontend/src/components/layout/AppShell.tsx](frontend/src/components/layout/AppShell.tsx) | Layout-Wrapper mit React Router `<Outlet>` |
| [frontend/src/pages/Dashboard/index.tsx](frontend/src/pages/Dashboard/index.tsx) | Dashboard Stub (Stat-Karten) |
| [frontend/src/pages/Targets/index.tsx](frontend/src/pages/Targets/index.tsx) | Targets Stub |
| [frontend/src/pages/Scans/index.tsx](frontend/src/pages/Scans/index.tsx) | Scans Stub |
| [frontend/src/pages/Findings/index.tsx](frontend/src/pages/Findings/index.tsx) | Findings Stub |
| [frontend/src/pages/Reports/index.tsx](frontend/src/pages/Reports/index.tsx) | Reports Stub |
| [frontend/src/pages/Settings/index.tsx](frontend/src/pages/Settings/index.tsx) | Settings Stub |
| [frontend/src/App.tsx](frontend/src/App.tsx) | HashRouter + Routes + Backend-Health-Polling |

---
