import { useEffect, useState } from 'react'
import { Check, Copy, Mail, RotateCcw } from 'lucide-react'
import type { FollowUpOutcome } from '../lib/followup'
import { PROVIDERS } from '../lib/providers'

interface FollowUpDraftPanelProps {
  /** Contact email — when present, "Open in email" renders. */
  email?: string
  draftFor: () => Promise<FollowUpOutcome>
}

/**
 * Inline AI-drafted follow-up: loading line → subject + body →
 * Copy / mailto / regenerate. Ephemeral by design — nothing persists.
 */
export default function FollowUpDraftPanel({
  email,
  draftFor,
}: FollowUpDraftPanelProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [draft, setDraft] = useState<FollowUpOutcome['draft'] | null>(null)
  const [fallback, setFallback] = useState<{
    from: string
    used: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = () => {
    setPhase('loading')
    setError(null)
    draftFor()
      .then((outcome) => {
        setDraft(outcome.draft)
        setFallback(
          outcome.fellBackFrom
            ? {
                from: PROVIDERS[outcome.fellBackFrom].label,
                used: PROVIDERS[outcome.usedProvider].label,
              }
            : null,
        )
        setPhase('ready')
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
      })
  }

  useEffect(() => {
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCopy = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const mailto = draft
    ? `mailto:${email ?? ''}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : '#'

  return (
    <div className="border-t border-[#e2dccb] px-3 py-3">
      {phase === 'loading' && (
        <p className="text-[12.5px] text-[#8a8371]">Drafting…</p>
      )}

      {phase === 'error' && (
        <div className="rounded-lg border border-[#e3b39d] bg-[#f7e8e0] px-3 py-2 text-[12.5px] leading-relaxed text-[#8a3418]">
          {error}{' '}
          <button
            type="button"
            onClick={generate}
            className="font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {phase === 'ready' && draft && (
        <>
          {fallback && (
            <p className="mb-1.5 text-[11.5px] text-[#8a5a1d]">
              {fallback.from} was rate-limited — drafted on {fallback.used}.
            </p>
          )}
          <p className="text-[13px] font-semibold">{draft.subject}</p>
          <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-[#4a4436]">
            {draft.body}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onCopy}
              className="flex items-center gap-1 text-[12px] text-[#6f6858] transition-colors hover:text-[#26221b]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#3d5a2e]" />
                  <span className="text-[#3d5a2e]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
            {email && (
              <a
                href={mailto}
                className="flex items-center gap-1 text-[12px] text-[#6f6858] transition-colors hover:text-[#26221b]"
              >
                <Mail className="h-3.5 w-3.5" />
                Open in email
              </a>
            )}
            <button
              type="button"
              onClick={generate}
              aria-label="Regenerate draft"
              className="flex items-center gap-1 text-[12px] text-[#8a8371] transition-colors hover:text-[#26221b]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  )
}
