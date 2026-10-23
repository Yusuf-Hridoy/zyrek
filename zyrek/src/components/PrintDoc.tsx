import { createPortal } from 'react-dom'
import { renderMarkdown } from '../lib/markdown'

/**
 * Print-only document root: hidden on screen, the only visible content when
 * printing. Renders the bare-element ('print') markdown variant so the
 * #print-root stylesheet in index.css is the sole source of styling —
 * no app UI, colors, or Tailwind classes reach the PDF.
 *
 * Portaled to <body> so it is a SIBLING of #root — the print CSS hides
 * #root's subtree, which must never contain this node.
 */
export default function PrintDoc({ markdown }: { markdown: string }) {
  return createPortal(
    <div id="print-root" aria-hidden="true">
      {renderMarkdown(markdown, 'print')}
    </div>,
    document.body,
  )
}
