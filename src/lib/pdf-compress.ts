import { PDFDocument } from 'pdf-lib'
import { copyArrayBuffer, uint8ToArrayBuffer } from './bytes'
import './pdf-utils'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function compressPdf(
  inputBuffer: ArrayBuffer,
  level: 'low' | 'medium' | 'high',
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5)

  const { scale, quality } = getCompressionParams(level)

  const pdfjsLib = await import('pdfjs-dist')
  const srcPdf = await pdfjsLib.getDocument({ data: copyArrayBuffer(inputBuffer) }).promise
  const totalPages = srcPdf.numPages

  onProgress?.(10)

  const newPdf = await PDFDocument.create()

  for (let i = 1; i <= totalPages; i++) {
    const page = await srcPdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    await page.render({ canvasContext: ctx, viewport }).promise

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const img = await newPdf.embedJpg(dataUrlToBytes(dataUrl))
    const outPage = newPdf.addPage([viewport.width / 2, viewport.height / 2])
    outPage.drawImage(img, { x: 0, y: 0, width: viewport.width / 2, height: viewport.height / 2 })
    onProgress?.(10 + ((i / totalPages) * 80))
  }

  onProgress?.(95)

  const compressedBytes = await newPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  onProgress?.(100)
  return uint8ToArrayBuffer(compressedBytes)
}

export function getCompressionParams(level: 'low' | 'medium' | 'high'): {
  scale: number
  quality: number
} {
  if (level === 'low') return { scale: 2.0, quality: 0.85 }
  if (level === 'medium') return { scale: 1.5, quality: 0.6 }
  return { scale: 1.0, quality: 0.35 }
}

export function getCompressionLabel(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return '低压缩 - 接近原始质量'
    case 'medium': return '中等压缩 - 均衡'
    case 'high': return '高压缩 - 最小体积'
  }
}
