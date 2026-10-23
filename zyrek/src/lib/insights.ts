import type { SavedAssay } from './storage'

export interface SkillAggregate {
  skill: string
  totalJds: number
  required: number
  strong: number
  weak: number
  missing: number
  gapScore: number
}

export interface InsightsData {
  withSignals: number
  total: number
  demanded: SkillAggregate[]
  gaps: SkillAggregate[]
  weakestDimensions: { label: string; avg: number; count: number }[]
}

interface MutableAggregate {
  counts: Map<string, number> // casing -> times seen
  totalJds: number
  required: number
  strong: number
  weak: number
  missing: number
}

export function computeInsights(items: SavedAssay[]): InsightsData {
  const withSignals = items.filter(
    (i) => Array.isArray(i.result?.signals) && i.result.signals.length > 0,
  ).length

  const skills = new Map<string, MutableAggregate>()
  for (const item of items) {
    const seenInThisAssay = new Set<string>()
    for (const sig of item.result?.signals ?? []) {
      const key = sig.skill.trim().toLowerCase()
      if (!key || seenInThisAssay.has(key)) continue
      seenInThisAssay.add(key)
      let agg = skills.get(key)
      if (!agg) {
        agg = {
          counts: new Map(),
          totalJds: 0,
          required: 0,
          strong: 0,
          weak: 0,
          missing: 0,
        }
        skills.set(key, agg)
      }
      agg.totalJds += 1
      agg.counts.set(sig.skill, (agg.counts.get(sig.skill) ?? 0) + 1)
      if (sig.demand === 'REQUIRED') agg.required += 1
      if (sig.evidence === 'STRONG') agg.strong += 1
      else if (sig.evidence === 'MISSING') agg.missing += 1
      else agg.weak += 1
    }
  }

  function toAggregate(key: string, agg: MutableAggregate): SkillAggregate {
    let skill = key
    let best = 0
    for (const [casing, count] of agg.counts) {
      if (count > best) {
        best = count
        skill = casing
      }
    }
    return {
      skill,
      totalJds: agg.totalJds,
      required: agg.required,
      strong: agg.strong,
      weak: agg.weak,
      missing: agg.missing,
      gapScore: agg.missing * 2 + agg.weak,
    }
  }

  const all = [...skills.entries()].map(([key, agg]) => toAggregate(key, agg))

  const demanded = all
    .slice()
    .sort((a, b) => b.totalJds - a.totalJds || b.required - a.required)
    .slice(0, 8)

  const gaps = all
    .filter((a) => a.totalJds >= 2 && a.gapScore > 0)
    .sort((a, b) => b.gapScore - a.gapScore || b.totalJds - a.totalJds)
    .slice(0, 8)

  const dimMap = new Map<string, { sum: number; count: number }>()
  for (const item of items) {
    for (const d of item.result?.dimensions ?? []) {
      if (typeof d.label !== 'string' || typeof d.score !== 'number') continue
      const entry = dimMap.get(d.label) ?? { sum: 0, count: 0 }
      entry.sum += d.score
      entry.count += 1
      dimMap.set(d.label, entry)
    }
  }
  const weakestDimensions = [...dimMap.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([label, v]) => ({ label, avg: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)

  return { withSignals, total: items.length, demanded, gaps, weakestDimensions }
}
