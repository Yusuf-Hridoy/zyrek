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
 * lifecycle" → "Defect Lifecycle Management", "Click Up" → "ClickUp"), and
 * that must not flag. skillSupported() therefore tolerates generic-suffix
 * additions, simple plural drift, and one-word/two-word spacing variants,
 * while still catching skills the resume never names.
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

/** Precomputed resume shape for the matcher: words + joined adjacent pairs. */
interface ResumeSig {
  norm: string
  words: Set<string>
  bigrams: Set<string> // adjacent word pairs joined: "click"+"up" → "clickup"
}

function buildResumeSig(resumeNorm: string): ResumeSig {
  const arr = resumeNorm.split(' ').filter(Boolean)
  const bigrams = new Set<string>()
  for (let i = 0; i + 1 < arr.length; i++) bigrams.add(arr[i] + arr[i + 1])
  return { norm: resumeNorm, words: new Set(arr), bigrams }
}

/**
 * Does a phrase match the resume? Plain containment with plural tolerance,
 * plus the compact-bigram spacing rule (EXACT equality only, never substring,
 * so "java" still cannot ride inside "javascript"):
 *  - a single word (len ≥5) equal to a joined resume bigram ("clickup");
 *  - a two-word phrase whose words joined equal a single resume word
 *    ("click up" vs a resume writing "ClickUp").
 */
function matchesPhrase(sig: ResumeSig, phrase: string): boolean {
  if (containsTolerant(sig.norm, phrase)) return true
  const parts = phrase.split(' ')
  if (parts.length === 1 && parts[0].length >= 5 && sig.bigrams.has(parts[0])) return true
  if (parts.length === 2 && sig.words.has(parts[0] + parts[1])) return true
  return false
}

/**
 * Generic suffix words a model adds when mirroring JD phrasing. Dropping
 * them tests the skill's core name ("regression testing" → "regression").
 * Every entry slightly weakens the tripwire — add reluctantly.
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
  'detection',
  'verification',
])

/** True when every word of the token is only a generic suffix ("Testing",
 *  "Test Execution") — such tokens carry no skill identity, never flag. */
function isOnlyGenericSuffixes(token: string): boolean {
  return token.split(' ').every((w) => GENERIC_SUFFIXES.has(w))
}

/**
 * Is a CV skills token supported by the master resume?
 *  1. full normalized phrase containment (plural + spacing variants);
 *  2. while the phrase has >1 word and its LAST word is a generic suffix,
 *     drop that word and retry on the remainder — "manual test execution"
 *     → "manual test" → "manual", each retested;
 *  3. plural and spacing tolerance apply at every step above.
 * Anything still unsupported is a genuine introduction candidate.
 */
function skillSupported(token: string, sig: ResumeSig): boolean {
  if (matchesPhrase(sig, token)) return true
  let phrase = token
  while (phrase.includes(' ') && GENERIC_SUFFIXES.has(phrase.split(' ').pop()!)) {
    phrase = phrase.split(' ').slice(0, -1).join(' ')
    if (phrase && matchesPhrase(sig, phrase)) return true
  }
  return false
}

/**
 * Compound skills often join independent items with '&', '/' or 'and'
 * ("Smoke & Sanity Testing"). Split into sub-tokens and check each on its
 * own — the bare "Smoke" passes by itself, "Sanity Testing" strips to
 * "sanity"; only genuinely unsupported sub-tokens get flagged.
 */
const CONJUNCTION_SPLIT = /\s*(?:&|\/|\band\b)\s*/i

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
  const resumeSig = buildResumeSig(normalize(masterResume))

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
        for (const sub of piece.split(CONJUNCTION_SPLIT)) {
          const display = sub.trim()
          const token = normalize(display)
          if (token.length < 3 || seenUnknown.has(token)) continue
          seenUnknown.add(token)
          if (isOnlyGenericSuffixes(token)) continue // "Testing" alone — no skill identity
          if (!skillSupported(token, resumeSig)) {
            unknownSkills.push(display) // sub-token's display casing
          }
        }
      }
    }
  }

  return { gapLeaks, unknownSkills }
}
