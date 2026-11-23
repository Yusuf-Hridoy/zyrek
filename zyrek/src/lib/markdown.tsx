import { Fragment, type ReactNode } from 'react'
import { unescapeArtifacts } from './validate'

/**
 * Minimal, dependency-free markdown-to-React renderer covering the narrow
 * subset used in tailored CVs and cover letters: headings, bold, italic,
 * inline code, links, bullet lists (one level of nesting), rules, and
 * paragraphs with single-newline <br /> breaks.
 *
 * SAFETY INVARIANT: this module never builds HTML strings and never uses
 * dangerouslySetInnerHTML. Every emitted node is a React element or a plain
 * string, so any raw HTML in the source (e.g. <img src=x onerror=...>)
 * flows through React text nodes and renders as visible literal text.
 * Links are only emitted as <a> when the URL starts with http://, https://,
 * or mailto:; any other scheme (javascript:, data:, ...) renders as text.
 *
 * variant: 'screen' (default) emits the paper-palette Tailwind classes;
 * 'print' emits bare elements with no classes, styled purely by the
 * #print-root print stylesheet — this guarantees the print CSS wins and no
 * screen styling leaks into the PDF.
 */

// Emphasis delimiters must hug non-whitespace on the inside, so stray
// asterisks (e.g. "20%* and reduced flaky tests*") never pair up into
// runaway italics. `code` and link tokens are unchanged.
const INLINE_RE =
  /(\*\*(?=\S)[^*]+?(?<=\S)\*\*|\*(?=\S)[^*\n]+?(?<=\S)\*|`[^`\n]+`|\[[^\]\n]*\]\([^)\n]*\))/g

// --- Auto-linking -----------------------------------------------------------
// CVs and letters carry bare contact details ("linkedin.com/in/...", an email,
// "yusufahmedd.netlify.app") that are not written as markdown links. A PDF link
// annotation only exists where a real <a> was printed, so those runs become
// anchors at render time. Deliberately conservative: a missed link is better
// than a fake one.
//
// Bare domains are linked only when the last label is in this whitelist. That
// is the guard keeping "Node.js", "Next.js", "data.json" and "file.txt" plain.
const TLDS =
  'com|net|org|io|dev|app|ai|me|co|edu|gov|info|biz|uk|de|nl|pl|pt|es|fr|it|se|no|fi|dk|ee|lv|lt|cz|at|ch|be|ie|ca|au|sg|jp|bd|in'

const AUTOLINK_RE = new RegExp(
  [
    // 1. Full URL.
    'https?:\\/\\/[^\\s<>]+',
    // 2. Email (tried before bare domains so the local part is never dropped).
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}',
    // 3. www.-prefixed host.
    'www\\.[^\\s<>]+',
    // 4. Bare domain with whitelisted TLD, optional path. The two lookaheads
    //    reject "ecommerce.company" (the TLD must end its label) and
    //    "mysite.app.js" (no further dotted word label may follow).
    `(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\\.)+(?:${TLDS})(?![A-Za-z0-9-])(?!\\.[A-Za-z])(?:\\/[^\\s<>]*)?`,
  ].join('|'),
  'g',
)

// Sentence punctuation that sits after a link, never inside it. "|" is here
// because the CV contact line separates its items with " | ".
const TRAILING_RE = /[.,;:)\]|]+$/

function autoHref(token: string): string | null {
  let href: string
  if (/^https?:\/\//i.test(token)) href = token
  else if (token.includes('@') && !token.includes('/')) href = `mailto:${token}`
  else href = `https://${token}`
  // Same scheme restriction as markdown links — unchanged security rule.
  return /^(https?:|mailto:)/.test(href) ? href : null
}

function linkEl(key: string, href: string, label: string, print: boolean) {
  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={print ? undefined : 'text-[#b3492b] underline underline-offset-2'}
    >
      {label}
    </a>
  )
}

/**
 * Turn emails, URLs and whitelisted bare domains inside one plain-text run
 * into anchors. Never called for inline code, nor for text already parsed as
 * a markdown link.
 */
function linkifyText(text: string, keyPrefix: string, print: boolean): ReactNode[] {
  if (!text) return [text]
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  AUTOLINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = AUTOLINK_RE.exec(text)) !== null) {
    const raw = m[0]
    const token = raw.replace(TRAILING_RE, '')
    if (!token) {
      AUTOLINK_RE.lastIndex = m.index + raw.length
      continue
    }
    if (token.length < raw.length) {
      // Trimmed punctuation stays in the text stream.
      AUTOLINK_RE.lastIndex = m.index + token.length
    }
    const href = autoHref(token)
    if (!href) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(linkEl(`${keyPrefix}-a${n++}`, href, token, print))
    last = m.index + token.length
  }
  if (out.length === 0) return [text]
  if (last < text.length) out.push(text.slice(last))
  return out
}

function textRun(text: string, key: string, print: boolean): ReactNode {
  const nodes = linkifyText(text, key, print)
  if (nodes.length === 1 && typeof nodes[0] === 'string') return nodes[0]
  return <Fragment key={key}>{nodes}</Fragment>
}

function inline(text: string, keyPrefix: string, print: boolean): ReactNode[] {
  const parts = text.split(INLINE_RE)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-i${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className={print ? undefined : 'font-semibold'}>
          {textRun(part.slice(2, -2), `${key}-s`, print)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className={
            print ? undefined : 'rounded bg-[#f2eee2] px-1 py-0.5 font-mono text-[12px]'
          }
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('[')) {
      const m = part.match(/^\[([^\]\n]*)\]\(([^)\n]*)\)$/)
      if (m && /^(https?:|mailto:)/.test(m[2])) {
        return linkEl(key, m[2], m[1], print)
      }
      return part
    }
    if (/^\*\S(?:[^*\n]*\S)?\*$/.test(part)) {
      return (
        <em key={key} className={print ? undefined : 'italic'}>
          {textRun(part.slice(1, -1), `${key}-e`, print)}
        </em>
      )
    }
    return textRun(part, key, print)
  })
}

const HEADING_CLASS = [
  'text-[19px] font-bold text-[#26221b] mb-1',
  'text-[15px] font-semibold text-[#26221b] mt-5 mb-1.5 pb-1 border-b border-[#e2dccb]',
  'text-[13.5px] font-semibold text-[#26221b] mt-4 mb-1',
  'text-[12.5px] font-semibold text-[#6f6858] mt-3 mb-1',
]

const ITEM_RE = /^( {0,})([-*]) (.*)$/
const HR_RE = /^ {0,3}(?:---|\*\*\*|___)$/
const HEADING_RE = /^ {0,3}(#{1,4}) ?(.*)$/

export function renderMarkdown(
  src: string,
  variant: 'screen' | 'print' = 'screen',
): ReactNode {
  const print = variant === 'print'
  // Display-time safety net: entries saved while the escape-repair bug was
  // live still hold literal \n artifacts in storage. Normalize a copy here
  // (presentation only — Copy/download still return the stored string).
  const lines = unescapeArtifacts(src)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      i++
      continue
    }

    const key = `b${blocks.length}`

    const hr = HR_RE.exec(line)
    if (hr) {
      blocks.push(
        <hr
          key={key}
          className={print ? undefined : 'my-4 border-t border-[#e2dccb]'}
        />,
      )
      i++
      continue
    }

    const heading = HEADING_RE.exec(line)
    if (heading) {
      const level = heading[1].length - 1
      // Role row: "### Title | dates" — the LAST " | " is a layout delimiter
      // (title left, dates right). h3s without it render exactly as before.
      const split = level === 2 ? heading[2].lastIndexOf(' | ') : -1
      if (split > 0 && heading[2].slice(split + 3).trim()) {
        const title = heading[2].slice(0, split)
        const dates = heading[2].slice(split + 3).trim()
        blocks.push(
          <h3
            key={key}
            data-role-row=""
            className={
              print
                ? undefined
                : `${HEADING_CLASS[2]} flex flex-wrap items-baseline justify-between gap-x-3`
            }
          >
            <span className={print ? undefined : 'min-w-0'}>
              {inline(title, `${key}-t`, print)}
            </span>
            <span
              className={
                print
                  ? undefined
                  : 'whitespace-nowrap text-[12px] font-normal text-[#5d574a]'
              }
            >
              {inline(dates, `${key}-d`, print)}
            </span>
          </h3>,
        )
        i++
        continue
      }
      const cls = print ? undefined : HEADING_CLASS[level]
      const Tag = (['h1', 'h2', 'h3', 'h4'] as const)[level]
      blocks.push(
        <Tag key={key} className={cls}>
          {inline(heading[2], key, print)}
        </Tag>,
      )
      i++
      continue
    }

    const itemMatch = ITEM_RE.exec(line)
    if (itemMatch) {
      // Contiguous list lines group into one <ul>; items indented 4+ spaces
      // nest one level (deeper indentation flattens to the nested level).
      const items: { text: string; children: string[] }[] = []
      while (i < lines.length) {
        const m = ITEM_RE.exec(lines[i])
        if (!m || HR_RE.test(lines[i])) break
        if (m[1].length >= 4 && items.length > 0) {
          items[items.length - 1].children.push(m[3])
        } else {
          items.push({ text: m[3], children: [] })
        }
        i++
      }
      blocks.push(
        <ul
          key={key}
          className={print ? undefined : 'mb-2.5 list-disc space-y-1 pl-5'}
        >
          {items.map((item, j) => (
            <li
              key={`${key}-li${j}`}
              className={
                print
                  ? undefined
                  : 'text-[13.5px] leading-relaxed text-[#26221b] marker:text-[#6f6858]'
              }
            >
              {inline(item.text, `${key}-li${j}`, print)}
              {item.children.length > 0 && (
                <ul className={print ? undefined : 'mb-0 mt-1 list-disc space-y-1 pl-5'}>
                  {item.children.map((c, k) => (
                    <li
                      key={`${key}-li${j}-n${k}`}
                      className={
                        print
                          ? undefined
                          : 'text-[13.5px] leading-relaxed text-[#26221b] marker:text-[#6f6858]'
                      }
                    >
                      {inline(c, `${key}-li${j}-n${k}`, print)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Paragraph: collect lines until a blank line or a block-starting line.
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (l.trim() === '') break
      if (para.length > 0 && (HR_RE.test(l) || HEADING_RE.test(l) || ITEM_RE.test(l))) break
      para.push(l)
      i++
    }
    blocks.push(
      <p
        key={key}
        className={print ? undefined : 'mb-2.5 text-[13.5px] leading-relaxed text-[#26221b]'}
      >
        {para.map((l, j) => (
          <span key={`${key}-p${j}`}>
            {j > 0 && <br />}
            {inline(l, `${key}-p${j}`, print)}
          </span>
        ))}
      </p>,
    )
  }

  return blocks
}
