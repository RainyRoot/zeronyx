/**
 * Virtualized list components for high-performance rendering of large datasets.
 *
 * Uses @tanstack/react-virtual under the hood.
 *
 * Usage (row list):
 *   <VirtualList
 *     items={findings}
 *     estimateSize={() => 56}
 *     renderItem={(finding, style) => (
 *       <div style={style} className="border-b ...">
 *         {finding.title}
 *       </div>
 *     )}
 *   />
 *
 * Usage (table body):
 *   <VirtualTableBody
 *     items={scans}
 *     estimateSize={() => 44}
 *     renderRow={(scan) => (
 *       <tr key={scan.id}>
 *         <td>{scan.tool}</td>
 *       </tr>
 *     )}
 *   />
 */

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualListProps<T> {
  items: T[]
  estimateSize: (index: number) => number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
}

export function VirtualList<T>({
  items,
  estimateSize,
  renderItem,
  className,
  overscan = 5,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  })

  return (
    <div ref={parentRef} className={className ?? 'overflow-auto flex-1'}>
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

interface VirtualTableBodyProps<T> {
  items: T[]
  estimateSize: (index: number) => number
  renderRow: (item: T, index: number) => React.ReactNode
  overscan?: number
}

/**
 * Virtualized table body. Wrap in a <table> with a fixed-height <tbody> container.
 *
 * Usage:
 *   <div className="overflow-auto max-h-[600px]">
 *     <table className="w-full">
 *       <thead>...</thead>
 *     </table>
 *     <VirtualTableBody items={rows} estimateSize={() => 44} renderRow={(r) => <tr>...</tr>} />
 *   </div>
 *
 * Note: Because virtualizers need a scroll container, the pattern here is
 * to render the virtual rows inside a positioned wrapper table.
 */
export function VirtualTableBody<T>({
  items,
  estimateSize,
  renderRow,
  overscan = 5,
}: VirtualTableBodyProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  })

  return (
    <div ref={parentRef} className="overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        <table className="w-full" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <tbody>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = items[virtualItem.index]
              return (
                <tr
                  key={virtualItem.key}
                  style={{
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                    position: 'absolute',
                    width: '100%',
                    display: 'table',
                    tableLayout: 'fixed',
                  }}
                >
                  {/* Delegate to renderRow but extract children */}
                  {(renderRow(item, virtualItem.index) as React.ReactElement)?.props?.children}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
