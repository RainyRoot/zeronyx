import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'

const BACKEND_PORT = 8742
const BACKEND_STARTUP_TIMEOUT_MS = 15000
const BACKEND_HEALTH_POLL_MS = 300

export class BackendManager {
  private process: ChildProcess | null = null
  private readonly port: number = BACKEND_PORT

  async start(): Promise<void> {
    if (this.process) return

    ipcMain.handle('backend:getPort', () => this.port)

    const pythonPath = this.resolvePythonPath()
    const cwd = this.resolveBackendCwd()
    const args = is.dev
      ? ['-m', 'backend.main', '--port', String(this.port)]
      : [join(cwd, 'backend', 'main.py'), '--port', String(this.port)]

    console.log(`[BackendManager] Starting: ${pythonPath} ${args.join(' ')} (cwd: ${cwd})`)

    this.process = spawn(pythonPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ZERONYX_ENV: is.dev ? 'development' : 'production',
        ZERONYX_PORT: String(this.port)
      }
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[Backend] ${data.toString().trim()}\n`)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[Backend] ${data.toString().trim()}\n`)
    })

    this.process.on('exit', (code) => {
      console.log(`[BackendManager] Process exited with code ${code}`)
      this.process = null
    })

    await this.waitForHealthy()
  }

  async stop(): Promise<void> {
    if (!this.process) return
    console.log('[BackendManager] Stopping backend...')
    this.process.kill('SIGTERM')
    this.process = null
  }

  getPort(): number {
    return this.port
  }

  private resolvePythonPath(): string {
    if (is.dev) {
      const venvPython = join(process.cwd(), 'backend', '.venv', 'bin', 'python3')
      if (existsSync(venvPython)) return venvPython
      return 'python3'
    }
    return process.platform === 'win32' ? 'python' : 'python3'
  }

  private resolveBackendCwd(): string {
    if (is.dev) {
      return process.cwd()
    }
    return join(app.getAppPath(), '..')
  }

  private async waitForHealthy(): Promise<void> {
    const deadline = Date.now() + BACKEND_STARTUP_TIMEOUT_MS
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`)
        if (res.ok) {
          console.log('[BackendManager] Backend is healthy.')
          return
        }
      } catch {
        await new Promise((r) => setTimeout(r, BACKEND_HEALTH_POLL_MS))
      }
    }
    console.warn('[BackendManager] Backend did not become healthy in time — continuing.')
  }
}
