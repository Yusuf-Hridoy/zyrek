import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { computeInsights, type SkillAggregate } from '../lib/insights'
import type { SavedAssay } from '../lib/storage'
import { cardClass, microLabel } from '../lib/ui'

function EvidenceSummary({ agg }: { agg: SkillAggregate }) {
  const parts = [
    agg.missing > 0 && { n: agg.missing, label: 'missing', text: 'text-[#9c3d1e]', dot: 'bg-[#b3492b]' },
    agg.weak > 0 && { n: agg.weak, label: 'weak', text: 'text-[#8a5a1d]', dot: 'bg-[#c9962e]' },
    agg.strong > 0 && { n: agg.strong, label: 'strong', text: 'text-[#3d5a2e]', dot: 'bg-[#5a8a3e]' },
  ].filter(Boolean) as { n: number; label: string; text: string; dot: string }[]

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] tabular-nums">
      {parts.map((p) => (
        <span key={p.label} className={`flex items-center gap-1 ${p.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full sm:hidden ${p.dot}`} />
          <span className="sm:hidden">{p.n}</span>
          <span className="hidden sm:inline">
            {p.n} {p.label}
          </span>
        </span>
      ))}
    </span>
  )
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`max-w-[45%] shrink-0 truncate rounded-md border px-2 py-0.5 font-mono text-[10.5px] ${className}`}
    >
      {children}
    </span>
  )
}

export default function InsightsPanel({
  items,
  defaultOpen = false,
}: {
  items: SavedAssay[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const data = useMemo(() => computeInsights(items), [items])

  if (data.withSignals < 3) return null

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2 border-b border-[#e2dccb] px-5 py-4">
        <span className={microLabel}>Insights</span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#8a8371]">
            based on {data.withSignals} of {data.total} assays
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse insights' : 'Expand insights'}
            className="rounded-lg p-1 text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#4a4436]"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-5 py-4">
          <p className={microLabel}>The market keeps asking for</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {data.demanded.map((agg) => (
              <div key={agg.skill} className="flex items-center gap-2">
                <Chip
                  className={
                    agg.required > agg.totalJds / 2
                      ? 'border-[#ddd6c4] bg-[#efe9d9] font-semibold text-[#26221b]'
                      : 'border-[#ddd6c4] bg-[#efe9d9] text-[#6f6858]'
                  }
                >
                  {agg.skill}
                </Chip>
                <span className="shrink-0 text-[11.5px] text-[#8a8371]">
                  in {agg.totalJds}/{data.withSignals} JDs
                </span>
                <span className="ml-auto">
                  <EvidenceSummary agg={agg} />
                </span>
              </div>
            ))}
          </div>

          <div className="my-3 border-t border-[#e2dccb]" />

          <p className={microLabel}>Your biggest gaps</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {data.gaps.length === 0 ? (
              <p className="text-[12.5px] text-[#8a8371]">
                No repeated gaps yet — your evidence covers what these JDs ask
                for.
              </p>
            ) : (
              data.gaps.map((agg) => (
                <div key={agg.skill} className="flex items-center gap-2">
                  <Chip
                    className={
                      agg.missing > 0
                        ? 'border-[#e3b39d] bg-[#f3ddd3] text-[#9c3d1e]'
                        : 'border-[#e0c795] bg-[#f3e8d3] text-[#8a5a1d]'
                    }
                  >
                    {agg.skill}
                  </Chip>
                  <span className="shrink-0 text-[11.5px] text-[#8a8371]">
                    in {agg.totalJds}/{data.withSignals} JDs
                  </span>
                  <span className="ml-auto">
                    <EvidenceSummary agg={agg} />
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="my-3 border-t border-[#e2dccb]" />

          <p className={microLabel}>Weakest dimensions</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {data.weakestDimensions.map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {d.label}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-[13px]">
                  {d.avg}
                </span>
                <span className="shrink-0 text-[11.5px] text-[#8a8371]">
                  avg · {d.count} assays
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
