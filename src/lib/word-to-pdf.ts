import { PDFDocument } from 'pdf-lib'
import mammoth from 'mammoth'
import { copyArrayBuffer, uint8ToArrayBuffer } from './bytes'

export function wrapWordHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 20mm; }
    html, body {
      margin: 0;
      padding: 0;
      color: #222;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif;
      font-size: 12pt;
      line-height: 1.65;
    }
    body { padding: 0 4mm; }
    h1, h2, h3, h4 { line-height: 1.3; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #ccc; padding: 4px 8px; }
    p { margin: 0 0 0.7em; }
  </style>
</head>
<body>${body}</body>
</html>`
}

export function wrapTextByWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\n/)
  const lines: string[] = []

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('')
      continue
    }
    let current = ''
    for (const ch of para) {
      const next = current + ch
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current)
        current = ch
      } else {
        current = next
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

async function htmlToPdfWithSystemFonts(
  html: string,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const text = (parsed.body?.innerText || '').replace(/\r/g, '').trim()
  if (!text) throw new Error('Word 文档没有可转换的文字')

  const pageWidth = 595.28
  const pageHeight = 841.89
  const scale = 2
  const canvasW = Math.round(pageWidth * scale)
  const canvasH = Math.round(pageHeight * scale)
  const margin = 48 * scale
  const fontSize = 14 * scale
  const lineHeight = 22 * scale
  const maxWidth = canvasW - margin * 2

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('无法创建画布')
  measure.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`
  const lines = wrapTextByWidth(measure, text, maxWidth)
  const linesPerPage = Math.max(1, Math.floor((canvasH - margin * 2) / lineHeight))

  const pdfDoc = await PDFDocument.create()
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage))

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.fillStyle = '#222222'
    ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`
    ctx.textBaseline = 'top'

    const slice = lines.slice(pageIndex * linesPerPage, (pageIndex + 1) * linesPerPage)
    slice.forEach((line, i) => {
      if (line) ctx.fillText(line, margin, margin + i * lineHeight)
    })

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const image = await pdfDoc.embedJpg(bytes)
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
    onProgress?.(50 + ((pageIndex + 1) / totalPages) * 45)
  }

  return uint8ToArrayBuffer(await pdfDoc.save())
}

export async function wordToPdf(
  inputBuffer: ArrayBuffer,
  _fileName: string,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(10)
  const result = await mammoth.convertToHtml({ arrayBuffer: copyArrayBuffer(inputBuffer) })
  const html = wrapWordHtml(result.value)
  onProgress?.(35)

  if (typeof window !== 'undefined' && window.electronAPI?.printHtmlToPdf) {
    onProgress?.(50)
    const pdfBytes = await window.electronAPI.printHtmlToPdf({ html })
    onProgress?.(100)
    return uint8ToArrayBuffer(Uint8Array.from(pdfBytes))
  }

  onProgress?.(45)
  const pdf = await htmlToPdfWithSystemFonts(html, onProgress)
  onProgress?.(100)
  return pdf
}
