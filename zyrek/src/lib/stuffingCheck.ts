/**
 * Code-level gap-discipline verifier (pure, no React, no Date.now()).
 *
 * Cross-checks a generated tailored CV against the run's skill signals and
 * the master resume, catching skills that slipped into the package without
 * resume evidence. This is a heuristic tripwire, not a court: when in doubt
 * it stays quiet (favor missing a borderline case over false-flagging).
 *
 * Matching is graduated, because rule 2(c) of the system prompt deliberately
 * tells the model to mirror JD terminology: a REAL resume skill may arrive
 * renamed ("Regression" → "Regression Testing", "managed the defect
 * lifecycle" → "Defect Lifecycle Management"), and that must not flag.
 * skillSupported() therefore tolerates generic-suffix additions and simple
 * plural drift, while still catching skills the resume never names.
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
 * Plural tolerance: a phrase also matches when its last word gains or loses
 * a trailing 's' — "requirement analysis" satisfies a resume writing
 * "requirements". Word-boundary padding keeps this safe: stripping the 's'
 * from "kubernetes" cannot match inside " kubernetes " because the padding
 * demands a real word edge.
 */
function containsTolerant(haystack: string, phrase: string): boolean {
  const words = phrase.split(' ')
  const last = words[words.length - 1]
  const variants = [phrase]
  if (last.endsWith('s')) variants.push([...words.slice(0, -1), last.slice(0, -1)].join(' '))
  variants.push([...words.slice(0, -1), `${last}s`].join(' '))
  return variants.some((v) => containsNorm(haystack, v))
}

/**
 * Generic suffix words a model adds when mirroring JD phrasing. Dropping
 * them tests the skill's core name ("regression testing" → "regression").
 */
const GENERIC_SUFFIXES = new Set([
  'testing',
  'tests',
  'test',
  'execution',
  'management',
  'methodologies',
  'methodology',
  'skills',
  'analysis',
])

/** True when every word of the token is only a generic suffix ("Testing",
 *  "Test Execution") — such tokens carry no skill identity, never flag. */
function isOnlyGenericSuffixes(token: string): boolean {
  return token.split(' ').every((w) => GENERIC_SUFFIXES.has(w))
}

/**
 * Is a CV skills token supported by the master resume?
 *  1. full normalized phrase containment (with plural tolerance);
 *  2. while the phrase has >1 word and its LAST word is a generic suffix,
 *     drop that word and retry on the remainder — "manual test execution"
 *     → "manual test" → "manual", each retested;
 *  3. plural tolerance applies at every step above.
 * Anything still unsupported is a genuine introduction candidate.
 */
function skillSupported(token: string, resumeNorm: string): boolean {
  if (containsTolerant(resumeNorm, token)) return true
  let phrase = token
  while (phrase.includes(' ') && GENERIC_SUFFIXES.has(phrase.split(' ').pop()!)) {
    phrase = phrase.split(' ').slice(0, -1).join(' ')
    if (phrase && containsTolerant(resumeNorm, phrase)) return true
  }
  return false
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
  // Only plural tolerance applies here — no suffix stripping: this test is
  // about PRESENCE in the CV, so the phrase must match as written (modulo
  // plural drift), never relaxed by dropping words.
  const gapLeaks: string[] = []
  const seenGap = new Set<string>()
  for (const sig of result.signals ?? []) {
    if (sig.evidence !== 'MISSING') continue
    const skill = normalize(sig.skill)
    if (skill.length <= 2 || seenGap.has(skill)) continue
    seenGap.add(skill)
    if (containsTolerant(cvNorm, skill)) gapLeaks.push(sig.skill) // signal's display casing
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
        if (isOnlyGenericSuffixes(token)) continue // "Testing" alone — no skill identity
        if (!skillSupported(token, resumeNorm)) {
          unknownSkills.push(piece.trim()) // CV's display casing
        }
      }
    }
  }

  return { gapLeaks, unknownSkills }
}
