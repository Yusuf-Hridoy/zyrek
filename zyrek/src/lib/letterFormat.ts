import type { AssayResult } from '../types/assay'

/**
 * Display-time frame for the cover letter: candidate header, day-first date,
 * recipient block, greeting, body, sign-off. The stored `coverLetter` stays
 * the raw AI text — this runs on every render/export, so it applies to old
 * letters too. Pure: no React, the date is passed in.
 */

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const GREETING_RE = /^dear\b.*[,，]?\s*$/i
const SIGN_OFF_RE =
  /^(best regards|kind regards|warm regards|regards|sincerely|yours sincerely|yours faithfully)[,，]?$/i
const DATE_LINE_RE = /^\d{1,2} [A-Z][a-z]+ \d{4}$/
const SECTION_WORDS =
  /^(professional )?(summary|profile|experience|skills|education|projects|certifications|contact)\b/i

/** Strips heading hashes and wrapping bold/italic markers from one line. */
function plain(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(\*\*|__)(.+)\1$/, '$2')
    .replace(/^([*_])(.+)\1$/, '$2')
    .trim()
}

function nonEmptyLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

function looksLikeName(line: string): boolean {
  const words = line.split(/\s+/)
  return (
    line.length > 0 &&
    line.length <= 60 &&
    words.length <= 6 &&
    !/[\d@|:/]/.test(line) &&
    !SECTION_WORDS.test(line)
  )
}

function looksLikeContact(line: string): boolean {
  // Headings and the CV's bold TITLE line ("**QA Engineer**") are never contact.
  if (line.startsWith('#') || /^\*\*.+\*\*$/.test(line)) return false
  return (
    line.includes('@') ||
    /linkedin|github|https?:\/\//i.test(line) ||
    (line.match(/\d/g)?.length ?? 0) >= 7
  )
}

/** Name + contact line from the top of the tailored CV, or null — never a guess. */
function parseHeader(cv: string): { name: string; contact: string } | null {
  const top = nonEmptyLines(cv).slice(0, 4)
  if (top.length < 2) return null
  const name = plain(top[0])
  if (!looksLikeName(name)) return null
  const contact = top.slice(1).find((l) => looksLikeContact(l))
  if (!contact) return null
  return { name, contact }
}

/** True when the text already carries the frame (bold name + date, or date + recipient). */
function isFramed(lines: string[]): boolean {
  const [first, second, third] = lines
  if (!first) return false
  if (/^\*\*.+\*\*$/.test(first)) {
    return [second, third].some((l) => l !== undefined && DATE_LINE_RE.test(l))
  }
  return DATE_LINE_RE.test(first) && second === 'Hiring Team'
}

export function formatCoverLetter(result: AssayResult, now?: Date): string {
  const text = result.coverLetter
    .replace(/\r\n/g, '\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
  if (!text) return ''
  if (isFramed(nonEmptyLines(text))) return text

  const header = parseHeader(result.tailoredCv)
  const company = result.company.trim()

  // Greeting: keep the AI's own "Dear …," line (it may name a person from the JD).
  const lines = text.split('\n')
  const firstIndex = lines.findIndex((l) => l.trim() !== '')
  let greeting = 'Dear Hiring Team,'
  let body = text
  if (firstIndex !== -1 && GREETING_RE.test(lines[firstIndex].trim())) {
    greeting = lines[firstIndex].trim()
    body = lines
      .slice(firstIndex + 1)
      .join('\n')
      .trim()
  }

  const hasSignOff = nonEmptyLines(body)
    .slice(-4)
    .some((l) => SIGN_OFF_RE.test(plain(l)))

  const blocks: string[] = []
  if (header) blocks.push(`**${header.name}**\n${header.contact}`)
  blocks.push(DATE_FORMAT.format(now ?? new Date()))
  blocks.push(company ? `Hiring Team\n${company}` : 'Hiring Team')
  blocks.push(greeting)
  if (body) blocks.push(body)
  if (!hasSignOff) {
    blocks.push(header ? `Best regards,\n${header.name}` : 'Best regards,')
  }
  return blocks.join('\n\n')
}
