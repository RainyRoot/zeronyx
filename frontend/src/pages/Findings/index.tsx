export function FindingsPage(): JSX.Element {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Findings</h1>
      <p className="text-sm text-gray-500">Aggregated vulnerabilities and issues across all scans.</p>
      <div className="mt-8 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5">
        <p className="text-sm text-gray-500">No findings yet. Run a scan to start collecting results.</p>
      </div>
    </div>
  )
}
