import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import FollowUpDraftPanel from './FollowUpDraftPanel'
import type { Nudge } from '../lib/radar'
import type { FollowUpOutcome } from '../lib/followup'
import { cardClass, microLabel } from '../lib/ui'
import type { SavedAssay } from '../lib/storage'

const MAX_ROWS = 5

function reason(n: Nudge): string {
  return n.kind === 'APPLIED_SILENT'
    ? `silent ${n.daysSilent}d after applying`
    : `no word ${n.daysSilent}d after interview`
}

interface RadarCardProps {
  nudges: Nudge[]
  items: SavedAssay[]
  onOpen: (id: string) => void
  onDone: (id: string) => void
  onIcs: (assay: SavedAssay) => void
  draftFor: (assay: SavedAssay) => Promise<FollowUpOutcome>
}

export default function RadarCard({
  nudges,
  items,
  onOpen,
  onDone,
  onIcs,
  draftFor,
}: RadarCardProps) {
  const [draftOpenId, setDraftOpenId] = useState<string | null>(null)

  const assayFor = (id: string) => items.find((i) => i.id === id)

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2 border-b border-[#e2dccb] px-5 py-4">
        <span className={microLabel}>Follow-up radar</span>
        <span className="shrink-0 text-[12px] text-[#8a8371]">{nudges.length}</span>
      </div>

      <div className="px-3 py-2">
        {nudges.slice(0, MAX_ROWS).map((n, i) => {
          const assay = assayFor(n.id)
          const draftOpen = draftOpenId === n.id
          return (
            <div
              key={n.id}
              className={`border-[#e2dccb] ${i > 0 ? 'border-t' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(n.id)}
                  className="min-w-0 flex-1 truncate text-left text-[13px] transition-colors hover:underline hover:underline-offset-2"
                >
                  {n.roleTitle}
                  <span className="text-[#6f6858]"> — {n.company}</span>
                </button>
                <span
                  className={`shrink-0 text-[12px] ${
                    n.daysSilent >= 14 ? 'text-[#8a5a1d]' : 'text-[#8a8371]'
                  }`}
                >
                  {reason(n)}
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDraftOpenId(draftOpen ? null : n.id)}
                    className="text-[12px] font-semibold text-[#b3492b] transition-colors hover:underline hover:underline-offset-2"
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => onDone(n.id)}
                    className="text-[12px] text-[#8a8371] transition-colors hover:text-[#26221b]"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => assay && onIcs(assay)}
                    aria-label="Add reminder"
                    title="Add reminder (.ics)"
                    className="flex min-h-[32px] items-center rounded-md p-1 text-[#8a8371] transition-colors hover:text-[#26221b]"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>

              {draftOpen && assay && (
                <FollowUpDraftPanel
                  email={assay.contact?.email}
                  draftFor={() => draftFor(assay)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
