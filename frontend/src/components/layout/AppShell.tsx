import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { StatusBar } from './StatusBar'
import { useProjectStore } from '@/stores/projectStore'
import type { BackendStatus } from '@/types'

interface AppShellProps {
  backendStatus: BackendStatus
}

export function AppShell({ backendStatus }: AppShellProps): JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f0f11] text-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <StatusBar backendStatus={backendStatus} projectName={activeProject?.name} />
    </div>
  )
}
