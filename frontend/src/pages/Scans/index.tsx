export function ScansPage(): JSX.Element {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Scans</h1>
      <p className="text-sm text-gray-500">Run and monitor tool scans against your targets.</p>
      <div className="mt-8 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5">
        <p className="text-sm text-gray-500">No scans yet. Select a target and choose a tool to begin.</p>
      </div>
    </div>
  )
}
