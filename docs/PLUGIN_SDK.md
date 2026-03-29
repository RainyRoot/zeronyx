# ZeroNyx Plugin SDK

Plugins extend ZeroNyx with new functionality. They can add backend logic (Python),
frontend UI components (React), or both.

---

## Quick Start

### 1. Create a plugin directory

```
my-plugin/
├── manifest.json       # Required: plugin metadata
├── main.py             # Backend entry point (optional)
└── dist/
    └── index.js        # Compiled frontend bundle (optional)
```

### 2. Write `manifest.json`

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Does something useful",
  "author": "Your Name",
  "zeronyx_min_version": "0.1.0",
  "type": "both",
  "permissions": ["scan:read", "findings:write"],
  "entry_backend": "main.py",
  "entry_frontend": "dist/index.js",
  "ui_slots": ["scan_result_panel"],
  "hooks": ["on_scan_complete"],
  "settings": {
    "api_key": {
      "type": "string",
      "label": "API Key",
      "description": "Your service API key",
      "required": false,
      "secret": true
    }
  }
}
```

### 3. Write the backend (`main.py`)

```python
from zeronyx_plugin_sdk import ZeroNyxPlugin, PluginContext

class MyPlugin(ZeroNyxPlugin):
    async def on_scan_complete(self, ctx: PluginContext, payload: dict):
        scan_id = payload["scan_id"]
        project_id = payload["project_id"]

        # Read scan results
        scan = await ctx.api.get_scan(scan_id)

        # Create a finding based on results
        await ctx.api.create_finding(project_id, {
            "title": "Custom Finding from MyPlugin",
            "severity": "info",
            "description": f"Processed scan {scan_id}",
            "tool_source": "my-plugin",
        })

# The plugin manager discovers the first ZeroNyxPlugin subclass automatically
plugin = MyPlugin()
```

### 4. Write the frontend (`src/index.tsx`)

```tsx
import React from 'react'

interface Props {
  scanId?: string
  [key: string]: unknown
}

function ScanResultPanel({ scanId }: Props) {
  return (
    <div className="p-4 border-t border-gray-800">
      <h3 className="text-sm font-medium text-gray-300">MyPlugin Output</h3>
      <p className="text-xs text-gray-500 mt-1">Scan ID: {scanId}</p>
    </div>
  )
}

// Register components for each UI slot
const registry = (window as any).__zeronyx_plugins ?? {};
(window as any).__zeronyx_plugins = {
  ...registry,
  'my-plugin': {
    scan_result_panel: ScanResultPanel,
  },
}
```

Build with your preferred bundler (Vite, esbuild, rollup) targeting `iife` or `umd` format.

---

## Manifest Reference

| Field | Type | Required | Description |
|---|---|:---:|---|
| `id` | string | ✓ | Unique kebab-case identifier |
| `name` | string | ✓ | Human-readable name |
| `version` | string | ✓ | Semver string (e.g. `1.2.3`) |
| `description` | string | ✓ | Short description |
| `author` | string | ✓ | Author name |
| `zeronyx_min_version` | string | ✓ | Minimum ZeroNyx version |
| `type` | `backend\|frontend\|both` | | Plugin type (default: `both`) |
| `permissions` | string[] | | Required permissions |
| `entry_backend` | string | | Backend entry point (default: `main.py`) |
| `entry_frontend` | string | | Frontend bundle path (default: `dist/index.js`) |
| `ui_slots` | string[] | | UI slots to render into |
| `hooks` | string[] | | Backend lifecycle hooks |
| `settings` | object | | User-configurable settings schema |

---

## Permissions

| Permission | Description | Risk |
|---|---|---|
| `scan:read` | Read scan results | Low |
| `scan:write` | Create/modify scans | Medium |
| `findings:read` | Read findings | Low |
| `findings:write` | Create/modify findings | Medium |
| `targets:read` | Read targets | Low |
| `targets:write` | Create/modify targets | Medium |
| `credentials:read` | Read stored credentials | **High** |
| `credentials:write` | Write credentials | **High** |
| `hosts:read` | Read host data | Low |
| `proxy:read` | Read proxy history | Medium |
| `settings:read` | Read app settings | Medium |
| `network:outbound` | Make outbound HTTP requests | **High** |
| `filesystem:read` | Read local files | **High** |
| `filesystem:write` | Write local files | **High** |

Request only the permissions your plugin actually needs.
Users will see a permission dialog when granting access to your plugin.

---

## UI Slots

| Slot | Description | Context props |
|---|---|---|
| `sidebar_nav` | Extra icon in the sidebar | — |
| `dashboard_widget` | Widget on the dashboard | `projectId` |
| `scan_result_panel` | Panel below scan results | `scanId`, `tool` |
| `finding_detail_panel` | Panel in finding detail view | `findingId` |
| `target_panel` | Panel in target detail view | `targetId` |
| `toolbar_action` | Button in the toolbar | `projectId` |
| `settings_tab` | Extra tab in Settings | — |
| `report_section` | Section in generated reports | `projectId` |

---

## Backend Hooks

| Hook | When | Payload |
|---|---|---|
| `on_scan_complete` | After any scan finishes | `scan_id`, `project_id`, `tool`, `target`, `status` |
| `on_finding_created` | After a finding is saved | `finding_id`, `project_id`, `title`, `severity`, `tool_source` |
| `on_target_added` | After a target is added | `target_id`, `project_id`, `value`, `type` |
| `on_project_opened` | When a project is switched to | `project_id`, `project_name` |
| `on_report_generate` | During report generation | `project_id`, `report_type` |

---

## Packaging

Package your plugin as a `.zeronyx-plugin` file (renamed zip archive):

```bash
cd my-plugin/
zip -r my-plugin.zeronyx-plugin .
```

Users can drag-and-drop this file into the Plugins page to install.

---

## Plugin Data Directory

Plugins get a writable data directory via `ctx.data_dir`:

```python
import json, os

async def on_scan_complete(self, ctx, payload):
    cache_file = os.path.join(ctx.data_dir, "cache.json")
    ...
```

Path: `~/.zeronyx/plugins/<plugin-id>/data/`

---

## Example Plugins

See [`plugins/examples/`](../plugins/examples/) for reference implementations:

- **whois-lookup** — WHOIS domain/IP lookup on target add
- **cve-search** — CVE database search on scan complete
- **export-csv** — Export findings to CSV via toolbar action
