export function TargetsPage(): JSX.Element {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-1">Targets</h1>
      <p className="text-sm text-gray-500">Manage hosts, domains, and CIDRs in scope.</p>
      <div className="mt-8 bg-[#1a1a1f] border border-[#2a2a32] rounded-lg p-5">
        <p className="text-sm text-gray-500">No targets defined. Open a project to manage targets.</p>
      </div>
    </div>
  )
}
