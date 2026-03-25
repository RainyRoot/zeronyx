export function ReportsPage(): JSX.Element {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Reports</h1>
      <p className="text-sm text-gray-500">Generate and export engagement reports.</p>
      <div className="mt-8 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5">
        <p className="text-sm text-gray-500">No reports generated. Complete a scan to create a report.</p>
      </div>
    </div>
  )
}
