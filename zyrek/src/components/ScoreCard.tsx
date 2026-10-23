import { useEffect, useState } from 'react'
import type { AssayResult } from '../types/assay'
import { cardClass, microLabel } from '../lib/ui'

const labelClass = microLabel

const VERDICT_STYLES: Record<AssayResult['verdict'], string> = {
  'STRONG MATCH': 'bg-[#e3ecda] text-[#3d5a2e] border-[#b9cba6]',
  'GOOD MATCH': 'bg-[#e9efdc] text-[#5a6428] border-[#cdd6a8]',
  'PARTIAL MATCH': 'bg-[#f3e8d3] text-[#8a5a1d] border-[#e0c795]',
  'WEAK MATCH': 'bg-[#f3ddd3] text-[#9c3d1e] border-[#e3b39d]',
}

export default function ScoreCard({ result }: { result: AssayResult }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={`overflow-hidden ${cardClass}`}>
      {/* HEADER STRIP */}
      <div className="flex items-center justify-between border-b border-[#e2dccb] px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-[3px] bg-[#26221b]" />
          <span className="text-[15px] font-semibold">Zyrek</span>
        </div>
        <span className={labelClass}>Graded Package</span>
      </div>

      {/* ROLE + SCORE */}
      <div className="border-b border-[#e2dccb] px-6 py-6">
        <p className={labelClass}>Application To</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">
          {result.roleTitle}
        </h2>
        <p className="mt-1.5 text-[14px] text-[#6f6858]">
          {result.company}
          {result.companyContext ? ` · ${result.companyContext}` : ''}
        </p>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div>
            <span
              className={`inline-block rounded-md border px-3 py-1 font-mono text-[11px] tracking-[0.14em] ${VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES['PARTIAL MATCH']}`}
            >
              {result.verdict}
            </span>
            <div className="mt-3">
              <span className="text-7xl font-bold tracking-tighter tabular-nums">
                {result.overallScore}
              </span>
              <span className="align-baseline text-2xl text-[#9a937f]">
                /100
              </span>
            </div>
          </div>
          <p className="min-w-0 flex-1 pt-0 text-[15px] leading-relaxed text-[#4a4436] sm:pt-8">
            {result.summary}
          </p>
        </div>
      </div>

      {/* DIMENSION SCORES */}
      <div className="border-b border-[#e2dccb] px-6 py-5">
        <p className={labelClass}>Dimension Scores</p>
        <div className="mt-2">
          {result.dimensions.map((d) => (
            <div key={d.label} className="py-2.5">
              <div className="flex items-center gap-4">
                <span className="w-32 shrink-0 text-[15px] sm:w-48">{d.label}</span>
                <div className="h-[7px] flex-1 rounded-full bg-[#e3ddcd]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      d.score < 80 ? 'bg-[#b3492b]' : 'bg-[#26221b]'
                    }`}
                    style={{ width: `${mounted ? d.score : 0}%` }}
                  />
                </div>
                <span
                  className={`w-8 shrink-0 text-right text-[14px] tabular-nums ${
                    d.score < 80 ? 'text-[#b3492b]' : 'text-[#26221b]'
                  }`}
                >
                  {d.score}
                </span>
              </div>
              {typeof d.note === 'string' && d.note.trim() !== '' && (
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#8a8371]">
                  {d.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SCREENING PANEL */}
      <div className="px-6 py-5">
        <p className={labelClass}>
          Screening Panel · {result.reviewers.length} Reviewers
        </p>
        <div className="mt-3 flex flex-col gap-5">
          {result.reviewers.map((r) => (
            <div key={r.role} className="flex gap-4">
              <span className="w-24 shrink-0 pt-0.5 font-mono text-[11px] font-medium text-[#3d5a2e]">
                {r.role}
              </span>
              <div className="min-w-0 border-l-2 border-[#e2dccb] pl-4">
                <p className="text-[15px] font-semibold">{r.title}</p>
                <p className="mt-1 text-[14.5px] leading-relaxed text-[#4a4436]">
                  {r.comment}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
