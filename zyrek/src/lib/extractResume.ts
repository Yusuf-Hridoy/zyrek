import * as pdfjsLib from 'pdfjs-dist'
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const MAX_BYTES = 10 * 1024 * 1024

/**
 * pdf.js hands back positioned text runs, not lines. Joining them all with a
 * space flattens a resume into one paragraph, which costs the header block its
 * shape — and the contact line its structure, since a "|" drawn as a rule is
 * never a text run to begin with.
 *
 * So lines are reconstructed: a run ends its line when pdf.js marks it hasEOL,
 * or when the baseline (transform[5]) jumps by more than half a line height.
 * Within a line, runs are concatenated as drawn, with a space added only where
 * there is a real horizontal gap and neither side already carries whitespace.
 */
function pageText(items: TextContent['items']): string {
  const lines: string[] = []
  let line = ''
  let prev: TextItem | null = null

  const endLine = () => {
    lines.push(line.trimEnd())
    line = ''
    prev = null
  }

  for (const item of items) {
    if (!('str' in item)) continue
    const run = item as TextItem
    const lineHeight = Math.abs(run.transform[3]) || run.height || 10

    if (prev !== null && Math.abs(run.transform[5] - prev.transform[5]) > lineHeight * 0.5) {
      endLine()
    }

    if (prev !== null) {
      const gap = run.transform[4] - (prev.transform[4] + prev.width)
      const spaced = /\s$/.test(line) || /^\s/.test(run.str)
      if (!spaced && gap > lineHeight * 0.2) line += ' '
    }

    line += run.str
    prev = run
    if (run.hasEOL) endLine()
  }
  if (line.trim() !== '') lines.push(line.trimEnd())

  return lines.join('\n')
}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error('That file is over 10 MB. Use a smaller resume file.')
  }

  const name = file.name.toLowerCase()
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''

  let text: string

  if (ext === '.txt' || ext === '.md' || ext === '.text') {
    text = await file.text()
  } else if (ext === '.pdf') {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(pageText(content.items))
    }
    text = pages.join('\n\n')
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
  } else if (ext === '.doc') {
    throw new Error('Old .doc files are not supported. Save your resume as PDF or DOCX and try again.')
  } else {
    throw new Error('Unsupported file type. Use PDF, DOCX, or TXT.')
  }

  if (text.replace(/\s/g, '').length < 50) {
    throw new Error('No readable text found — this looks like a scanned image PDF. Export your resume as a text-based PDF instead.')
  }

  return text
}
