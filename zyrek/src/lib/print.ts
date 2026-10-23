/**
 * Browser-print orchestration for PDF export.
 *
 * Sequence: mount the print document, mark <body> as printing (the print
 * stylesheet hides the app and shows #print-root ONLY while this class is
 * present — plain Ctrl+P on the app is unaffected), swap document.title so
 * the browser suggests our filename, then print. Cleanup happens on
 * `afterprint` or a 1s fallback (some mobile browsers never fire it):
 * restore the title, drop the class, unmount the document.
 */

export interface PrintDocData {
  markdown: string
  title: string
}

export type SetPrintDoc = (doc: PrintDocData | null) => void

let inFlight = false

export function printDocument(
  setPrintDoc: SetPrintDoc,
  markdown: string,
  filename: string,
): void {
  if (inFlight) return
  inFlight = true

  const previousTitle = document.title
  document.title = filename
  document.body.classList.add('printing-doc')
  setPrintDoc({ markdown, title: filename })

  const finish = () => {
    window.removeEventListener('afterprint', finish)
    clearTimeout(fallbackTimer)
    document.title = previousTitle
    document.body.classList.remove('printing-doc')
    setPrintDoc(null)
    inFlight = false
  }
  const fallbackTimer = window.setTimeout(finish, 1000)
  window.addEventListener('afterprint', finish)
}
