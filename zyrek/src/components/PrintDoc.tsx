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
 *
 * The table wrapper is deliberate, not decoration. The print stylesheet sets
 * `@page { margin: 0 }`, because a browser paints its date/URL/page-number
 * stamps INTO the page margin — with no margin there is nowhere for them to
 * land, so they never appear even when "Headers and footers" is ticked in the
 * print dialog. Zero margin also removes the per-page spacing those margins
 * used to provide, so it is recreated here: a thead/tfoot spacer row repeats
 * at the top and bottom of EVERY printed page, and .print-content carries the
 * left/right margin as padding.
 */
export default function PrintDoc({ markdown }: { markdown: string }) {
  return createPortal(
    <div id="print-root" aria-hidden="true">
      <table className="print-table">
        <thead>
          <tr>
            <td>
              <div className="print-spacer-top" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div className="print-content">
                {renderMarkdown(markdown, 'print')}
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div className="print-spacer-bottom" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>,
    document.body,
  )
}
