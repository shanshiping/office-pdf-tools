import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { copyArrayBuffer, uint8ToArrayBuffer } from './bytes'

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

export interface NUpResult {
  buffer: ArrayBuffer
  failed: string[]
}

export const A4_WIDTH = 595.28
export const A4_HEIGHT = 841.89

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

export function pagesOnSheet(totalPages: number, totalCells: number, sheet: number): number {
  if (totalCells <= 0) return 0
  return Math.max(0, Math.min(totalPages - sheet * totalCells, totalCells))
}

export function sheetCount(totalPages: number, totalCells: number): number {
  if (totalPages <= 0 || totalCells <= 0) return 0
  return Math.ceil(totalPages / totalCells)
}

export async function createNUpPdf(
  files: PageWithRotation[],
  options: NUpOptions,
  onProgress?: (progress: number) => void
): Promise<NUpResult> {
  const { rows, cols, margin, spacing } = options
  const { totalCells, cellWidth, cellHeight } = calculateLayout(options)
  const failed: string[] = []

  const items: { srcDoc: PDFDocument; pageIndex: number; name: string; rotation: number }[] = []

  for (const fileInfo of files) {
    try {
      const srcDoc = await PDFDocument.load(copyArrayBuffer(fileInfo.buffer), {
        ignoreEncryption: true,
      })
      const count = srcDoc.getPageCount()
      if (count === 0) {
        failed.push(fileInfo.name)
        continue
      }
      for (let pageIndex = 0; pageIndex < count; pageIndex++) {
        items.push({
          srcDoc,
          pageIndex,
          name: fileInfo.name,
          rotation: fileInfo.rotation || 0,
        })
      }
    } catch (err) {
      console.error(`Failed to load ${fileInfo.name}:`, err)
      failed.push(fileInfo.name)
    }
  }

  const totalPages = items.length
  if (totalPages === 0) {
    throw new Error(failed.length ? `无法处理文件：${failed.join('、')}` : '没有可排列的页面')
  }

  const mergedDoc = await PDFDocument.create()
  const sheetsNeeded = sheetCount(totalPages, totalCells)
  let pageCursor = 0

  for (let sheet = 0; sheet < sheetsNeeded; sheet++) {
    const currentPage = mergedDoc.addPage([A4_WIDTH, A4_HEIGHT])
    currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: A4_WIDTH,
      height: A4_HEIGHT,
      color: rgb(1, 1, 1),
    })

    const currentPagesOnSheet = pagesOnSheet(totalPages, totalCells, sheet)

    for (let cellIndex = 0; cellIndex < currentPagesOnSheet; cellIndex++) {
      const item = items[pageCursor]
      if (!item) break

      try {
        const [embeddedPage] = await mergedDoc.embedPdf(item.srcDoc, [item.pageIndex])

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
          rotate: degrees(item.rotation || 0),
        })
      } catch (err) {
        console.error(`Failed to embed page from ${item.name}:`, err)
        if (!failed.includes(item.name)) failed.push(item.name)
      }

      pageCursor++
      onProgress?.((pageCursor / totalPages) * 100)
    }
  }

  const mergedBytes = await mergedDoc.save()
  return { buffer: uint8ToArrayBuffer(mergedBytes), failed }
}

export async function getPdfPageSize(
  buffer: ArrayBuffer
): Promise<{ width: number; height: number }> {
  try {
    const doc = await PDFDocument.load(copyArrayBuffer(buffer), { ignoreEncryption: true })
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
