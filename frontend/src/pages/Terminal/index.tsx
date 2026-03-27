import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Plus, X, SquareTerminal } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TermTab {
  id: string
  label: string
  exited: boolean
}

// ---------------------------------------------------------------------------
// Terminal instance component
// ---------------------------------------------------------------------------

function TerminalInstance({
  tabId,
  isActive,
  onExit,
}: {
  tabId: string
  isActive: boolean
  onExit: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef  = useRef<FitAddon | null>(null)
  const [error, setError] = useState<string | null>(null)

  const spawn = useCallback(async () => {
    if (!containerRef.current || !window.terminalAPI) return

    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background:    '#0e0e12',
        foreground:    '#d4d4d4',
        cursor:        '#e06c75',
        cursorAccent:  '#0e0e12',
        black:         '#1e1e24',
        red:           '#e06c75',
        green:         '#98c379',
        yellow:        '#e5c07b',
        blue:          '#61afef',
        magenta:       '#c678dd',
        cyan:          '#56b6c2',
        white:         '#abb2bf',
        brightBlack:   '#4b5263',
        brightRed:     '#e06c75',
        brightGreen:   '#98c379',
        brightYellow:  '#e5c07b',
        brightBlue:    '#61afef',
        brightMagenta: '#c678dd',
        brightCyan:    '#56b6c2',
        brightWhite:   '#ffffff',
      },
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current  = fitAddon

    // Spawn PTY
    const { cols, rows } = term
    const result = await window.terminalAPI.spawn(tabId, cols, rows)
    if (!result.success) {
      setError(result.error ?? 'Failed to start shell')
      return
    }

    // PTY → xterm
    const unsubData = window.terminalAPI.onData(tabId, (data) => {
      term.write(data)
    })

    // PTY exit
    const unsubExit = window.terminalAPI.onExit(tabId, (_code) => {
      term.writeln('\r\n\x1b[90m[Process completed]\x1b[0m')
      onExit()
      unsubData()
      unsubExit()
    })

    // xterm → PTY
    term.onData((data) => {
      window.terminalAPI.write(tabId, data)
    })

    // Resize observer — refit on container size change
    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = term
      window.terminalAPI.resize(tabId, cols, rows)
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      unsubData()
      unsubExit()
    }
  }, [tabId, onExit])

  useEffect(() => {
    let cleanup: (() => void) | undefined

    spawn().then((fn) => { cleanup = fn })

    return () => {
      cleanup?.()
      termRef.current?.dispose()
      termRef.current = null
      window.terminalAPI?.kill(tabId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])

  // Re-fit when tab becomes active (container may have been hidden)
  useEffect(() => {
    if (isActive && fitRef.current && termRef.current) {
      requestAnimationFrame(() => {
        fitRef.current?.fit()
        const { cols, rows } = termRef.current!
        window.terminalAPI?.resize(tabId, cols, rows)
      })
    }
  }, [isActive, tabId])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-gray-500">
        <SquareTerminal size={28} className="text-gray-700" />
        <p className="text-red-400">{error}</p>
        <p className="text-[11px] text-gray-700">node-pty may not be available in this environment.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full', !isActive && 'hidden')}
      style={{ padding: '6px 8px' }}
    />
  )
}

// ---------------------------------------------------------------------------
// Terminal page
// ---------------------------------------------------------------------------

let _tabCounter = 1

export function TerminalPage(): JSX.Element {
  const [tabs, setTabs] = useState<TermTab[]>(() => [
    { id: `term-${_tabCounter++}`, label: 'Shell 1', exited: false },
  ])
  const [activeId, setActiveId] = useState<string>(tabs[0].id)

  const addTab = () => {
    const id = `term-${_tabCounter++}`
    const label = `Shell ${_tabCounter - 1}`
    setTabs((prev) => [...prev, { id, label, exited: false }])
    setActiveId(id)
  }

  const closeTab = (id: string) => {
    window.terminalAPI?.kill(id)
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        // Reopen a fresh tab when last is closed
        const newId = `term-${_tabCounter++}`
        setActiveId(newId)
        return [{ id: newId, label: `Shell ${_tabCounter - 1}`, exited: false }]
      }
      if (id === activeId) {
        setActiveId(next[next.length - 1].id)
      }
      return next
    })
  }

  const markExited = (id: string) => {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, exited: true } : t))
  }

  return (
    <div className="flex flex-col h-full bg-[#0e0e12]">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[#2a2a32] bg-[#111114] px-2 shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-2 cursor-pointer border-r border-[#2a2a32] select-none transition-colors',
              tab.id === activeId
                ? 'bg-[#0e0e12] text-gray-200'
                : 'text-gray-600 hover:text-gray-400 hover:bg-[#0e0e12]/50',
            )}
          >
            <SquareTerminal size={11} className={cn(
              tab.exited ? 'text-gray-700' : tab.id === activeId ? 'text-green-500/70' : 'text-gray-700',
            )} />
            <span className={cn(
              'text-[11px] font-medium',
              tab.exited && 'line-through opacity-50',
            )}>
              {tab.label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-gray-300 ml-0.5 transition-all rounded"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {/* New tab button */}
        <button
          onClick={addTab}
          className="flex items-center justify-center w-8 h-8 text-gray-700 hover:text-gray-400 transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Terminal instances — all mounted, hidden/shown via CSS */}
      <div className="flex-1 overflow-hidden relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn('absolute inset-0', tab.id !== activeId && 'pointer-events-none opacity-0')}
          >
            <TerminalInstance
              tabId={tab.id}
              isActive={tab.id === activeId}
              onExit={() => markExited(tab.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
