import { PDFDocument } from 'pdf-lib'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

async function renderPageToImage(
  buffer: ArrayBuffer,
  pageNum: number,
  scale: number,
  quality: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfjsLib = await import('pdfjs-dist')
  const pdf = await pdfjsLib.getDocument({ data: copyBuffer(buffer) }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { dataUrl, width: viewport.width, height: viewport.height }
}

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

  const scale = level === 'low' ? 2.0 : level === 'medium' ? 1.5 : 1.0
  const quality = level === 'low' ? 0.85 : level === 'medium' ? 0.6 : 0.35

  const srcPdf = await import('pdfjs-dist').then((m) =>
    m.getDocument({ data: copyBuffer(inputBuffer) }).promise
  )
  const totalPages = srcPdf.numPages

  onProgress?.(10)

  const newPdf = await PDFDocument.create()

  for (let i = 1; i <= totalPages; i++) {
    const { dataUrl, width, height } = await renderPageToImage(inputBuffer, i, scale, quality)
    const imgBytes = dataUrlToBytes(dataUrl)
    const img = await newPdf.embedJpg(imgBytes)
    const page = newPdf.addPage([width / 2, height / 2])
    page.drawImage(img, { x: 0, y: 0, width: width / 2, height: height / 2 })
    onProgress?.(10 + ((i / totalPages) * 80))
  }

  onProgress?.(95)

  const compressedBytes = await newPdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  })

  onProgress?.(100)
  return copyBuffer(compressedBytes.buffer as ArrayBuffer)
}

export function getCompressionLabel(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low': return '低压缩 - 接近原始质量'
    case 'medium': return '中等压缩 - 均衡'
    case 'high': return '高压缩 - 最小体积'
  }
}
