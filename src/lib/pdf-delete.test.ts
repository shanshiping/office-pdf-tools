import { describe, expect, it, vi } from 'vitest'
import { deletePages, getPageCount } from './pdf-delete'
import { makePdf } from './test-pdf'

describe('getPageCount', () => {
  it('reads the page count from a valid PDF', async () => {
    expect(await getPageCount(await makePdf('Count', 4))).toBe(4)
  })
})

describe('deletePages', () => {
  it('keeps remaining pages when removing the middle one', async () => {
    const result = await deletePages(await makePdf('Doc', 3), [1])
    expect(await getPageCount(result)).toBe(2)
  })

  it('can drop the first and last pages', async () => {
    const result = await deletePages(await makePdf('Doc', 4), [0, 3])
    expect(await getPageCount(result)).toBe(2)
  })

  it('returns the same page count when the remove list is empty', async () => {
    const result = await deletePages(await makePdf('Doc', 2), [])
    expect(await getPageCount(result)).toBe(2)
  })

  it('reports progress', async () => {
    const onProgress = vi.fn()
    await deletePages(await makePdf('Doc', 2), [0], onProgress)
    expect(onProgress).toHaveBeenCalledWith(10)
    expect(onProgress).toHaveBeenCalledWith(100)
  })
})
