import { describe, expect, it } from 'vitest'
import { compressPdf, getCompressionLabel, getCompressionParams } from './pdf-compress'
import { makePdf } from './test-pdf'

describe('getCompressionParams', () => {
  it('uses a higher render scale for low compression', () => {
    expect(getCompressionParams('low').scale).toBeGreaterThan(getCompressionParams('medium').scale)
    expect(getCompressionParams('medium').scale).toBeGreaterThan(getCompressionParams('high').scale)
  })

  it('uses a lower JPEG quality for high compression', () => {
    expect(getCompressionParams('high').quality).toBeLessThan(getCompressionParams('medium').quality)
    expect(getCompressionParams('medium').quality).toBeLessThan(getCompressionParams('low').quality)
  })
})

describe('getCompressionLabel', () => {
  it('returns a Chinese label for each level', () => {
    expect(getCompressionLabel('low')).toContain('低压缩')
    expect(getCompressionLabel('medium')).toContain('中等')
    expect(getCompressionLabel('high')).toContain('高压缩')
  })
})

describe('compressPdf', () => {
  it('requires a browser canvas', async () => {
    await expect(compressPdf(await makePdf('C'), 'medium')).rejects.toThrow()
  })
})
