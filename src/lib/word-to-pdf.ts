import { PDFDocument } from 'pdf-lib'
import mammoth from 'mammoth'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('')
      continue
    }
    const words = para.split(/(\s+)/)
    let currentLine = ''
    for (const word of words) {
      if ((currentLine + word).length > maxWidth && currentLine.trim().length > 0) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine += word
      }
    }
    if (currentLine.trim().length > 0) {
      lines.push(currentLine)
    }
  }
  return lines
}

export async function wordToPdf(
  inputBuffer: ArrayBuffer,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(10)

  const result = await mammoth.convertToHtml({ arrayBuffer: inputBuffer })
  const html = result.value

  onProgress?.(30)

  const text = stripHtml(html)
  const lines = wrapText(text, 80)

  onProgress?.(40)

  const pdfDoc = await PDFDocument.create()
  const pageWidth = 595
  const pageHeight = 842
  const margin = 60
  const fontSize = 11
  const lineHeight = 16
  const usableWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2
  const linesPerPage = Math.floor(usableHeight / lineHeight)

  onProgress?.(50)

  const font = await pdfDoc.embedFont('Helvetica')

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin
  let lineOnPage = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '' && lineOnPage > 0) {
      y -= lineHeight * 1.5
      lineOnPage++
    } else if (line.trim() !== '') {
      currentPage.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        maxWidth: usableWidth,
      })
      y -= lineHeight
      lineOnPage++
    } else {
      y -= lineHeight
      lineOnPage++
    }

    if (lineOnPage >= linesPerPage) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
      lineOnPage = 0
    }

    if (i % 50 === 0) {
      onProgress?.(50 + ((i / lines.length) * 45))
    }
  }

  onProgress?.(98)

  const pdfBytes = await pdfDoc.save()
  onProgress?.(100)
  return copyBuffer(pdfBytes.buffer as ArrayBuffer)
}
