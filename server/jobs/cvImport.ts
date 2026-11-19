/**
 * CV import: a PDF or DOCX in, Markdown out, for the person to review (the import is never perfect). The original file
 * is NOT kept: only the reviewed `profile/cv.md` is saved, so the workspace never holds a second copy of the CV.
 *
 * DOCX: mammoth → HTML → Turndown (mammoth's own Markdown output is deprecated). PDF: pdf.js (legacy build, no canvas,
 * no worker in Node) → text by line, with blank lines between paragraphs. Both run in this process: no network.
 */

import mammoth from 'mammoth'
import { HttpError } from '../errors.js'
import { htmlToMarkdown } from './capture.js'

const MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 30_000

export type CvKind = 'pdf' | 'docx'

/** By the magic bytes, not by the name or the declared type. */
export function detectKind(bytes: Uint8Array): CvKind | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf' // %PDF
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'docx' // zip
  return null
}

async function docxToMarkdown(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer })
  return htmlToMarkdown(value)
}

async function pdfToMarkdown(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdfjs.getDocument({ data: bytes })
  const doc = await task.promise
  const pages: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      line += item.str
      if (item.hasEOL) {
        lines.push(line.trim())
        line = ''
      }
    }
    if (line.trim()) lines.push(line.trim())
    pages.push(lines.join('\n').replace(/\n{3,}/g, '\n\n'))
  }
  await task.destroy()
  return pages.join('\n\n').trim()
}

export async function importCv(bytes: Buffer): Promise<string> {
  if (bytes.byteLength > MAX_BYTES) throw new HttpError(413, 'File too large (over 10 MB).', 'unsupported_file')
  const kind = detectKind(bytes)
  if (!kind) throw new HttpError(415, 'Use a PDF or a DOCX file.', 'unsupported_file')
  const work = kind === 'pdf' ? pdfToMarkdown(new Uint8Array(bytes)) : docxToMarkdown(bytes)
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, fail) => {
    timer = setTimeout(
      () => fail(new HttpError(422, 'The file took too long to read.', 'unsupported_file')),
      TIMEOUT_MS,
    )
  })
  try {
    const markdown = await Promise.race([work, timeout])
    if (!markdown.trim()) throw new HttpError(422, 'No text found (is it a scanned image?).', 'unsupported_file')
    return markdown
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(422, 'Could not read that file.', 'unsupported_file')
  } finally {
    clearTimeout(timer)
  }
}
