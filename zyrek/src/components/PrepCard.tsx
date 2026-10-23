import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  RotateCcw,
  Shuffle,
} from 'lucide-react'
import { runPrep } from '../lib/prep'
import type { SavedAssay } from '../lib/storage'
import { cardClass, microLabel } from '../lib/ui'
import type {
  InterviewPrep,
  PrepCategory,
  PrepConfidence,
  PrepQuestion,
} from '../types/assay'
import type { ProviderId } from '../lib/providers'
import { PROVIDERS } from '../lib/providers'

interface PrepCardProps {
  assay: SavedAssay
  resume: string
  activeProvider: ProviderId
  keys: Partial<Record<ProviderId, string>>
  onPrepSaved: (id: string, prep: InterviewPrep) => void
}

const CATEGORY_ORDER: PrepCategory[] = ['GAP_PROBE', 'TECHNICAL', 'DOMAIN', 'BEHAVIORAL']

const GROUP_LABELS: Record<PrepCategory, string> = {
  GAP_PROBE: 'Gap probes',
  TECHNICAL: 'Technical',
  DOMAIN: 'Domain',
  BEHAVIORAL: 'Behavioral',
}

const CHIP_STYLES: Record<PrepCategory, string> = {
  GAP_PROBE: 'border-[#e3b39d] bg-[#f3ddd3] text-[#9c3d1e]',
  TECHNICAL: 'border-[#ddd6c4] bg-[#efe9d9] text-[#6f6858]',
  DOMAIN: 'border-[#e0c795] bg-[#f3e8d3] text-[#8a5a1d]',
  BEHAVIORAL: 'border-[#b9cba6] bg-[#e3ecda] text-[#3d5a2e]',
}

const CONF_LABELS: Record<PrepConfidence, string> = {
  READY: 'ready',
  PRACTICE: 'practice',
  RISKY: 'risky',
}

const CONF_STYLES: Record<PrepConfidence, string> = {
  READY: 'text-[#8a8371]',
  PRACTICE: 'text-[#8a8371]',
  RISKY: 'text-[#9c3d1e]',
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

function Chip({ category }: { category: PrepCategory }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10.5px] ${CHIP_STYLES[category]}`}
    >
      {GROUP_LABELS[category].toUpperCase()}
    </span>
  )
}

function Confidence({ value }: { value: PrepConfidence }) {
  return (
    <span
      className={`shrink-0 font-mono text-[10.5px] ${CONF_STYLES[value]}`}
    >
      {CONF_LABELS[value]}
    </span>
  )
}

export default function PrepCard({
  assay,
  resume,
  activeProvider,
  keys,
  onPrepSaved,
}: PrepCardProps) {
  const prep = assay.prep
  const rootRef = useRef<HTMLDivElement>(null)
  const prevPrepRef = useRef(prep)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ from: string; used: string } | null>(null)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [mode, setMode] = useState<'list' | 'cards'>('list')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [order, setOrder] = useState<number[]>(() =>
    (prep?.questions ?? []).map((_, i) => i),
  )
  const [current, setCurrent] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const generate = () => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setGenerating(true)
    setError(null)
    setNotice(null)
    runPrep(activeProvider, keys, assay, resume)
      .then((outcome) => {
        onPrepSaved(assay.id, outcome.prep)
        setOrder(outcome.prep.questions.map((_, i) => i))
        setCurrent(0)
        setRevealed(false)
        setExpanded(null)
        setMode('list')
        if (outcome.fellBackFrom) {
          setNotice({
            from: PROVIDERS[outcome.fellBackFrom].label,
            used: PROVIDERS[outcome.usedProvider].label,
          })
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setGenerating(false))
  }

  // scroll once when a generation (or regeneration) lands — never on mere open
  useEffect(() => {
    if (prep && prep !== prevPrepRef.current) {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    prevPrepRef.current = prep
  }, [prep])

  const nav = (dir: number) => {
    setCurrent((c) => (c + dir + order.length) % order.length)
    setRevealed(false)
  }

  const shuffle = () => {
    const next = [...order]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    setOrder(next)
    setCurrent(0)
    setRevealed(false)
  }

  useEffect(() => {
    if (mode !== 'cards') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        nav(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        nav(1)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setRevealed(true)
      } else if (e.key === 'Escape') {
        setMode('list')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const resumeTooShort = resume.trim().length < 100
  const questions = prep?.questions ?? []
  const cardQuestion: PrepQuestion | undefined =
    mode === 'cards' ? questions[order[current]] : undefined

  return (
    <div ref={rootRef} className={cardClass}>
      <div className="flex items-center justify-between gap-2 border-b border-[#e2dccb] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className={microLabel}>Interview prep</span>
          {prep && (
            <span className="truncate text-[11.5px] text-[#8a8371]">
              {questions.length} questions · {relativeDate(prep.generatedAt)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!prep ? (
            <button
              type="button"
              onClick={generate}
              disabled={generating || resumeTooShort}
              title={resumeTooShort ? 'Save a master resume first' : undefined}
              className="rounded-lg bg-[#26221b] px-3 py-1.5 text-[12px] font-semibold text-[#f4f0e4] transition-colors hover:bg-[#3a352c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? 'Generating…' : 'Generate prep'}
            </button>
          ) : confirmRegen ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#6f6858]">
                Replace existing prep?
              </span>
              <button
                type="button"
                onClick={() => {
                  setConfirmRegen(false)
                  generate()
                }}
                className="text-[12px] font-semibold text-[#b3492b] transition-colors hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setConfirmRegen(false)}
                className="text-[12px] text-[#8a8371] transition-colors hover:text-[#4a4436]"
              >
                Keep
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode((m) => (m === 'cards' ? 'list' : 'cards'))}
                title={mode === 'cards' ? 'Back to list' : 'Flashcards'}
                className={`rounded-lg p-1.5 transition-colors hover:bg-[#f2eee2] ${
                  mode === 'cards'
                    ? 'text-[#26221b]'
                    : 'text-[#8a8371] hover:text-[#26221b]'
                }`}
              >
                <Layers className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmRegen(true)}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[12px] text-[#8a8371] transition-colors hover:text-[#26221b] disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p className="px-5 pt-3 text-[11.5px] text-[#8a5a1d]">
          {notice.from} was rate-limited — generated on {notice.used}.
        </p>
      )}
      {generating && prep && (
        <p className="px-5 pt-3 text-[12px] text-[#8a8371]">
          Preparing questions…
        </p>
      )}
      {!prep && generating && (
        <p className="px-5 py-4 text-[12px] text-[#8a8371]">
          Preparing questions…
        </p>
      )}
      {error && (
        <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#e3b39d] bg-[#f7e8e0] px-4 py-3 text-[12.5px] text-[#8a3418]">
          <span className="min-w-0">{error}</span>
          <button
            type="button"
            onClick={generate}
            className="shrink-0 text-[12px] font-semibold text-[#8a3418] underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {prep && mode === 'list' && (
        <div className="px-3 py-2">
          {CATEGORY_ORDER.map((cat) => {
            const inGroup = questions
              .map((q, i) => ({ q, i }))
              .filter(({ q }) => q.category === cat)
            if (inGroup.length === 0) return null
            return (
              <div key={cat} className="py-1.5">
                <p className={`px-2 pb-1 ${microLabel}`}>{GROUP_LABELS[cat]}</p>
                {inGroup.map(({ q, i }) => (
                  <div key={i}>
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => (e === i ? null : i))}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#f2eee2]"
                    >
                      <Chip category={q.category} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {q.question}
                      </span>
                      <Confidence value={q.confidence} />
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-[#8a8371] transition-transform ${
                          expanded === i ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expanded === i && (
                      <div className="px-2 pb-3 pt-1">
                        {q.whyAsked && (
                          <p className="text-[11.5px] italic leading-relaxed text-[#8a8371]">
                            {q.whyAsked}
                          </p>
                        )}
                        <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[#26221b]">
                          {q.answer}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {prep && mode === 'cards' && cardQuestion && (
        <div className="px-5 pb-4 pt-2">
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-center">
            <Chip category={cardQuestion.category} />
            <p className="text-[15px] font-medium leading-relaxed">
              {cardQuestion.question}
            </p>
            {revealed ? (
              <>
                <p className="w-full whitespace-pre-line text-left text-[13px] leading-relaxed text-[#26221b]">
                  {cardQuestion.answer}
                </p>
                {cardQuestion.whyAsked && (
                  <p className="text-left text-[11.5px] italic leading-relaxed text-[#8a8371]">
                    {cardQuestion.whyAsked}
                  </p>
                )}
                <Confidence value={cardQuestion.confidence} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="text-[12.5px] text-[#8a8371] underline underline-offset-2 transition-colors hover:text-[#26221b]"
              >
                Show answer
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1 border-t border-[#e2dccb] pt-3">
            <button
              type="button"
              onClick={() => nav(-1)}
              aria-label="Previous question"
              className="rounded-lg p-1.5 text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#26221b]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="flex-1 text-center font-mono text-[11.5px] tabular-nums text-[#8a8371]">
              {current + 1} of {order.length}
            </span>
            <button
              type="button"
              onClick={() => nav(1)}
              aria-label="Next question"
              className="rounded-lg p-1.5 text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#26221b]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={shuffle}
              aria-label="Shuffle questions"
              className="rounded-lg p-1.5 text-[#8a8371] transition-colors hover:bg-[#f2eee2] hover:text-[#26221b]"
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
