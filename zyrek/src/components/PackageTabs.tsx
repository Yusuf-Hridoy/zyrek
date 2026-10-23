import { useRef, useState } from 'react'
import { Copy, Check, Download, Printer } from 'lucide-react'
import type { AssayResult } from '../types/assay'
import { cardClass } from '../lib/ui'
import { renderMarkdown } from '../lib/markdown'

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
    result.coverLetter,
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
}: {
  result: AssayResult
  onExportPdf?: (which: 'cv' | 'letter', result: AssayResult) => void
}) {
  const [tab, setTab] = useState<Tab>('cv')
  const [copied, setCopied] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const onTabClick = (id: Tab) => {
    setTab(id)
    // If the user scrolled deep into the content, bring the tab bar back —
    // otherwise leave the scroll position alone (no jumping near the top).
    if (barRef.current && barRef.current.getBoundingClientRect().top < 0) {
      barRef.current.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }

  const currentText = () => {
    if (tab === 'cv') return result.tailoredCv
    if (tab === 'letter') return result.coverLetter
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
        <div className="flex items-center gap-2">
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
              onClick={() => onExportPdf(tab, result)}
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
          <div>{renderMarkdown(result.coverLetter)}</div>
        )}
      </div>
    </div>
  )
}
