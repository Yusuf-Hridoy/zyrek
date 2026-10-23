import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

const MAX_BYTES = 10 * 1024 * 1024

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
      pages.push(
        content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' '),
      )
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
