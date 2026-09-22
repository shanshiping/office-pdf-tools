import { describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { mergePdf } from './pdf-merge'
import { getPageCount } from './pdf-delete'
import { makePdf } from './test-pdf'

describe('mergePdf', () => {
  it('keeps source order and page counts', async () => {
    const merged = await mergePdf([
      { buffer: await makePdf('A', 1), name: 'a.pdf' },
      { buffer: await makePdf('B', 2), name: 'b.pdf' },
      { buffer: await makePdf('C', 1), name: 'c.pdf' },
    ])
    expect(await getPageCount(merged)).toBe(4)
    const doc = await PDFDocument.load(merged)
    expect(doc.getPage(0).getSize().height).toBe(600)
  })

  it('returns a single-file copy when only one PDF is given', async () => {
    const src = await makePdf('Solo', 2)
    const merged = await mergePdf([{ buffer: src, name: 'solo.pdf' }])
    expect(await getPageCount(merged)).toBe(2)
    expect(merged).not.toBe(src)
  })

  it('reports progress once per file', async () => {
    const onProgress = vi.fn()
    await mergePdf(
      [
        { buffer: await makePdf('A'), name: 'a.pdf' },
        { buffer: await makePdf('B'), name: 'b.pdf' },
      ],
      onProgress
    )
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenLastCalledWith(100)
  })

  it('rejects a truncated PDF', async () => {
    await expect(
      mergePdf([{ buffer: new Uint8Array([1, 2, 3, 4]).buffer, name: 'bad.pdf' }])
    ).rejects.toThrow()
  })
})
