import type { SavedAssay } from '../lib/storage'
import { cardClass, microLabel } from '../lib/ui'

export default function TrackerStats({ items }: { items: SavedAssay[] }) {
  if (items.length === 0) return null

  const applied = items.filter((i) =>
    ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(i.status),
  ).length
  const inPlay = items.filter((i) => ['APPLIED', 'INTERVIEW'].includes(i.status))
    .length
  const avg = Math.round(
    items.reduce((sum, i) => sum + i.result.overallScore, 0) / items.length,
  )
  const offers = items.filter((i) => i.status === 'OFFER').length
  const rejections = items.filter((i) => i.status === 'REJECTED').length

  const tiles: { n: string; label: string; suffix?: string }[] = [
    { n: String(items.length), label: 'tracked' },
    { n: String(applied), label: 'applied' },
    { n: String(inPlay), label: 'applied + interviewing' },
    { n: String(avg), label: 'avg score', suffix: '/100' },
  ]

  return (
    <div className={`${cardClass} px-5 py-4`}>
      <span className={microLabel}>Pipeline</span>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
        {tiles.map((t) => (
          <div key={t.label}>
            <div className="text-2xl font-bold tabular-nums">
              {t.n}
              {t.suffix && (
                <span className="ml-0.5 text-[12px] font-normal text-[#8a8371]">
                  {t.suffix}
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-[#8a8371]">{t.label}</div>
          </div>
        ))}
      </div>
      {(offers > 0 || rejections > 0) && (
        <p className="mt-3 text-[12px] text-[#8a8371]">
          {offers} offer{offers === 1 ? '' : 's'} · {rejections} rejected
        </p>
      )}
    </div>
  )
}
