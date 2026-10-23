import { useMemo } from 'react'
import { checkStuffing } from '../lib/stuffingCheck'
import type { AssayResult } from '../types/assay'

interface IntegrityWarningProps {
  result: AssayResult
  masterResume: string
  savedAssay?: boolean
}

/** Max 5 names inline, then "and {k} more". */
function formatList(names: string[]): string {
  const shown = names.slice(0, 5)
  const rest = names.length - shown.length
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ')
}

/**
 * Quiet tripwire for gap discipline: shows one clay strip when the verifier
 * finds skills in the CV the resume doesn't support. Renders NOTHING when
 * clean (per the quiet-states rule) — no badge, no icon, no dismiss.
 */
export default function IntegrityWarning({
  result,
  masterResume,
  savedAssay = false,
}: IntegrityWarningProps) {
  const report = useMemo(
    () => checkStuffing(result, masterResume),
    [result, masterResume],
  )
  if (report.gapLeaks.length === 0 && report.unknownSkills.length === 0) {
    return null
  }

  // unknownSkills already named as gap leaks are dropped (case-insensitive).
  const gapLower = new Set(report.gapLeaks.map((s) => s.toLowerCase()))
  const alsoUnknown = report.unknownSkills.filter((s) => !gapLower.has(s.toLowerCase()))

  const primary = report.gapLeaks.length > 0 ? report.gapLeaks : alsoUnknown
  const sentences = [
    `The CV mentions ${primary.length} skill${
      primary.length === 1 ? '' : 's'
    } your resume doesn't support: ${formatList(primary)}.`,
  ]
  if (report.gapLeaks.length > 0 && alsoUnknown.length > 0) {
    sentences.push(`Also not found in your resume: ${formatList(alsoUnknown)}.`)
  }

  return (
    <div className="rounded-lg border border-[#e3b39d] bg-[#f3ddd3] px-4 py-2.5 text-[12.5px] text-[#9c3d1e]">
      <p>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em]">
          Integrity check
        </span>{' '}
        {sentences.join(' ')}
      </p>
      <p className="mt-1 text-[#9c3d1e]/70">
        Remove them or re-run the assay — sending unsupported skills backfires
        in interviews.
        {savedAssay && ' (checked against your current master resume)'}
      </p>
    </div>
  )
}
