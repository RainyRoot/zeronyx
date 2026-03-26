import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { BackendManager } from './backend-manager'
import type { IPty } from 'node-pty'

let mainWindow: BrowserWindow | null = null
const backendManager = new BackendManager()

// ---------------------------------------------------------------------------
// PTY session management
// ---------------------------------------------------------------------------

const ptySessions = new Map<string, IPty>()

function setupTerminalIpc(): void {
  // Spawn a new PTY session
  ipcMain.handle('terminal:spawn', async (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    // Kill existing session with same id if it exists
    const existing = ptySessions.get(id)
    if (existing) {
      try { existing.kill() } catch { /* ignore */ }
      ptySessions.delete(id)
    }

    let pty: typeof import('node-pty')
    try {
      pty = await import('node-pty')
    } catch {
      return { success: false, error: 'node-pty not available' }
    }

    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : (process.env['SHELL'] || '/bin/bash')

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: process.env['HOME'] || '/',
      env: process.env as Record<string, string>,
    })

    ptyProcess.onData((data) => {
      mainWindow?.webContents.send(`terminal:data:${id}`, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      mainWindow?.webContents.send(`terminal:exit:${id}`, exitCode)
      ptySessions.delete(id)
    })

    ptySessions.set(id, ptyProcess)
    return { success: true }
  })

  // Write user input to PTY
  ipcMain.on('terminal:write', (_event, { id, data }: { id: string; data: string }) => {
    ptySessions.get(id)?.write(data)
  })

  // Resize PTY on xterm fit
  ipcMain.on('terminal:resize', (_event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptySessions.get(id)?.resize(cols, rows)
  })

  // Kill PTY session
  ipcMain.on('terminal:kill', (_event, { id }: { id: string }) => {
    const proc = ptySessions.get(id)
    if (proc) {
      try { proc.kill() } catch { /* ignore */ }
      ptySessions.delete(id)
    }
  })
}

// ---------------------------------------------------------------------------

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f0f11',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('io.zeronyx')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupTerminalIpc()
  await backendManager.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  // Kill all PTY sessions on exit
  for (const proc of ptySessions.values()) {
    try { proc.kill() } catch { /* ignore */ }
  }
  ptySessions.clear()

  await backendManager.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
