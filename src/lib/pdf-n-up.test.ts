import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, rgb } from 'pdf-lib'
import { pagesOnSheet, sheetCount, createNUpPdf, calculateLayout, getPdfPageSize, PRESET_LAYOUTS } from './pdf-n-up'
import { uint8ToArrayBuffer } from './bytes'

async function blankPdf(pages = 1): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([300, 400])
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 260,
      height: 360,
      color: rgb(0.85, 0.9, 0.95),
    })
  }
  return uint8ToArrayBuffer(await doc.save())
}

describe('pagesOnSheet', () => {
  it('fills later sheets instead of dropping to zero', () => {
    expect(pagesOnSheet(10, 4, 0)).toBe(4)
    expect(pagesOnSheet(10, 4, 1)).toBe(4)
    expect(pagesOnSheet(10, 4, 2)).toBe(2)
    expect(pagesOnSheet(10, 4, 3)).toBe(0)
  })
})

describe('sheetCount', () => {
  it('needs 3 A4 sheets for 10 pages at 2x2', () => {
    expect(sheetCount(10, 4)).toBe(3)
  })

  it('returns 0 for empty input', () => {
    expect(sheetCount(0, 4)).toBe(0)
    expect(sheetCount(4, 0)).toBe(0)
  })
})

describe('calculateLayout', () => {
  it('splits A4 into equal cells', () => {
    const layout = calculateLayout({ rows: 2, cols: 2, margin: 20, spacing: 10 })
    expect(layout.totalCells).toBe(4)
    expect(layout.cellWidth).toBeGreaterThan(0)
    expect(layout.cellHeight).toBeGreaterThan(0)
    expect(layout.cellWidth * 2 + 10 + 40).toBeCloseTo(layout.availableWidth + 40, 5)
  })
})

describe('PRESET_LAYOUTS', () => {
  it('covers the invoice layouts shown in the UI', () => {
    expect(PRESET_LAYOUTS['2x2'].rows * PRESET_LAYOUTS['2x2'].cols).toBe(4)
    expect(PRESET_LAYOUTS['3x3'].rows * PRESET_LAYOUTS['3x3'].cols).toBe(9)
  })
})

describe('createNUpPdf', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes leftover pages onto a second A4 sheet', async () => {
    const files = []
    for (let i = 0; i < 5; i++) {
      files.push({ buffer: await blankPdf(1), name: `${i}.pdf`, rotation: 0 })
    }
    const { buffer, failed } = await createNUpPdf(files, {
      rows: 2,
      cols: 2,
      margin: 20,
      spacing: 5,
    })
    expect(failed).toEqual([])
    const out = await PDFDocument.load(buffer)
    expect(out.getPageCount()).toBe(2)
  })

  it('embeds every page of a multi-page PDF', async () => {
    const { buffer, failed } = await createNUpPdf(
      [{ buffer: await blankPdf(3), name: 'multi.pdf', rotation: 0 }],
      { rows: 2, cols: 2, margin: 20, spacing: 5 }
    )
    expect(failed).toEqual([])
    const out = await PDFDocument.load(buffer)
    expect(out.getPageCount()).toBe(1)
  })

  it('records a broken file and still lays out the valid ones', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { buffer, failed } = await createNUpPdf(
      [
        { buffer: new Uint8Array([0, 1, 2]).buffer, name: 'bad.pdf', rotation: 0 },
        { buffer: await blankPdf(1), name: 'ok.pdf', rotation: 90 },
      ],
      { rows: 2, cols: 2, margin: 20, spacing: 5 }
    )
    expect(failed).toEqual(['bad.pdf'])
    expect((await PDFDocument.load(buffer)).getPageCount()).toBe(1)
  })

  it('throws when nothing can be arranged', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      createNUpPdf(
        [{ buffer: new Uint8Array([0, 1, 2]).buffer, name: 'bad.pdf', rotation: 0 }],
        { rows: 2, cols: 2, margin: 20, spacing: 5 }
      )
    ).rejects.toThrow('无法处理文件')
  })
})

describe('getPdfPageSize', () => {
  it('reads the first page size', async () => {
    const size = await getPdfPageSize(await blankPdf(1))
    expect(size.width).toBe(300)
    expect(size.height).toBe(400)
  })

  it('returns zeros for an invalid PDF', async () => {
    expect(await getPdfPageSize(new Uint8Array([1, 2, 3]).buffer)).toEqual({ width: 0, height: 0 })
  })
})
