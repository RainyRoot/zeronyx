/**
 * ZeroNyx Auto-Updater
 *
 * Uses electron-updater (update-electron-app / autoUpdater) to check for
 * new releases from the configured GitHub releases feed.
 *
 * Update flow:
 *   1. On startup, check for updates (silently).
 *   2. If an update is available, notify the renderer via IPC.
 *   3. Download in the background while the user works.
 *   4. Show a dialog asking to install + restart, or defer.
 *   5. On manual trigger (Settings → About → Check for Updates), repeat.
 *
 * Release configuration (electron-builder):
 *   publish:
 *     provider: github
 *     owner: RainyRoot
 *     repo: zeronyx
 */

import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'

let updateCheckInProgress = false

export function setupAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // Don't run updates in dev mode
  if (is.dev) {
    setupIpcHandlers(getMainWindow)
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  // ---------------------------------------------------------------------------
  // Updater events
  // ---------------------------------------------------------------------------

  autoUpdater.on('checking-for-update', () => {
    updateCheckInProgress = true
    getMainWindow()?.webContents.send('updater:checking')
  })

  autoUpdater.on('update-available', (info) => {
    getMainWindow()?.webContents.send('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? '',
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    updateCheckInProgress = false
    getMainWindow()?.webContents.send('updater:not-available', {
      version: info.version,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    getMainWindow()?.webContents.send('updater:progress', {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', async (info) => {
    updateCheckInProgress = false
    getMainWindow()?.webContents.send('updater:downloaded', {
      version: info.version,
    })

    const win = getMainWindow()
    if (!win) {
      autoUpdater.quitAndInstall()
      return
    }

    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'ZeroNyx Update Ready',
      message: `ZeroNyx ${info.version} is ready to install.`,
      detail: 'Restart now to apply the update, or defer until next launch.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })

    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    updateCheckInProgress = false
    getMainWindow()?.webContents.send('updater:error', {
      message: err.message,
    })
  })

  // ---------------------------------------------------------------------------
  // IPC handlers
  // ---------------------------------------------------------------------------

  setupIpcHandlers(getMainWindow)

  // Check on startup after a short delay (let the app settle)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { /* silent */ })
  }, 8000)
}


function setupIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('updater:check', async () => {
    if (is.dev) {
      return { dev: true, message: 'Auto-update disabled in dev mode.' }
    }
    if (updateCheckInProgress) {
      return { inProgress: true }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (err) {
      return { error: (err as Error).message }
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })
}
