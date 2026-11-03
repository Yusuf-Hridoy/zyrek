import { useEffect, useRef, useState } from 'react'
import { Copy, Check, Download, Printer, RefreshCw } from 'lucide-react'
import type { AssayResult } from '../types/assay'
import { cardClass } from '../lib/ui'
import { renderMarkdown } from '../lib/markdown'
import { formatCoverLetter } from '../lib/letterFormat'

type Tab = 'cv' | 'letter' | 'answers'

const TABS: { id: Tab; label: string }[] = [
  { id: 'cv', label: 'Tailored CV' },
  { id: 'letter', label: 'Cover letter' },
  { id: 'answers', label: 'Form answers' },
]

function formatAnswers(result: AssayResult) {
  return result.formAnswers
    .map((f) => `Q: ${f.question}\n\n${f.answer}`)
    .join('\n\n---\n\n')
}

function bundleMarkdown(result: AssayResult) {
  return [
    `# Application package — ${result.roleTitle} @ ${result.company}`,
    '',
    `Score: ${result.overallScore}/100 — ${result.verdict}`,
    '',
    '---',
    '',
    '## Tailored CV',
    '',
    result.tailoredCv,
    '',
    '---',
    '',
    '## Cover letter',
    '',
    formatCoverLetter(result),
    '',
    '---',
    '',
    '## Form answers',
    '',
    formatAnswers(result),
    '',
  ].join('\n')
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function PackageTabs({
  result,
  onExportPdf,
  onRewriteLetter,
}: {
  result: AssayResult
  onExportPdf?: (which: 'cv' | 'letter', result: AssayResult) => void
  onRewriteLetter?: () => Promise<void>
}) {
  const [tab, setTab] = useState<Tab>('cv')
  const [copied, setCopied] = useState(false)
  const [confirmRewrite, setConfirmRewrite] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [rewriteError, setRewriteError] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Escape backs out of the confirm without touching anything.
  useEffect(() => {
    if (!confirmRewrite) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmRewrite(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmRewrite])

  const rewrite = () => {
    if (!onRewriteLetter) return
    setConfirmRewrite(false)
    setRewriting(true)
    setRewriteError(null)
    onRewriteLetter()
      .catch((e) => setRewriteError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRewriting(false))
  }

  const onTabClick = (id: Tab) => {
    setTab(id)
    setConfirmRewrite(false)
    // If the user scrolled deep into the content, bring the tab bar back —
    // otherwise leave the scroll position alone (no jumping near the top).
    if (barRef.current && barRef.current.getBoundingClientRect().top < 0) {
      barRef.current.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }

  // Display-time frame only — the stored letter stays the raw AI text.
  const letter = formatCoverLetter(result)

  const currentText = () => {
    if (tab === 'cv') return result.tailoredCv
    if (tab === 'letter') return letter
    return formatAnswers(result)
  }

  const onCopy = async () => {
    await navigator.clipboard.writeText(currentText())
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const onDownload = () => {
    const parts = [slug(result.roleTitle), slug(result.company)].filter(Boolean)
    const blob = new Blob([bundleMarkdown(result)], {
      type: 'text/markdown;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zyrek-${parts.join('-') || 'package'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const actionClass =
    'flex items-center gap-1.5 rounded-md border border-[#d8d1bf] bg-[#faf7f0] px-3 py-1.5 text-[13px] text-[#26221b] transition-colors hover:bg-[#f0ebdd]'

  return (
    <div className={cardClass}>
      {/* TAB BAR — sticky while the page scrolls (overflow-hidden on the card
          would break sticky, so the bar carries rounded-t-xl instead). */}
      <div
        ref={barRef}
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-t-xl border-b border-[#e2dccb] bg-[#faf7f0] px-4 py-2"
      >
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabClick(t.id)}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                tab === t.id
                  ? 'bg-[#26221b] font-medium text-[#f4f0e4]'
                  : 'text-[#6f6858] hover:bg-[#f0ebdd]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'letter' &&
            onRewriteLetter &&
            (confirmRewrite ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#6f6858]">
                  Replace this letter?
                </span>
                <button
                  type="button"
                  onClick={rewrite}
                  className="text-[12px] font-semibold text-[#b3492b] transition-colors hover:underline"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRewrite(false)}
                  className="text-[12px] text-[#5d574a] transition-colors hover:text-[#4a4436]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRewrite(true)}
                disabled={rewriting}
                className={`${actionClass} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {rewriting ? 'Rewriting…' : 'Rewrite'}
              </button>
            ))}
          <button type="button" onClick={onCopy} className={actionClass}>
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
          {tab !== 'answers' && onExportPdf && (
            <button
              type="button"
              onClick={() =>
                onExportPdf(
                  tab,
                  tab === 'letter' ? { ...result, coverLetter: letter } : result,
                )
              }
              className={actionClass}
            >
              <Printer className="h-3.5 w-3.5" />
              PDF
            </button>
          )}
          <button type="button" onClick={onDownload} className={actionClass}>
            <Download className="h-3.5 w-3.5" />
            .md
          </button>
        </div>
      </div>

      {tab !== 'answers' && onExportPdf && (
        <p className="px-6 pt-3 text-[11px] text-[#5d574a]">
          PDF tip: in the print dialog, untick "Headers and footers" once — your
          browser remembers it.
        </p>
      )}

      {tab === 'letter' && rewriteError && (
        <div className="mx-6 mt-4 flex items-center justify-between gap-2 rounded-lg border border-[#e3b39d] bg-[#f7e8e0] px-4 py-3 text-[12.5px] text-[#8a3418]">
          <span className="min-w-0">{rewriteError}</span>
          <button
            type="button"
            onClick={rewrite}
            className="shrink-0 text-[12px] font-semibold text-[#8a3418] underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {/* CONTENT AREA — flows with the page; no inner scroll box */}
      <div className="px-6 py-5">
        {tab === 'answers' ? (
          <div className="flex flex-col">
            {result.formAnswers.map((f, i) => (
              <div
                key={i}
                className={i > 0 ? 'border-t border-[#e2dccb] pt-4 mt-4' : ''}
              >
                <p className="text-[14px] font-bold">{f.question}</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-[#4a4436]">
                  {f.answer}
                </p>
              </div>
            ))}
          </div>
        ) : tab === 'cv' ? (
          <div>{renderMarkdown(result.tailoredCv)}</div>
        ) : (
          <div>{renderMarkdown(letter)}</div>
        )}
      </div>
    </div>
  )
}
