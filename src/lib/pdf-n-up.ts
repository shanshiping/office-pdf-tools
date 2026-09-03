import { PDFDocument, degrees, rgb } from 'pdf-lib'

export interface NUpOptions {
  rows: number
  cols: number
  margin: number
  spacing: number
}

export interface PageWithRotation {
  buffer: ArrayBuffer
  name: string
  rotation: number
}

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

export async function imageToPdf(
  imageBuffer: ArrayBuffer,
  fileName: string
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  
  let image
  const ext = fileName.toLowerCase().split('.').pop()
  
  if (ext === 'png') {
    image = await doc.embedPng(imageBuffer)
  } else if (ext === 'jpg' || ext === 'jpeg') {
    image = await doc.embedJpg(imageBuffer)
  } else {
    image = await doc.embedJpg(imageBuffer)
  }
  
  const { width, height } = image.scale(1)
  
  const page = doc.addPage([width, height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width,
    height,
  })
  
  const pdfBytes = await doc.save()
  return copyBuffer(pdfBytes.buffer as ArrayBuffer)
}

export function calculateLayout(options: NUpOptions) {
  const { rows, cols, margin, spacing } = options
  const totalCells = rows * cols

  const availableWidth = A4_WIDTH - margin * 2
  const availableHeight = A4_HEIGHT - margin * 2

  const cellWidth = (availableWidth - spacing * (cols - 1)) / cols
  const cellHeight = (availableHeight - spacing * (rows - 1)) / rows

  return {
    totalCells,
    cellWidth,
    cellHeight,
    availableWidth,
    availableHeight,
  }
}

function calculateOptimalSpacing(
  pages: { width: number; height: number }[],
  cellWidth: number,
  cellHeight: number,
  baseSpacing: number
): number {
  if (pages.length <= 1) return baseSpacing

  const avgAspectRatio =
    pages.reduce((sum, p) => sum + p.width / p.height, 0) / pages.length
  const cellAspectRatio = cellWidth / cellHeight

  const adjustedSpacing = baseSpacing * (avgAspectRatio > cellAspectRatio ? 1.1 : 0.9)

  return Math.max(2, Math.min(adjustedSpacing, baseSpacing * 1.5))
}

export async function createNUpPdf(
  files: PageWithRotation[],
  options: NUpOptions,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const { rows, cols, margin, spacing } = options
  const { totalCells, cellWidth, cellHeight } = calculateLayout(options)

  const mergedDoc = await PDFDocument.create()
  const a4Page = mergedDoc.addPage([A4_WIDTH, A4_HEIGHT])

  a4Page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
    color: rgb(1, 1, 1),
  })

  const totalPages = files.length
  const pagesPerSheet = Math.min(totalPages, totalCells)
  const sheetsNeeded = Math.ceil(totalPages / totalCells)

  let pageIndex = 0

  for (let sheet = 0; sheet < sheetsNeeded; sheet++) {
    if (sheet > 0) {
      const newPage = mergedDoc.addPage([A4_WIDTH, A4_HEIGHT])
      newPage.drawRectangle({
        x: 0,
        y: 0,
        width: A4_WIDTH,
        height: A4_HEIGHT,
        color: rgb(1, 1, 1),
      })
    }

    const currentPage = mergedDoc.getPage(sheet)
    const currentPagesOnSheet = Math.min(pagesPerSheet - sheet * totalCells, totalCells)

    for (let cellIndex = 0; cellIndex < currentPagesOnSheet; cellIndex++) {
      const fileInfo = files[pageIndex]
      if (!fileInfo) continue

      try {
        const srcDoc = await PDFDocument.load(copyBuffer(fileInfo.buffer), {
          ignoreEncryption: true,
        })
        const [embeddedPage] = await mergedDoc.embedPdf(srcDoc, [0])

        const col = cellIndex % cols
        const row = Math.floor(cellIndex / cols)

        const cellX = margin + col * (cellWidth + spacing)
        const cellY = A4_HEIGHT - margin - (row + 1) * cellHeight - row * spacing

        const originalWidth = embeddedPage.width
        const originalHeight = embeddedPage.height

        const scaleX = cellWidth / originalWidth
        const scaleY = cellHeight / originalHeight
        const scale = Math.min(scaleX, scaleY)

        const scaledWidth = originalWidth * scale
        const scaledHeight = originalHeight * scale

        const offsetX = cellX + (cellWidth - scaledWidth) / 2
        const offsetY = cellY + (cellHeight - scaledHeight) / 2

        currentPage.drawPage(embeddedPage, {
          x: offsetX,
          y: offsetY,
          width: scaledWidth,
          height: scaledHeight,
          rotate: degrees(fileInfo.rotation || 0),
        })

        onProgress?.(((pageIndex + 1) / totalPages) * 100)
      } catch (err) {
        console.error(`Failed to embed page from ${fileInfo.name}:`, err)
      }

      pageIndex++
    }
  }

  const mergedBytes = await mergedDoc.save()
  return copyBuffer(mergedBytes.buffer as ArrayBuffer)
}

export async function getPdfPageSize(
  buffer: ArrayBuffer
): Promise<{ width: number; height: number }> {
  try {
    const doc = await PDFDocument.load(copyBuffer(buffer), { ignoreEncryption: true })
    const page = doc.getPage(0)
    const { width, height } = page.getSize()
    return { width, height }
  } catch {
    return { width: 0, height: 0 }
  }
}

export const PRESET_LAYOUTS = {
  '2x2': { rows: 2, cols: 2, label: '2×2 (4张)' },
  '3x2': { rows: 3, cols: 2, label: '3×2 (6张)' },
  '2x3': { rows: 2, cols: 3, label: '2×3 (6张)' },
  '4x2': { rows: 4, cols: 2, label: '4×2 (8张)' },
  '3x3': { rows: 3, cols: 3, label: '3×3 (9张)' },
} as const

export type PresetLayout = keyof typeof PRESET_LAYOUTS
