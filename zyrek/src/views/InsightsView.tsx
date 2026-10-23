import InsightsPanel from '../components/InsightsPanel'
import { computeInsights } from '../lib/insights'
import type { SavedAssay } from '../lib/storage'

export default function InsightsView({ items }: { items: SavedAssay[] }) {
  const data = computeInsights(items)

  return (
    <>
      <section className="max-w-3xl pt-10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
        <p className="mt-2 text-[14px] text-[#6f6858]">
          Patterns across the job posts you've run.
        </p>
      </section>

      <section className="max-w-3xl pb-16">
        {data.withSignals < 3 ? (
          <p className="text-[13.5px] text-[#8a8371]">
            Not enough data yet — run a few more.
          </p>
        ) : (
          <InsightsPanel items={items} defaultOpen />
        )}
      </section>
    </>
  )
}
