import { useEffect, useState } from 'react'
import {
  Radar, Wifi, WifiOff, Search, Key, Trash2, X,
  Server, AlertTriangle, Lock, ChevronDown, ChevronRight,
  BarChart2, Globe,
} from 'lucide-react'
import { useCensysStore } from '@/stores/censysStore'
import { cn } from '@/lib/utils'
import type { CensysHost, CensysService, CensysMatch } from '@/stores/censysStore'

// ---------------------------------------------------------------------------
// Quick searches
// ---------------------------------------------------------------------------

const QUICK_SEARCHES = [
  { label: 'Open SSH',        query: 'services.port: 22' },
  { label: 'HTTPS servers',   query: 'services.port: 443' },
  { label: 'Open RDP',        query: 'services.port: 3389' },
  { label: 'Elasticsearch',   query: 'services.service_name: ELASTICSEARCH' },
  { label: 'Redis exposed',   query: 'services.service_name: REDIS' },
  { label: 'MongoDB exposed', query: 'services.service_name: MONGODB' },
  { label: 'Jenkins',         query: 'services.http.response.html_title: Jenkins' },
  { label: 'Self-signed TLS', query: 'services.tls.certificates.leaf_data.issuer_dn: {subject_dn}' },
]

const AGGREGATE_FIELDS = [
  { label: 'Port',    value: 'services.port' },
  { label: 'Service', value: 'services.service_name' },
  { label: 'Country', value: 'location.country_code' },
  { label: 'OS',      value: 'operating_system.product' },
  { label: 'ASN',     value: 'autonomous_system.asn' },
]

// ---------------------------------------------------------------------------
// Credentials panel
// ---------------------------------------------------------------------------

function CredentialsPanel(): JSX.Element {
  const {
    status, apiIdInput, apiSecretInput,
    setApiIdInput, setApiSecretInput,
    connecting, connectError,
    connect, disconnect, removeCredentials, fetchStatus,
  } = useCensysStore()
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => { fetchStatus() }, [fetchStatus])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0 flex-wrap">
      <Radar size={16} className="text-orange-500 shrink-0" />
      <span className="text-sm font-semibold text-gray-200">Censys</span>

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border',
        status.connected
          ? 'bg-green-500/10 text-green-400 border-green-500/25'
          : 'bg-gray-500/10 text-gray-500 border-gray-500/25'
      )}>
        {status.connected ? <Wifi size={11} /> : <WifiOff size={11} />}
        {status.connected ? status.email ?? 'Connected' : 'Not connected'}
      </div>

      {!status.connected && (
        <>
          {/* API ID */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 shrink-0">ID</span>
            <input
              value={apiIdInput}
              onChange={(e) => setApiIdInput(e.target.value)}
              placeholder="API ID…"
              className="w-40 bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500/50 placeholder-gray-600 font-mono"
            />
          </div>

          {/* Secret */}
          <div className="flex items-center gap-1.5 relative">
            <span className="text-xs text-gray-500 shrink-0">Secret</span>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecretInput}
                onChange={(e) => setApiSecretInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apiIdInput && apiSecretInput && connect(apiIdInput, apiSecretInput)}
                placeholder="API Secret…"
                className="w-40 bg-[#1a1a1f] border border-[#2a2a32] rounded pl-2 pr-7 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500/50 placeholder-gray-600 font-mono"
              />
              <button onClick={() => setShowSecret(!showSecret)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <Lock size={10} />
              </button>
            </div>
          </div>

          <button
            onClick={() => connect(apiIdInput, apiSecretInput)}
            disabled={connecting || !apiIdInput || !apiSecretInput}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              connecting || !apiIdInput || !apiSecretInput
                ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-500 text-white'
            )}
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>

          {connectError && (
            <span className="text-xs text-red-400">{connectError}</span>
          )}
        </>
      )}

      {status.connected && (
        <>
          <button onClick={disconnect}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto">
            <WifiOff size={12} />Disconnect
          </button>
          <button onClick={removeCredentials}
            className="flex items-center gap-1 text-xs text-red-500/70 hover:text-red-400 transition-colors">
            <Trash2 size={12} />Remove
          </button>
        </>
      )}

      {!status.has_credentials && !status.connected && (
        <span className="text-xs text-gray-600 ml-auto">Get free credentials at search.censys.io/register</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search toolbar
// ---------------------------------------------------------------------------

function SearchToolbar(): JSX.Element {
  const {
    hostQuery, setHostQuery, viewHost, hostLoading,
    searchQuery, setSearchQuery, runSearch, searchLoading,
    aggregateField, setAggregateField, runAggregate,
    activeTab, setActiveTab, status,
  } = useCensysStore()

  const disabled = !status.connected

  return (
    <div className="flex flex-col gap-0 border-b border-[#2a2a32] bg-[#111114] shrink-0">
      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 pt-1">
        {(['host', 'search', 'aggregate'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === t
                ? 'border-orange-500 text-gray-200'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {t === 'aggregate' ? 'Aggregate' : t === 'host' ? 'Host Lookup' : 'Search'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 px-4 py-2">
        {activeTab === 'host' ? (
          <>
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5">
              <Server size={12} className="text-gray-500 shrink-0" />
              <input
                value={hostQuery}
                onChange={(e) => setHostQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && viewHost(hostQuery)}
                placeholder="IP address (e.g. 1.1.1.1)"
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 font-mono disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={() => viewHost(hostQuery)}
              disabled={disabled || hostLoading || !hostQuery.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors',
                disabled || hostLoading || !hostQuery.trim()
                  ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              )}
            >
              {hostLoading
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Looking up…</>
                : <><Search size={12} />Lookup</>
              }
            </button>
          </>
        ) : activeTab === 'search' ? (
          <>
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5">
              <Search size={12} className="text-gray-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && runSearch(searchQuery)}
                placeholder='e.g. services.port: 443 and location.country_code: DE'
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 font-mono disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={() => runSearch(searchQuery)}
              disabled={disabled || searchLoading || !searchQuery.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors',
                disabled || searchLoading || !searchQuery.trim()
                  ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              )}
            >
              {searchLoading
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching…</>
                : <><Search size={12} />Search</>
              }
            </button>
          </>
        ) : (
          /* Aggregate tab toolbar */
          <>
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5">
              <BarChart2 size={12} className="text-gray-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && runAggregate(searchQuery)}
                placeholder='Query to aggregate, e.g. services.port: 443'
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 font-mono disabled:cursor-not-allowed"
              />
            </div>
            <select
              value={aggregateField}
              onChange={(e) => setAggregateField(e.target.value)}
              disabled={disabled}
              className="bg-[#1a1a1f] border border-[#2a2a32] rounded px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-orange-500/50"
            >
              {AGGREGATE_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <button
              onClick={() => runAggregate(searchQuery)}
              disabled={disabled || !searchQuery.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors',
                disabled || !searchQuery.trim()
                  ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
              )}
            >
              <BarChart2 size={12} />Aggregate
            </button>
          </>
        )}
      </div>

      {/* Quick searches (search + aggregate tabs) */}
      {(activeTab === 'search' || activeTab === 'aggregate') && (
        <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
          <span className="text-[10px] text-gray-600 shrink-0">Quick:</span>
          {QUICK_SEARCHES.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                setSearchQuery(s.query)
                if (activeTab === 'aggregate') runAggregate(s.query)
                else runSearch(s.query)
              }}
              disabled={disabled}
              className="px-2 py-0.5 rounded text-[11px] bg-[#1e1e24] border border-[#2a2a32] text-gray-500 hover:text-gray-200 hover:border-orange-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Host view
// ---------------------------------------------------------------------------

function ServiceRow({ svc }: { svc: CensysService }): JSX.Element {
  const [open, setOpen] = useState(false)
  const hasTls = !!svc.tls
  const hasHttp = !!svc.http

  return (
    <div className="border border-[#2a2a32] rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left"
      >
        {open ? <ChevronDown size={12} className="text-gray-600 shrink-0" /> : <ChevronRight size={12} className="text-gray-600 shrink-0" />}
        <span className="font-mono text-xs text-orange-400 w-12 shrink-0">{svc.port}</span>
        <span className="text-[10px] text-gray-600 w-8 shrink-0">{svc.protocol}</span>
        <span className="text-xs text-gray-300">{svc.service || '—'}</span>
        {hasTls && <Lock size={10} className="text-green-400 ml-1 shrink-0" />}
        {svc.software.length > 0 && (
          <span className="text-xs text-gray-500 ml-2">
            {svc.software[0].product}{svc.software[0].version ? ` ${svc.software[0].version}` : ''}
          </span>
        )}
        {svc.labels.length > 0 && (
          <div className="ml-auto flex gap-1">
            {svc.labels.slice(0, 3).map((l) => (
              <span key={l} className="px-1 py-0.5 rounded text-[9px] bg-orange-500/10 border border-orange-500/20 text-orange-400">{l}</span>
            ))}
          </div>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-[#2a2a32] bg-[#0e0e12]">
          {hasHttp && svc.http && (
            <div className="flex gap-3 text-xs mt-2">
              <span className="text-gray-600">HTTP:</span>
              <span className={cn(
                'font-mono',
                (svc.http.status ?? 0) < 300 ? 'text-green-400' :
                (svc.http.status ?? 0) < 400 ? 'text-blue-400'  :
                'text-red-400'
              )}>{svc.http.status}</span>
              {svc.http.title && <span className="text-gray-300 truncate">{svc.http.title}</span>}
            </div>
          )}
          {hasTls && svc.tls && (
            <div className="text-xs space-y-0.5 mt-2">
              {svc.tls.subject_dn && (
                <div className="flex gap-2">
                  <span className="text-gray-600 w-16 shrink-0">Subject:</span>
                  <span className="text-gray-300 font-mono truncate">{svc.tls.subject_dn}</span>
                </div>
              )}
              {svc.tls.issuer_dn && (
                <div className="flex gap-2">
                  <span className="text-gray-600 w-16 shrink-0">Issuer:</span>
                  <span className="text-gray-300 font-mono truncate">{svc.tls.issuer_dn}</span>
                </div>
              )}
              {svc.tls.cipher && (
                <div className="flex gap-2">
                  <span className="text-gray-600 w-16 shrink-0">Cipher:</span>
                  <span className="text-gray-400">{svc.tls.cipher} · {svc.tls.version}</span>
                </div>
              )}
            </div>
          )}
          {svc.software.length > 0 && (
            <div className="text-xs mt-2">
              <span className="text-gray-600">Software: </span>
              {svc.software.map((sw, i) => (
                <span key={i} className="text-gray-300 mr-2">{sw.vendor ? `${sw.vendor} ` : ''}{sw.product ?? '?'}{sw.version ? ` ${sw.version}` : ''}</span>
              ))}
            </div>
          )}
          {svc.banner && (
            <pre className="text-[10px] text-gray-500 mt-2 bg-[#111114] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {svc.banner}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function HostView({ host }: { host: CensysHost }): JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Identity / Location grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Network</h3>
          {[
            ['IP',      host.ip],
            ['ASN',     host.asn ? `AS${host.asn}` : null],
            ['Org',     host.asn_name],
            ['BGP',     host.bgp_prefix],
            ['OS',      host.os ? `${host.os}${host.os_version ? ` ${host.os_version}` : ''}` : null],
          ].map(([label, val]) => val ? (
            <div key={label as string} className="flex gap-2 text-xs">
              <span className="text-gray-600 w-10 shrink-0">{label}</span>
              <span className="text-gray-200 font-mono">{val}</span>
            </div>
          ) : null)}
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</h3>
          {[
            ['Country', host.country],
            ['City',    host.city],
            ['Cont.',   host.continent],
            ['Coords',  host.latitude != null ? `${host.latitude?.toFixed(4)}, ${host.longitude?.toFixed(4)}` : null],
          ].map(([label, val]) => val ? (
            <div key={label as string} className="flex gap-2 text-xs">
              <span className="text-gray-600 w-12 shrink-0">{label}</span>
              <span className="text-gray-200">{val}</span>
            </div>
          ) : null)}
          {host.labels.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-1">
              {host.labels.map((l) => (
                <span key={l} className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 border border-orange-500/20 text-orange-400">{l}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open ports */}
      {host.ports.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open Ports ({host.ports.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {host.ports.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400 font-mono">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Services */}
      {host.services.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Services ({host.services.length})</h3>
          <div className="space-y-1.5">
            {host.services.map((svc, i) => <ServiceRow key={i} svc={svc} />)}
          </div>
        </div>
      )}

      {host.last_updated && (
        <p className="text-[10px] text-gray-600">Last updated: {host.last_updated}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search results
// ---------------------------------------------------------------------------

function SearchView(): JSX.Element {
  const { searchResult, searchLoading, searchError, setHostQuery, viewHost, setActiveTab } = useCensysStore()

  const handleClick = (ip: string) => {
    setHostQuery(ip)
    viewHost(ip)
    setActiveTab('host')
  }

  if (searchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
        <span className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin mr-3" />
        Searching…
      </div>
    )
  }
  if (searchError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400">
        <AlertTriangle size={20} />
        <p className="text-sm">{searchError}</p>
      </div>
    )
  }
  if (!searchResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
        <Search size={28} strokeWidth={1} />
        <p className="text-sm">Enter a query and press Search</p>
        <p className="text-xs">Uses Censys v2 hosts search API</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#2a2a32] shrink-0">
        {searchResult.total.toLocaleString()} result{searchResult.total !== 1 ? 's' : ''}
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32]">
            <tr>
              {['IP', 'Country', 'City', 'Ports', 'Services', 'Labels'].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {searchResult.matches.map((m, i) => (
              <tr
                key={i}
                onClick={() => handleClick(m.ip)}
                className="border-b border-[#1e1e24] hover:bg-white/[0.03] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2 font-mono text-orange-400">{m.ip}</td>
                <td className="px-4 py-2 text-gray-400">{m.country ?? '—'}</td>
                <td className="px-4 py-2 text-gray-500">{m.city ?? '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {m.ports.slice(0, 5).map((p) => (
                      <span key={p} className="px-1 text-[10px] rounded bg-orange-500/10 text-orange-400 font-mono">{p}</span>
                    ))}
                    {m.ports.length > 5 && <span className="text-[10px] text-gray-600">+{m.ports.length - 5}</span>}
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-500 font-mono">{m.services.slice(0, 3).join(', ')}{m.services.length > 3 ? '…' : ''}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    {m.labels.slice(0, 2).map((l) => (
                      <span key={l} className="px-1 text-[9px] rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">{l}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aggregate view
// ---------------------------------------------------------------------------

function AggregateView(): JSX.Element {
  const { aggregateResult } = useCensysStore()

  if (!aggregateResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-600">
        <BarChart2 size={28} strokeWidth={1} />
        <p className="text-sm">Aggregate a query to see field distribution</p>
        <p className="text-xs">Free — does not consume query quota</p>
      </div>
    )
  }

  const { buckets, field, total } = aggregateResult
  const max = buckets[0]?.count ?? 1

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Distribution by <span className="text-orange-400 font-mono">{field}</span>
        </h3>
        <span className="text-xs text-gray-600">{total.toLocaleString()} total</span>
      </div>
      <div className="space-y-1.5">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-gray-300 font-mono w-32 shrink-0 truncate">{b.key || '(empty)'}</span>
            <div className="flex-1 bg-[#1a1a1f] rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-orange-500/60 rounded-full"
                style={{ width: `${Math.round((b.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-16 text-right shrink-0">{b.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function CensysPage(): JSX.Element {
  const { activeTab, hostResult, hostLoading, hostError, clearHost } = useCensysStore()

  return (
    <div className="flex flex-col h-full">
      <CredentialsPanel />
      <SearchToolbar />

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'host' ? (
          hostLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin mr-3" />
              Looking up host…
            </div>
          ) : hostError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-400">
              <AlertTriangle size={20} />
              <p className="text-sm">{hostError}</p>
              <button onClick={clearHost} className="text-xs text-gray-500 hover:text-gray-300 mt-1 flex items-center gap-1">
                <X size={11} />Clear
              </button>
            </div>
          ) : hostResult ? (
            <HostView host={hostResult} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-600">
              <Radar size={32} strokeWidth={1} />
              <p className="text-sm">Enter an IP address to look up Censys data</p>
              <p className="text-xs">Censys indexes IPv4 and IPv6 hosts globally</p>
            </div>
          )
        ) : activeTab === 'search' ? (
          <SearchView />
        ) : (
          <AggregateView />
        )}
      </div>
    </div>
  )
}

export default CensysPage
