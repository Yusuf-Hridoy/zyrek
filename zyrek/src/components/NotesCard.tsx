import { useEffect, useRef, useState } from 'react'
import type { SavedAssay } from '../lib/storage'
import { cardClass, microLabel } from '../lib/ui'

interface NotesCardProps {
  assay: SavedAssay
  onSave: (id: string, notes: string) => void
}

export default function NotesCard({ assay, onSave }: NotesCardProps) {
  const [draft, setDraft] = useState(assay.notes)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<number | null>(null)
  const savedRef = useRef(assay.notes)
  const draftRef = useRef(assay.notes)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // flush any pending debounce when switching assays or unmounting
  useEffect(() => {
    return () => {
      clearTimer()
      if (draftRef.current !== savedRef.current) {
        onSave(assay.id, draftRef.current)
      }
    }
  }, [assay.id, onSave])

  const scheduleSave = (value: string) => {
    clearTimer()
    setSaveState('saving')
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      if (value !== savedRef.current) {
        savedRef.current = value
        onSave(assay.id, value)
      }
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2000)
    }, 800)
  }

  const handleChange = (value: string) => {
    draftRef.current = value
    setDraft(value)
    scheduleSave(value)
  }

  const handleBlur = () => {
    clearTimer()
    if (draftRef.current !== savedRef.current) {
      savedRef.current = draftRef.current
      onSave(assay.id, draftRef.current)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('idle')
    }
  }

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between border-b border-[#e2dccb] px-5 py-4">
        <span className={microLabel}>Notes</span>
        <span className="relative h-4 w-14 text-right">
          <span
            className={`absolute inset-0 text-[11px] text-[#8a8371] transition-opacity ${
              saveState === 'saving' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Saving…
          </span>
          <span
            className={`absolute inset-0 text-[11px] text-[#8a8371] transition-opacity ${
              saveState === 'saved' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Saved
          </span>
        </span>
      </div>
      <div className="px-5 py-4">
        <textarea
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Referral contact, salary asked, interview dates, follow-up reminders…"
          className="min-h-[96px] w-full resize-y rounded-lg border border-[#e2dccb] bg-[#f2eee2]/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#26221b] placeholder:text-[#a39b86] focus:border-[#b3492b]/40 focus:outline-none"
        />
      </div>
    </div>
  )
}
