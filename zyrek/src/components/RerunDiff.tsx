import { cardClass } from '../lib/ui'

export interface RerunDiff {
  fromScore: number
  toScore: number
  dimensions: { label: string; delta: number }[]
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0'
}

export default function RerunDiff({ diff }: { diff: RerunDiff }) {
  const delta = diff.toScore - diff.fromScore
  const deltaColor =
    delta > 0 ? 'text-[#3d5a2e]' : delta < 0 ? 'text-[#9c3d1e]' : 'text-[#8a8371]'

  return (
    <div className={`${cardClass} rounded-lg px-4 py-2.5`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#8a8371]">
          Re-run
        </span>
        <span className="text-[13px] font-semibold tabular-nums">
          {diff.fromScore} → {diff.toScore}
        </span>
        <span className={`text-[13px] font-semibold tabular-nums ${deltaColor}`}>
          ({signed(delta)})
        </span>
        {diff.dimensions.length === 0 ? (
          <span className="text-[11.5px] text-[#8a8371]">
            no dimension moved meaningfully
          </span>
        ) : (
          diff.dimensions.map((d) => (
            <span
              key={d.label}
              className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                d.delta > 0
                  ? 'border-[#b9cba6] bg-[#e3ecda] text-[#3d5a2e]'
                  : 'border-[#e3b39d] bg-[#f3ddd3] text-[#9c3d1e]'
              }`}
            >
              {d.label.split(' ')[0]} {signed(d.delta)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
