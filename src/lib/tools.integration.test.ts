import { describe, expect, it } from 'vitest'
import { mergePdf } from './pdf-merge'
import { deletePages, getPageCount } from './pdf-delete'
import { createNUpPdf } from './pdf-n-up'
import { makePdf } from './test-pdf'

describe('tool integration', () => {
  it('merges two PDFs into one 3-page file', async () => {
    const a = await makePdf('Alpha', 1)
    const b = await makePdf('Beta', 2)
    const merged = await mergePdf([
      { buffer: a, name: 'a.pdf' },
      { buffer: b, name: 'b.pdf' },
    ])
    expect(await getPageCount(merged)).toBe(3)
  })

  it('deletes selected pages', async () => {
    const src = await makePdf('Doc', 3)
    const result = await deletePages(src, [1])
    expect(await getPageCount(result)).toBe(2)
  })

  it('n-up lays 5 invoice pages onto 2 A4 sheets', async () => {
    const files = []
    for (let i = 0; i < 5; i++) {
      files.push({ buffer: await makePdf(`Invoice${i}`), name: `${i}.pdf`, rotation: 0 })
    }
    const { buffer, failed } = await createNUpPdf(files, {
      rows: 2,
      cols: 2,
      margin: 20,
      spacing: 5,
    })
    expect(failed).toEqual([])
    expect(await getPageCount(buffer)).toBe(2)
  })

  it('merges then deletes to produce a 2-page result', async () => {
    const merged = await mergePdf([
      { buffer: await makePdf('A', 2), name: 'a.pdf' },
      { buffer: await makePdf('B', 2), name: 'b.pdf' },
    ])
    expect(await getPageCount(merged)).toBe(4)
    const trimmed = await deletePages(merged, [0, 3])
    expect(await getPageCount(trimmed)).toBe(2)
  })

  it('n-up accepts a merged multi-page PDF', async () => {
    const merged = await mergePdf([
      { buffer: await makePdf('A'), name: 'a.pdf' },
      { buffer: await makePdf('B'), name: 'b.pdf' },
      { buffer: await makePdf('C'), name: 'c.pdf' },
    ])
    const { buffer, failed } = await createNUpPdf(
      [{ buffer: merged, name: 'merged.pdf', rotation: 0 }],
      { rows: 2, cols: 2, margin: 20, spacing: 5 }
    )
    expect(failed).toEqual([])
    expect(await getPageCount(buffer)).toBe(1)
  })
})
