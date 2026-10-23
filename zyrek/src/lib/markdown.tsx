import type { ReactNode } from 'react'
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

function inline(text: string, keyPrefix: string, print: boolean): ReactNode[] {
  const parts = text.split(INLINE_RE)
  return parts.map((part, i) => {
    const key = `${keyPrefix}-i${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className={print ? undefined : 'font-semibold'}>
          {part.slice(2, -2)}
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
        return (
          <a
            key={key}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={print ? undefined : 'text-[#b3492b] underline underline-offset-2'}
          >
            {m[1]}
          </a>
        )
      }
      return part
    }
    if (/^\*\S(?:[^*\n]*\S)?\*$/.test(part)) {
      return (
        <em key={key} className={print ? undefined : 'italic'}>
          {part.slice(1, -1)}
        </em>
      )
    }
    return part
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
                  : 'text-[13.5px] leading-relaxed text-[#26221b] marker:text-[#8a8371]'
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
                          : 'text-[13.5px] leading-relaxed text-[#26221b] marker:text-[#8a8371]'
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
