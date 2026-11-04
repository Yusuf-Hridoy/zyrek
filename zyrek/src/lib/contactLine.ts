/**
 * The CV contact line, rebuilt in code from the master resume.
 *
 * The model is told to copy the contact line byte-exact, and mostly does —
 * but a separator between two adjacent items (an email and a LinkedIn URL,
 * say) goes missing often enough that the downloaded CV reads
 * "name@example.com linkedin.com/in/x". PDF text extraction can lose it too,
 * because a "|" drawn as a rule is not text at all.
 *
 * So the line is not trusted from either side: the items are read out of the
 * master resume and joined with " | " after every generation. Nothing is
 * invented and nothing is reformatted — each item is kept exactly as the
 * resume wrote it, in the order the resume wrote it.
 *
 * Pure: no React, no storage, no Date.now().
 */

// --- item patterns ----------------------------------------------------------

const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,24}`
const URL_WITH_SCHEME = String.raw`https?://[^\s|,;]+`
const BARE_DOMAIN = String.raw`(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(?:/[^\s|,;]*)?`
const PHONE = String.raw`\+?\d[\d\s().\-]{6,}\d`

const ITEM_RE = new RegExp(
  `(${EMAIL})|(${URL_WITH_SCHEME})|(${BARE_DOMAIN})|(${PHONE})`,
  'g',
)

/** File-ish suffixes that look like a domain but never are ("Node.js"). */
const NOT_A_TLD = new Set([
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'md', 'json', 'yml', 'yaml',
  'py', 'rb', 'php', 'html', 'htm', 'css', 'scss', 'sh', 'txt',
  'pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'zip',
])

/**
 * Section headings that end the header block. "Contact" and "About" are
 * deliberately absent — a resume that puts the details under a CONTACT
 * heading would otherwise have them cut away.
 */
const SECTION_HEADING =
  /^(?:#{1,6}\s*)?(?:professional\s+|work\s+|technical\s+|core\s+)?(?:summary|profile|objective|experience|employment|history|skills|competencies|education|projects|certifications|certificates|awards|languages|interests|publications|volunteer|references)\b\s*:?\s*$/i

/** Field labels sitting next to a value ("Email: a@b.com") — never items. */
const FIELD_LABEL =
  /^(?:e-?mail|mail|phone|mobile|tel|telephone|cell|linkedin|github|gitlab|portfolio|website|web|site|address|location|contact|based\s+in)$/i

/** Separator punctuation between contact items, in any of its usual guises. */
const SEPARATORS = String.raw`\s|·•▪●∙⋅／/,;:–—-`
const TRIM_SEPARATORS = new RegExp(`^[${SEPARATORS}]+|[${SEPARATORS}]+$`, 'g')

const MAX_HEADER_LINES = 8
const MAX_HEADER_LINES_WITHOUT_HEADING = 6
/** A city or a short label belongs on the line; a sentence does not. */
const MAX_FRAGMENT_LENGTH = 40

interface Found {
  value: string
  start: number
}

function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length
}

function looksLikeYearRange(s: string): boolean {
  return /^\d{4}\s*[-–—]\s*\d{4}$/.test(s.trim())
}

function tldOf(domain: string): string {
  const host = domain.split('/')[0]
  return host.slice(host.lastIndexOf('.') + 1).toLowerCase()
}

/** One line's worth of phone / email / link matches, in the order they appear. */
function matchesInLine(line: string): Found[] {
  const out: Found[] = []
  ITEM_RE.lastIndex = 0
  for (const m of line.matchAll(ITEM_RE)) {
    const [whole, email, url, domain, phone] = m
    const start = m.index ?? 0

    if (email) {
      out.push({ value: email, start })
      continue
    }
    if (url) {
      out.push({ value: url.replace(/[.,;:]+$/, ''), start })
      continue
    }
    if (domain) {
      const cleaned = domain.replace(/[.,;:]+$/, '')
      // "Node.js" and "resume.pdf" are not links.
      if (!cleaned.includes('/') && NOT_A_TLD.has(tldOf(cleaned))) continue
      out.push({ value: cleaned, start })
      continue
    }
    if (phone) {
      if (digitCount(phone) < 8) continue
      if (looksLikeYearRange(phone)) continue
      out.push({ value: phone.trim(), start })
      continue
    }
    void whole
  }
  return out
}

function stripMarkdown(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(\*\*|__)(.+)\1$/, '$2')
    .trim()
}

/**
 * The lines that can hold contact details: everything above the first section
 * heading, capped so a resume without headings never reaches its experience.
 */
function headerLines(text: string): string[] {
  const lines = text.split(/\r?\n/)
  const headingAt = lines.findIndex((l) => SECTION_HEADING.test(l.trim()))
  const limit =
    headingAt === -1 ? MAX_HEADER_LINES_WITHOUT_HEADING : headingAt
  return lines.slice(0, Math.min(limit, MAX_HEADER_LINES))
}

/**
 * Text sitting between the matched items on a contact line — a city, usually.
 * Kept because dropping it would lose a contact detail the resume does have,
 * which the CV rules forbid just as firmly as inventing one.
 */
function fragmentsAround(line: string, found: Found[], name: string): Found[] {
  const out: Found[] = []
  let cursor = 0
  const spans = found.map((f) => ({ start: f.start, end: f.start + f.value.length }))

  for (const span of [...spans, { start: line.length, end: line.length }]) {
    const raw = line.slice(cursor, span.start)
    cursor = span.end
    const value = raw.replace(TRIM_SEPARATORS, '').trim()
    if (!value) continue
    if (value.length > MAX_FRAGMENT_LENGTH) continue
    if (!/[A-Za-z0-9]/.test(value)) continue
    if (FIELD_LABEL.test(value)) continue
    if (name && value.toLowerCase() === name.toLowerCase()) continue
    out.push({ value, start: span.start - raw.length })
  }
  return out
}

// --- public API -------------------------------------------------------------

/**
 * Contact items from the master resume's header, in the order written:
 * phone numbers, emails, and links, plus any short text (a city) that shares
 * the line with them. Each item is kept verbatim — no scheme is added, no
 * casing changed. Duplicates are dropped, keeping the first.
 */
export function extractContactItems(text: string): string[] {
  const lines = headerLines(text)
  const name = lines.length > 0 ? stripMarkdown(lines.find((l) => l.trim()) ?? '') : ''

  const items: string[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const found = matchesInLine(line)
    if (found.length === 0) continue
    const all = [...found, ...fragmentsAround(line, found, name)].sort(
      (a, b) => a.start - b.start,
    )
    for (const item of all) {
      const key = item.value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item.value)
    }
  }
  return items
}

/** Joins contact items the way the CV header shows them. */
export function buildContactLine(items: string[]): string {
  return items.join(' | ')
}

/** True when a CV line carries a phone, an email, or a link. */
export function isContactLine(line: string): boolean {
  return matchesInLine(line).length > 0
}

/**
 * Replaces the generated CV's contact line with one built from the master
 * resume. The model's line is left exactly as it is when the resume yields no
 * contact items — a blank contact line is worse than an imperfect one.
 */
export function withBuiltContactLine(
  tailoredCv: string,
  masterResume: string,
): string {
  const items = extractContactItems(masterResume)
  if (items.length === 0) return tailoredCv

  const built = buildContactLine(items)
  const lines = tailoredCv.split('\n')

  // The CV header runs until the first "## SECTION" heading.
  const headingAt = lines.findIndex((l) => /^#{2,6}\s/.test(l.trim()))
  const headerEnd =
    headingAt === -1 ? Math.min(lines.length, MAX_HEADER_LINES) : headingAt

  const contactAt: number[] = []
  for (let i = 0; i < headerEnd; i++) {
    if (isContactLine(lines[i])) contactAt.push(i)
  }

  if (contactAt.length === 0) {
    // No contact line at all: put one under the title line, else the name.
    let at = 0
    for (let i = 0; i < headerEnd; i++) {
      const t = lines[i].trim()
      if (/^(\*\*|__).+\1$/.test(t)) {
        at = i + 1
        break
      }
      if (/^#\s/.test(t)) at = i + 1
    }
    lines.splice(at, 0, built)
    return lines.join('\n')
  }

  lines[contactAt[0]] = built
  // Any further contact lines in the header are now duplicates of the built
  // one — drop them from the bottom up so the earlier indexes stay valid.
  for (let k = contactAt.length - 1; k >= 1; k--) lines.splice(contactAt[k], 1)
  return lines.join('\n')
}
