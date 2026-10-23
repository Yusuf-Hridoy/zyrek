import { useMemo, useState } from 'react'
import TrackerStats from '../components/TrackerStats'
import HistoryPanel from '../components/HistoryPanel'
import RadarCard from '../components/RadarCard'
import { computeNudges } from '../lib/radar'
import type { FollowUpOutcome } from '../lib/followup'
import type { AppStatus, SavedAssay } from '../lib/storage'

interface PipelineViewProps {
  items: SavedAssay[]
  activeId: string | null
  onOpen: (item: SavedAssay) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: AppStatus) => void
  onDone: (id: string) => void
  onIcs: (assay: SavedAssay) => void
  draftFor: (assay: SavedAssay) => Promise<FollowUpOutcome>
}

export default function PipelineView({
  items,
  activeId,
  onOpen,
  onDelete,
  onStatusChange,
  onDone,
  onIcs,
  draftFor,
}: PipelineViewProps) {
  const [now] = useState(() => Date.now())
  const nudges = useMemo(() => computeNudges(items, now), [items, now])

  return (
    <>
      <section className="max-w-3xl pt-10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-2 text-[14px] text-[#6f6858]">
          Every application you've run, with its status.
        </p>
      </section>

      <section className="flex max-w-3xl flex-col gap-6 pb-16">
        {nudges.length > 0 && (
          <RadarCard
            nudges={nudges}
            items={items}
            onOpen={(id) => {
              const item = items.find((i) => i.id === id)
              if (item) onOpen(item)
            }}
            onDone={onDone}
            onIcs={onIcs}
            draftFor={draftFor}
          />
        )}
        <TrackerStats items={items} />
        <HistoryPanel
          items={items}
          activeId={activeId}
          onOpen={onOpen}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      </section>
    </>
  )
}
