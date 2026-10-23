import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  type AppStatus,
} from '../lib/storage'
import { cardClass, STATUS_STYLES } from '../lib/ui'

interface StatusPillProps {
  status: AppStatus
  onChange: (s: AppStatus) => void
  compact?: boolean
}

export default function StatusPill({
  status,
  onChange,
  compact = false,
}: StatusPillProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const styles = STATUS_STYLES[status]

  return (
    <div
      ref={rootRef}
      className="relative inline-flex shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`inline-flex items-center gap-1.5 rounded-md border font-mono text-[10.5px] uppercase tracking-[0.12em] ${
          compact ? 'px-2 py-0.5' : 'px-2.5 py-1'
        } ${styles.pill}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {STATUS_LABELS[status]}
        {!compact && <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div
          className={`${cardClass} absolute left-0 top-full z-50 mt-1 w-40 p-1`}
        >
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(s)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[#f2eee2]"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLES[s].dot}`}
              />
              <span className="flex-1">{STATUS_LABELS[s]}</span>
              {s === status && (
                <Check className="h-3.5 w-3.5 shrink-0 text-[#8a8371]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
