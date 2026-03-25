import { HashRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/Dashboard'
import { TargetsPage } from '@/pages/Targets'
import { ScansPage } from '@/pages/Scans'
import { FindingsPage } from '@/pages/Findings'
import { ReportsPage } from '@/pages/Reports'
import { SettingsPage } from '@/pages/Settings'
import type { BackendStatus } from '@/types'

const BACKEND_URL = 'http://127.0.0.1:8742'
const HEALTH_INTERVAL_MS = 5000

export default function App(): JSX.Element {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('connecting')

  useEffect(() => {
    let active = true

    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`)
        if (active) setBackendStatus(res.ok ? 'connected' : 'error')
      } catch {
        if (active) setBackendStatus('disconnected')
      }
    }

    check()
    const interval = setInterval(check, HEALTH_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell backendStatus={backendStatus}/>}>
          <Route index element={<DashboardPage />} />
          <Route path="/targets" element={<TargetsPage />} />
          <Route path="/scans" element={<ScansPage />} />
          <Route path="/findings" element={<FindingsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
