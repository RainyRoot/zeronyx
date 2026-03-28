import { useEffect, useState } from 'react'
import {
  Eye, Wifi, WifiOff, Search, Key, Trash2, X,
  Globe, Shield, AlertTriangle, Server, MapPin,
  ChevronDown, ChevronRight, Lock, Info,
} from 'lucide-react'
import { useShodanStore } from '@/stores/shodanStore'
import { cn } from '@/lib/utils'
import type { ShodanHost, ShodanService, ShodanMatch } from '@/stores/shodanStore'

// ---------------------------------------------------------------------------
// Quick-search templates
// ---------------------------------------------------------------------------

const QUICK_SEARCHES = [
  { label: 'Apache exposed',     query: 'product:Apache' },
  { label: 'OpenSSH',            query: 'product:OpenSSH' },
  { label: 'RDP exposed',        query: 'port:3389 product:RDP' },
  { label: 'Default Mongo',      query: 'product:MongoDB port:27017' },
  { label: 'Elasticsearch',      query: 'product:Elastic port:9200' },
  { label: 'Webcams',            query: 'product:webcam' },
  { label: 'Jenkins',            query: 'http.title:Jenkins' },
  { label: 'Has vuln (any)',     query: 'vuln:CVE-2021-44228' },
]

// ---------------------------------------------------------------------------
// API Key panel
// ---------------------------------------------------------------------------

function ApiKeyPanel(): JSX.Element {
  const { status, apiKeyInput, setApiKeyInput, connecting, connectError, connect, disconnect, removeKey, fetchStatus } = useShodanStore()
  const [showKey, setShowKey] = useState(false)

  useEffect(() => { fetchStatus() }, [fetchStatus])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a32] bg-[#111114] shrink-0 flex-wrap">
      <Eye size={16} className="text-cyan-500 shrink-0" />
      <span className="text-sm font-semibold text-gray-200">Shodan</span>

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border',
        status.connected
          ? 'bg-green-500/10 text-green-400 border-green-500/25'
          : 'bg-gray-500/10 text-gray-500 border-gray-500/25'
      )}>
        {status.connected ? <Wifi size={11} /> : <WifiOff size={11} />}
        {status.connected
          ? `${status.plan ?? 'free'} · ${status.query_credits ?? '?'} credits`
          : 'Not connected'}
      </div>

      {!status.connected && (
        <>
          <div className="relative flex items-center">
            <Key size={11} className="absolute left-2 text-gray-600 pointer-events-none" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && apiKeyInput && connect(apiKeyInput)}
              placeholder="Shodan API key…"
              className="pl-6 pr-8 py-0.5 w-52 bg-[#1a1a1f] border border-[#2a2a32] rounded text-xs text-gray-200 focus:outline-none focus:border-cyan-500/50 placeholder-gray-600"
            />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-2 text-gray-600 hover:text-gray-400">
              <Lock size={10} />
            </button>
          </div>

          <button
            onClick={() => apiKeyInput && connect(apiKeyInput)}
            disabled={connecting || !apiKeyInput}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              connecting || !apiKeyInput
                ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
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
            <WifiOff size={12} />
            Disconnect
          </button>
          <button onClick={removeKey}
            className="flex items-center gap-1 text-xs text-red-500/70 hover:text-red-400 transition-colors">
            <Trash2 size={12} />
            Remove key
          </button>
        </>
      )}

      {/* API key hint when no key saved */}
      {!status.has_key && !status.connected && (
        <span className="text-xs text-gray-600 ml-auto">
          Get a free key at shodan.io/dashboard
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search toolbar
// ---------------------------------------------------------------------------

function SearchToolbar(): JSX.Element {
  const {
    hostQuery, setHostQuery, lookupHost, hostLoading,
    searchQuery, setSearchQuery, runSearch, runCount, searchLoading, countResult,
    activeTab, setActiveTab,
  } = useShodanStore()
  const { status } = useShodanStore()

  const disabled = !status.connected

  return (
    <div className="flex flex-col gap-0 border-b border-[#2a2a32] bg-[#111114] shrink-0">
      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 pt-1">
        {(['host', 'search'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors capitalize',
              activeTab === t
                ? 'border-cyan-500 text-gray-200'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            )}
          >
            {t === 'host' ? 'Host Lookup' : 'Search'}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 px-4 py-2">
        {activeTab === 'host' ? (
          <>
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5">
              <Server size={12} className="text-gray-500 shrink-0" />
              <input
                value={hostQuery}
                onChange={(e) => setHostQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && lookupHost(hostQuery)}
                placeholder="IP address (e.g. 8.8.8.8)"
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 font-mono disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={() => lookupHost(hostQuery)}
              disabled={disabled || hostLoading || !hostQuery.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors',
                disabled || hostLoading || !hostQuery.trim()
                  ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              )}
            >
              {hostLoading
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Looking up…</>
                : <><Search size={12} />Lookup</>
              }
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-2 bg-[#1a1a1f] border border-[#2a2a32] rounded px-3 py-1.5">
              <Search size={12} className="text-gray-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !disabled && runSearch(searchQuery)}
                placeholder='Shodan query, e.g. "port:22 country:DE"'
                disabled={disabled}
                className="flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 font-mono disabled:cursor-not-allowed"
              />
              {countResult !== null && (
                <span className="text-xs text-gray-500 shrink-0">{countResult.toLocaleString()} results</span>
              )}
            </div>
            <button
              onClick={() => runCount(searchQuery)}
              disabled={disabled || !searchQuery.trim()}
              title="Count results (free, no credits)"
              className={cn(
                'px-2.5 py-1.5 rounded text-xs transition-colors border',
                disabled || !searchQuery.trim()
                  ? 'border-[#2a2a32] text-gray-600 cursor-not-allowed'
                  : 'border-[#2a2a32] text-gray-400 hover:text-gray-200 hover:border-cyan-500/40'
              )}
            >
              Count
            </button>
            <button
              onClick={() => runSearch(searchQuery)}
              disabled={disabled || searchLoading || !searchQuery.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors',
                disabled || searchLoading || !searchQuery.trim()
                  ? 'bg-gray-700/40 text-gray-600 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              )}
            >
              {searchLoading
                ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Searching…</>
                : <><Search size={12} />Search</>
              }
            </button>
          </>
        )}
      </div>

      {/* Quick searches */}
      {activeTab === 'search' && (
        <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
          <span className="text-[10px] text-gray-600 shrink-0">Quick:</span>
          {QUICK_SEARCHES.map((s) => (
            <button
              key={s.label}
              onClick={() => { setSearchQuery(s.query); runSearch(s.query) }}
              disabled={disabled}
              className="px-2 py-0.5 rounded text-[11px] bg-[#1e1e24] border border-[#2a2a32] text-gray-500 hover:text-gray-200 hover:border-cyan-500/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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
// Host detail view
// ---------------------------------------------------------------------------

function ServiceRow({ svc }: { svc: ShodanService }): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-[#2a2a32] rounded">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.03] transition-colors text-left"
      >
        {open ? <ChevronDown size={12} className="text-gray-600 shrink-0" /> : <ChevronRight size={12} className="text-gray-600 shrink-0" />}
        <span className="font-mono text-xs text-cyan-400 w-12 shrink-0">{svc.port}</span>
        <span className="text-[10px] text-gray-600 w-8 shrink-0">{svc.transport}</span>
        <span className="text-xs text-gray-300">{svc.product ?? '—'}</span>
        {svc.version && <span className="text-xs text-gray-500">{svc.version}</span>}
        {svc.ssl && <Lock size={10} className="text-green-400 ml-1 shrink-0" />}
        {svc.vulns.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle size={10} />{svc.vulns.length} vuln{svc.vulns.length > 1 ? 's' : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-[#2a2a32] bg-[#0e0e12]">
          {svc.http && (
            <div className="flex gap-3 text-xs mt-2">
              <span className="text-gray-600">HTTP title:</span>
              <span className="text-gray-300">{svc.http.title ?? '—'}</span>
              <span className="text-gray-600 ml-2">Server:</span>
              <span className="text-gray-300">{svc.http.server ?? '—'}</span>
              <span className="text-gray-600 ml-2">Status:</span>
              <span className="text-gray-300">{svc.http.status ?? '—'}</span>
            </div>
          )}
          {svc.ssl && (
            <div className="text-xs space-y-0.5 mt-2">
              <div className="flex gap-2">
                <span className="text-gray-600 w-14 shrink-0">Subject:</span>
                <span className="text-gray-300 font-mono">{Object.values(svc.ssl.subject).join(', ')}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-600 w-14 shrink-0">Issuer:</span>
                <span className="text-gray-300 font-mono">{Object.values(svc.ssl.issuer).join(', ')}</span>
              </div>
              {svc.ssl.expires && (
                <div className="flex gap-2">
                  <span className="text-gray-600 w-14 shrink-0">Expires:</span>
                  <span className="text-gray-300">{svc.ssl.expires}</span>
                </div>
              )}
            </div>
          )}
          {svc.cpe.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="text-gray-600 shrink-0">CPE:</span>
              <span className="text-gray-400 font-mono">{svc.cpe.join(', ')}</span>
            </div>
          )}
          {svc.vulns.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {svc.vulns.map((v) => (
                <span key={v} className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 font-mono">{v}</span>
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

function HostView({ host }: { host: ShodanHost }): JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {/* Identity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identity</h3>
          {[
            ['IP',       host.ip],
            ['Org',      host.org],
            ['ISP',      host.isp],
            ['ASN',      host.asn],
            ['OS',       host.os],
          ].map(([label, val]) => val ? (
            <div key={label} className="flex gap-2 text-xs">
              <span className="text-gray-600 w-10 shrink-0">{label}</span>
              <span className="text-gray-200 font-mono">{val}</span>
            </div>
          ) : null)}

          {host.hostnames.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="text-gray-600 w-10 shrink-0">Hosts</span>
              <div className="flex flex-wrap gap-1">
                {host.hostnames.map((h) => (
                  <span key={h} className="text-cyan-400 font-mono">{h}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Location</h3>
          {[
            ['Country',  host.country],
            ['City',     host.city],
            ['Region',   host.region],
            ['Lat/Lon',  host.latitude != null ? `${host.latitude}, ${host.longitude}` : null],
          ].map(([label, val]) => val ? (
            <div key={label} className="flex gap-2 text-xs">
              <span className="text-gray-600 w-14 shrink-0">{label}</span>
              <span className="text-gray-200">{val}</span>
            </div>
          ) : null)}

          {host.tags.length > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="text-gray-600 w-14 shrink-0">Tags</span>
              <div className="flex flex-wrap gap-1">
                {host.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px]">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Open ports summary */}
      {host.ports.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Open Ports ({host.ports.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {host.ports.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-mono">{p}</span>
            ))}
          </div>
        </div>
      )}

      {/* Vulnerabilities */}
      {host.all_vulns.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Vulnerabilities ({host.all_vulns.length})
          </h3>
          <div className="space-y-1.5">
            {host.all_vulns.map((v, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded border border-red-500/20 bg-red-500/5">
                <span className="text-xs font-mono text-red-300 shrink-0">{v.cve}</span>
                {v.cvss != null && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                    v.cvss >= 9 ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                    v.cvss >= 7 ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                  )}>
                    CVSS {v.cvss}
                  </span>
                )}
                {v.port && <span className="text-[10px] text-gray-600">port {v.port}</span>}
                {v.summary && <span className="text-xs text-gray-400 truncate">{v.summary}</span>}
              </div>
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

      {host.last_update && (
        <p className="text-[10px] text-gray-600">Last updated: {host.last_update}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Search results view
// ---------------------------------------------------------------------------

function SearchResultRow({ match, onClick }: { match: ShodanMatch; onClick: () => void }): JSX.Element {
  return (
    <tr
      onClick={onClick}
      className="border-b border-[#1e1e24] hover:bg-white/[0.03] cursor-pointer transition-colors"
    >
      <td className="px-4 py-2 font-mono text-xs text-cyan-400">{match.ip}</td>
      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{match.port}</td>
      <td className="px-4 py-2 text-xs text-gray-300">{match.org ?? '—'}</td>
      <td className="px-4 py-2 text-xs text-gray-400">{match.country ?? '—'}</td>
      <td className="px-4 py-2 text-xs text-gray-400">{match.product ?? '—'} {match.version ?? ''}</td>
      <td className="px-4 py-2 text-xs">
        {match.vulns.length > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle size={10} />{match.vulns.length}
          </span>
        )}
      </td>
    </tr>
  )
}

function SearchView(): JSX.Element {
  const { searchResult, searchLoading, searchError, searchPage, runSearch, searchQuery, setHostQuery, lookupHost, setActiveTab } = useShodanStore()

  const handleRowClick = (ip: string) => {
    setHostQuery(ip)
    lookupHost(ip)
    setActiveTab('host')
  }

  if (searchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
        <span className="w-4 h-4 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin mr-3" />
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
        <p className="text-xs">Each search costs 1 query credit</p>
      </div>
    )
  }

  const { total, matches } = searchResult
  const totalPages = Math.ceil(Math.min(total, 1000) / 100)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Result stats */}
      <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#2a2a32] shrink-0 flex items-center gap-3">
        <span>{total.toLocaleString()} total results</span>
        <span>·</span>
        <span>showing {matches.length}</span>
        <span>·</span>
        <span>page {searchPage} of {totalPages}</span>
        {totalPages > 1 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => runSearch(searchQuery, searchPage - 1)}
              disabled={searchPage <= 1}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
            >← Prev</button>
            <button
              onClick={() => runSearch(searchQuery, searchPage + 1)}
              disabled={searchPage >= totalPages}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
            >Next →</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#111114] border-b border-[#2a2a32]">
            <tr>
              {['IP', 'Port', 'Org', 'Country', 'Product', 'Vulns'].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <SearchResultRow key={i} match={m} onClick={() => handleRowClick(m.ip)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ShodanPage(): JSX.Element {
  const { activeTab, hostResult, hostLoading, hostError, clearHost } = useShodanStore()

  return (
    <div className="flex flex-col h-full">
      <ApiKeyPanel />
      <SearchToolbar />

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'host' ? (
          hostLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin mr-3" />
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
              <Eye size={32} strokeWidth={1} />
              <p className="text-sm">Enter an IP address to look up Shodan data</p>
              <p className="text-xs">Host lookups do not consume query credits</p>
            </div>
          )
        ) : (
          <SearchView />
        )}
      </div>
    </div>
  )
}

export default ShodanPage
