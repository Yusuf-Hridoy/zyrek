/**
 * Code-level gap-discipline verifier (pure, no React, no Date.now()).
 *
 * Cross-checks a generated tailored CV against the run's skill signals and
 * the master resume, catching skills that slipped into the package without
 * resume evidence. This is a heuristic tripwire, not a court: when in doubt
 * it stays quiet (favor missing a borderline case over false-flagging).
 *
 * Known abbreviation asymmetry, accepted deliberately: a resume writing
 * "JavaScript (JS)" lets both forms through, because the parenthetical pair
 * normalizes to "... javascript js ..."; a resume saying only "JS" while the
 * CV upgrades it to "JavaScript" WILL flag — that's the keyword-stuffing
 * pattern this exists to catch, and the user can see why.
 */
import type { AssayResult } from '../types/assay'

export interface StuffingReport {
  gapLeaks: string[] // MISSING-evidence signals whose skill text appears in the tailored CV
  unknownSkills: string[] // tokens in the CV's skills section not found in the master resume
}

/**
 * normalize(s): lowercase, every non-alphanumeric char becomes a single
 * space, runs of spaces collapse, trim. All comparisons below happen on
 * normalized text with padded-space word-boundary containment
 * (' haystack '.includes(' needle ')), so "Java" never matches inside
 * "JavaScript".
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Word-boundary containment on normalized text. */
function containsNorm(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `)
}

/**
 * Locate the CV's skills section: the block between the first '#'-prefixed
 * heading line whose normalized text contains "skill" and the next
 * '#'-prefixed heading (or end of CV). Heading-only matching keeps summary
 * prose ("highly skilled…") from posing as the section. Returns null when no
 * such heading exists — never guess.
 */
function skillsSectionLines(cv: string): string[] | null {
  const lines = cv.split('\n')
  const start = lines.findIndex(
    (l) => l.trim().startsWith('#') && normalize(l).includes('skill'),
  )
  if (start === -1) return null
  const block: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('#')) break
    block.push(lines[i])
  }
  return block
}

export function checkStuffing(result: AssayResult, masterResume: string): StuffingReport {
  const cvNorm = normalize(result.tailoredCv)
  const resumeNorm = normalize(masterResume)

  // gapLeaks: MISSING-evidence signals whose skill text leaked into the CV.
  // Skills of 1–2 normalized chars are skipped (too noisy: "C", "R", "Go"…).
  const gapLeaks: string[] = []
  const seenGap = new Set<string>()
  for (const sig of result.signals ?? []) {
    if (sig.evidence !== 'MISSING') continue
    const skill = normalize(sig.skill)
    if (skill.length <= 2 || seenGap.has(skill)) continue
    seenGap.add(skill)
    if (containsNorm(cvNorm, skill)) gapLeaks.push(sig.skill) // signal's display casing
  }

  // unknownSkills: tokens in the CV's skills section that don't occur in the
  // master resume at all. Group labels ("**Automation:**") are not tokens —
  // only what follows a colon counts. No skills heading → empty (never guess).
  const unknownSkills: string[] = []
  const block = skillsSectionLines(result.tailoredCv)
  if (block) {
    const seenUnknown = new Set<string>()
    for (const raw of block) {
      const afterColon = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw
      const cleaned = afterColon.replace(/\*/g, '')
      for (const piece of cleaned.split(',')) {
        const token = normalize(piece)
        if (token.length < 3 || seenUnknown.has(token)) continue
        seenUnknown.add(token)
        if (!containsNorm(resumeNorm, token)) {
          unknownSkills.push(piece.trim()) // CV's display casing
        }
      }
    }
  }

  return { gapLeaks, unknownSkills }
}
