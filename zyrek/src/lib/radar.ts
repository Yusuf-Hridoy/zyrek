import type { SavedAssay } from './storage'

export const DAY_MS = 86_400_000

export type NudgeKind = 'APPLIED_SILENT' | 'INTERVIEW_SILENT'

export interface Nudge {
  id: string
  roleTitle: string
  company: string
  kind: NudgeKind
  daysSilent: number
  hasEmail: boolean
}

/** Two polite nudges is the professional ceiling — after that, move on. */
const MAX_FOLLOWUPS = 2

/**
 * Baselines shared with followup.ts so the AI draft references the same
 * "days since" math the radar uses.
 */
export function appliedBaseline(item: SavedAssay): number {
  return Math.max(
    item.appliedAt ?? item.createdAt,
    item.lastFollowUpAt ?? 0,
    item.statusChangedAt ?? 0,
  )
}

export function interviewBaseline(item: SavedAssay): number {
  return Math.max(item.statusChangedAt ?? item.createdAt, item.lastFollowUpAt ?? 0)
}

export function computeNudges(items: SavedAssay[], now: number): Nudge[] {
  const out: Nudge[] = []
  for (const item of items) {
    if ((item.followUpCount ?? 0) >= MAX_FOLLOWUPS) continue
    if (item.status === 'APPLIED') {
      const daysSilent = Math.floor((now - appliedBaseline(item)) / DAY_MS)
      if (daysSilent >= 7) {
        out.push({
          id: item.id,
          roleTitle: item.result.roleTitle,
          company: item.result.company,
          kind: 'APPLIED_SILENT',
          daysSilent,
          hasEmail: Boolean(item.contact?.email),
        })
      }
    } else if (item.status === 'INTERVIEW') {
      const daysSilent = Math.floor((now - interviewBaseline(item)) / DAY_MS)
      if (daysSilent >= 5) {
        out.push({
          id: item.id,
          roleTitle: item.result.roleTitle,
          company: item.result.company,
          kind: 'INTERVIEW_SILENT',
          daysSilent,
          hasEmail: Boolean(item.contact?.email),
        })
      }
    }
  }
  return out.sort((a, b) => b.daysSilent - a.daysSilent)
}
