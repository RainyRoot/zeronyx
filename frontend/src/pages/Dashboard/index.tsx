export function DashboardPage(): JSX.Element {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500">Overview of your active engagements.</p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {[
          { label: 'Active Projects', value: '0' },
          { label: 'Total Scans', value: '0' },
          { label: 'Open Findings', value: '0' }
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5"
          >
            <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-100 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5">
        <p className="text-sm text-gray-500">No active project. Create or open a project to get started.</p>
      </div>
    </div>
  )
}
