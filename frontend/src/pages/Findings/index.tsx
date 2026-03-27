import { useEffect, useState, useMemo } from 'react'
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  Shield,
  Copy,
  Check,
  Download,
  ChevronDown,
  X,
} from 'lucide-react'
import { useCredentialStore } from '@/stores/credentialStore'
import { useProjectStore } from '@/stores/projectStore'
import { useScanStore } from '@/stores/scanStore'
import { cn } from '@/lib/utils'
import type { Credential } from '@/types'

// ---------------------------------------------------------------------------
// Service badge colours
// ---------------------------------------------------------------------------
const SERVICE_COLORS: Record<string, string> = {
  ssh:              'bg-blue-500/15 text-blue-300 border-blue-500/20',
  ftp:              'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  smb:              'bg-orange-500/15 text-orange-300 border-orange-500/20',
  rdp:              'bg-purple-500/15 text-purple-300 border-purple-500/20',
  mysql:            'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  postgres:         'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  telnet:           'bg-red-500/15 text-red-300 border-red-500/20',
  vnc:              'bg-pink-500/15 text-pink-300 border-pink-500/20',
  'http-get':       'bg-green-500/15 text-green-300 border-green-500/20',
  'http-post-form': 'bg-green-500/15 text-green-300 border-green-500/20',
}

function serviceBadge(svc: string | null): string {
  if (!svc) return 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  return SERVICE_COLORS[svc.toLowerCase()] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
}

// ---------------------------------------------------------------------------
// Add credential modal
// ---------------------------------------------------------------------------
interface AddModalProps {
  projectId: string
  onClose: () => void
  onAdded: () => void
}

function AddCredentialModal({ projectId, onClose, onAdded }: AddModalProps): JSX.Element {
  const { addCredential } = useCredentialStore()
  const [service, setService] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hash, setHash] = useState('')
  const [hashType, setHashType] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!username && !hash) {
      setErr('Username or hash is required')
      return
    }
    setSaving(true)
    try {
      await addCredential({
        project_id: projectId,
        service: service || null,
        username: username || null,
        password: password || null,
        hash: hash || null,
        hash_type: hashType || null,
      })
      onAdded()
      onClose()
    } catch (e) {
      setErr((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[460px] bg-[#1a1a1f] border border-[#2a2a32] rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a32]">
          <p className="text-sm font-medium text-gray-100">Add Credential</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {[
            { label: 'Service', value: service, set: setService, placeholder: 'ssh, ftp, smb…' },
            { label: 'Username', value: username, set: setUsername, placeholder: 'admin' },
            { label: 'Password', value: password, set: setPassword, placeholder: 'plaintext password' },
            { label: 'Hash', value: hash, set: setHash, placeholder: 'NTLM / MD5 / SHA1 hash' },
            { label: 'Hash Type', value: hashType, set: setHashType, placeholder: 'ntlm, md5, sha1…' },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="block text-xs text-gray-400 mb-1">{label}</label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#111114] border border-[#2a2a32] rounded-md px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/40"
              />
            </div>
          ))}
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import from scan modal
// ---------------------------------------------------------------------------
interface ImportModalProps {
  projectId: string
  onClose: () => void
  onImported: (count: number) => void
}

function ImportFromScanModal({ projectId, onClose, onImported }: ImportModalProps): JSX.Element {
  const { scans, fetchScans } = useScanStore()
  const { importFromScan } = useCredentialStore()
  const [selectedScanId, setSelectedScanId] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchScans(projectId)
  }, [projectId, fetchScans])

  const hydraScans = useMemo(
    () => scans.filter((s) => s.tool === 'hydra' && s.status === 'completed'),
    [scans]
  )

  const handleImport = async () => {
    if (!selectedScanId) return
    setLoading(true)
    setErr(null)
    try {
      const res = await importFromScan(selectedScanId, projectId)
      onImported(res.imported)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] bg-[#1a1a1f] border border-[#2a2a32] rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a32]">
          <p className="text-sm font-medium text-gray-100">Import from Hydra Scan</p>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {hydraScans.length === 0 ? (
            <p className="text-sm text-gray-500">No completed Hydra scans found for this project.</p>
          ) : (
            <>
              <label className="block text-xs text-gray-400 mb-1">Select Hydra scan</label>
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                className="w-full bg-[#111114] border border-[#2a2a32] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500/40"
              >
                <option value="">— Choose scan —</option>
                {hydraScans.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id.slice(0, 8)} — {s.profile ?? 'custom'} — {s.created_at.slice(0, 10)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Duplicates are skipped automatically.</p>
            </>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#2a2a32]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedScanId || loading}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40"
          >
            {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Credential row
// ---------------------------------------------------------------------------
function CredRow({
  cred,
  onDelete,
  onToggleVerified,
}: {
  cred: Credential
  onDelete: (id: string) => void
  onToggleVerified: (id: string, v: boolean) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const hasExtra = !!(cred.hash || cred.hash_type || cred.source_scan)

  return (
    <>
      <tr
        className="border-b border-[#2a2a32] hover:bg-white/[0.02] transition-colors"
        onClick={() => hasExtra && setExpanded((x) => !x)}
        style={{ cursor: hasExtra ? 'pointer' : 'default' }}
      >
        {/* Service */}
        <td className="px-4 py-2.5">
          {cred.service ? (
            <span
              className={cn(
                'inline-block text-xs font-mono px-1.5 py-0.5 rounded border',
                serviceBadge(cred.service)
              )}
            >
              {cred.service}
            </span>
          ) : (
            <span className="text-gray-600 text-xs">—</span>
          )}
        </td>

        {/* Username */}
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1">
            <span className="text-sm text-green-300 font-mono">{cred.username ?? '—'}</span>
            {cred.username && <CopyButton text={cred.username} />}
          </div>
        </td>

        {/* Password */}
        <td className="px-4 py-2.5">
          {cred.password ? (
            <div className="flex items-center gap-1">
              <span className="text-sm text-yellow-300 font-mono">{cred.password}</span>
              <CopyButton text={cred.password} />
            </div>
          ) : cred.hash ? (
            <span className="text-xs text-gray-500 font-mono">[hash]</span>
          ) : (
            <span className="text-gray-600 text-xs">—</span>
          )}
        </td>

        {/* Verified */}
        <td className="px-4 py-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleVerified(cred.id, !cred.verified)
            }}
            title={cred.verified ? 'Mark unverified' : 'Mark verified'}
          >
            {cred.verified ? (
              <ShieldCheck size={16} className="text-green-400" />
            ) : (
              <Shield size={16} className="text-gray-600 hover:text-gray-400 transition-colors" />
            )}
          </button>
        </td>

        {/* Added */}
        <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums">
          {cred.created_at.slice(0, 10)}
        </td>

        {/* Actions */}
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1">
            {hasExtra && (
              <ChevronDown
                size={13}
                className={cn('text-gray-600 transition-transform', expanded && 'rotate-180')}
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(cred.id)
              }}
              className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && hasExtra && (
        <tr className="bg-[#111114]">
          <td colSpan={6} className="px-4 py-2 border-b border-[#2a2a32]">
            <div className="flex flex-wrap gap-4 text-xs">
              {cred.hash && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Hash:</span>
                  <span className="font-mono text-gray-300">{cred.hash}</span>
                  <CopyButton text={cred.hash} />
                </div>
              )}
              {cred.hash_type && (
                <div>
                  <span className="text-gray-500">Type:</span>{' '}
                  <span className="text-gray-300">{cred.hash_type}</span>
                </div>
              )}
              {cred.source_scan && (
                <div>
                  <span className="text-gray-500">Scan:</span>{' '}
                  <span className="font-mono text-gray-400">{cred.source_scan.slice(0, 8)}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function FindingsPage(): JSX.Element {
  const { activeProject } = useProjectStore()
  const { credentials, isLoading, fetchCredentials, toggleVerified, deleteCredential } =
    useCredentialStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)

  useEffect(() => {
    if (activeProject) fetchCredentials(activeProject.id)
  }, [activeProject, fetchCredentials])

  const services = useMemo(() => {
    const set = new Set<string>()
    credentials.forEach((c) => { if (c.service) set.add(c.service) })
    return Array.from(set).sort()
  }, [credentials])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return credentials.filter((c) => {
      if (serviceFilter && c.service !== serviceFilter) return false
      if (!term) return true
      return (
        c.username?.toLowerCase().includes(term) ||
        c.password?.toLowerCase().includes(term) ||
        c.service?.toLowerCase().includes(term) ||
        c.hash?.toLowerCase().includes(term)
      )
    })
  }, [credentials, search, serviceFilter])

  const verifiedCount = credentials.filter((c) => c.verified).length

  if (!activeProject) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-1">Credential Store</h1>
        <p className="text-sm text-gray-500 mt-2">Select a project to view credentials.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {showAdd && (
        <AddCredentialModal
          projectId={activeProject.id}
          onClose={() => setShowAdd(false)}
          onAdded={() => fetchCredentials(activeProject.id)}
        />
      )}
      {showImport && (
        <ImportFromScanModal
          projectId={activeProject.id}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setImportMsg(
              n > 0
                ? `${n} credential${n !== 1 ? 's' : ''} imported.`
                : 'Nothing new to import.'
            )
            setTimeout(() => setImportMsg(null), 3000)
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a32] shrink-0">
        <div>
          <h1 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <KeyRound size={16} className="text-red-400" />
            Credential Store
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {credentials.length} total · {verifiedCount} verified
          </p>
        </div>
        <div className="flex items-center gap-2">
          {importMsg && <span className="text-xs text-green-400 mr-1">{importMsg}</span>}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-300 bg-white/5 hover:bg-white/10 border border-[#2a2a32] transition-colors"
          >
            <Download size={14} />
            Import from Scan
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-[#2a2a32] shrink-0 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, password…"
          className="bg-[#111114] border border-[#2a2a32] rounded-md px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500/40 w-56"
        />
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setServiceFilter(null)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs transition-colors',
              serviceFilter === null
                ? 'bg-red-500/20 text-red-300'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            )}
          >
            All
          </button>
          {services.map((svc) => (
            <button
              key={svc}
              onClick={() => setServiceFilter(svc === serviceFilter ? null : svc)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                serviceFilter === svc
                  ? 'bg-red-500/20 text-red-300'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              )}
            >
              {svc}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <KeyRound size={24} className="text-gray-700" />
            <p className="text-sm text-gray-500">
              {credentials.length === 0
                ? 'No credentials yet. Run a Hydra scan or add manually.'
                : 'No matches for current filter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#2a2a32]">
                {['Service', 'Username', 'Password', 'Verified', 'Added', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cred) => (
                <CredRow
                  key={cred.id}
                  cred={cred}
                  onDelete={deleteCredential}
                  onToggleVerified={toggleVerified}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
