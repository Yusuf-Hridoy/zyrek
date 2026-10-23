import { useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type AppStatus,
  type SavedAssay,
} from '../lib/storage'
import { cardClass, microLabel } from '../lib/ui'
import StatusPill from './StatusPill'

interface HistoryPanelProps {
  items: SavedAssay[]
  activeId: string | null
  onOpen: (item: SavedAssay) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: AppStatus) => void
}

const VERDICT_DOTS: Record<string, string> = {
  'STRONG MATCH': '#5a8a3e',
  'GOOD MATCH': '#8a9a3e',
  'PARTIAL MATCH': '#c9962e',
  'WEAK MATCH': '#b3492b',
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function HistoryPanel({
  items,
  activeId,
  onOpen,
  onDelete,
  onStatusChange,
}: HistoryPanelProps) {
  const [open, setOpen] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<AppStatus | 'ALL'>('ALL')

  const filtered = filter === 'ALL' ? items : items.filter((i) => i.status === filter)

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2 border-b border-[#e2dccb] px-5 py-4">
        <span className={microLabel}>History</span>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as AppStatus | 'ALL')}
              aria-label="Filter by status"
              className="rounded-md border border-[#e2dccb] bg-[#f2eee2]/50 px-2 py-1 text-[11.5px] text-[#6f6858] focus:outline-none"
            >
              <option value="ALL">All</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          <span className="shrink-0 text-[12px] text-[#8a8371]">
            {filter === 'ALL'
              ? `${items.length} saved`
              : `${filtered.length}/${items.length} shown`}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse history' : 'Expand history'}
            className="rounded-lg p-1 text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#4a4436]"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-3 py-2">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-[#8a8371]">
              Your saved assays will appear here after your first run.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-[#8a8371]">
              No assays with this status yet.
            </p>
          ) : (
            <div className={filtered.length > 8 ? 'max-h-[360px] overflow-y-auto' : ''}>
              {filtered.map((item, i) => {
                const active = item.id === activeId
                const confirming = item.id === confirmingId
                return (
                  <div
                    key={item.id}
                    className={`border-[#e2dccb] ${i > 0 ? 'border-t' : ''} ${
                      active ? 'border-l-2 border-l-[#b3492b]' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    {confirming ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2.5">
                        <span className="text-[13px] text-[#4a4436]">
                          Delete this assay?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingId(null)
                              onDelete(item.id)
                            }}
                            className="text-[12.5px] font-semibold text-[#b3492b] transition-colors hover:underline"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="text-[12.5px] text-[#8a8371] transition-colors hover:text-[#4a4436]"
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className={`w-full rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-[#f2eee2] ${
                          active ? 'bg-[#f2eee2]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[14px] font-semibold">
                            {item.result.roleTitle}
                          </span>
                          <span className="flex shrink-0 items-baseline">
                            <span className="font-bold tabular-nums">
                              {item.result.overallScore}
                            </span>
                            <span className="ml-0.5 text-[11px] text-[#8a8371]">
                              /100
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[12.5px] text-[#8a8371]">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                VERDICT_DOTS[item.result.verdict] ?? '#c9962e',
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {item.result.company}
                          </span>
                          <span className="mx-0 shrink-0">·</span>
                          <span className="shrink-0">{relativeDate(item.createdAt)}</span>
                          {item.rerunOf && (
                            <span className="shrink-0 font-mono text-[10px] text-[#8a8371]">
                              · re-run
                            </span>
                          )}
                          <span className="shrink-0">·</span>
                          <StatusPill
                            compact
                            status={item.status}
                            onChange={(s) => onStatusChange(item.id, s)}
                          />
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Delete this entry"
                            className="shrink-0 rounded p-1 text-[#8a8371] transition-colors hover:text-[#b3492b]"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmingId(item.id)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                setConfirmingId(item.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
