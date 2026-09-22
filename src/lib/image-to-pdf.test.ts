import { describe, expect, it } from 'vitest'
import { A4_HEIGHT, A4_WIDTH, fitInA4, imageToPdf, isImageFile, mimeFromName } from './image-to-pdf'

describe('mimeFromName', () => {
  it('maps common image extensions', () => {
    expect(mimeFromName('a.PNG')).toBe('image/png')
    expect(mimeFromName('b.jpeg')).toBe('image/jpeg')
    expect(mimeFromName('c.webp')).toBe('image/webp')
    expect(mimeFromName('d.bmp')).toBe('image/bmp')
    expect(mimeFromName('e.tif')).toBe('image/tiff')
    expect(mimeFromName('f.unknown')).toBe('image/jpeg')
  })
})

describe('isImageFile', () => {
  it('accepts image mime or extension', () => {
    expect(isImageFile({ name: 'shot.jpg', type: '' } as File)).toBe(true)
    expect(isImageFile({ name: 'notes.pdf', type: 'application/pdf' } as File)).toBe(false)
    expect(isImageFile({ name: 'x.bin', type: 'image/png' } as File)).toBe(true)
  })
})

describe('fitInA4', () => {
  it('scales a landscape photo to fit inside A4 margins', () => {
    const fitted = fitInA4(4000, 2000)
    expect(fitted.width).toBeLessThanOrEqual(A4_WIDTH - 48)
    expect(fitted.height).toBeLessThanOrEqual(A4_HEIGHT - 48)
    expect(fitted.width / fitted.height).toBeCloseTo(2, 5)
  })

  it('scales a portrait photo without overflowing A4', () => {
    const fitted = fitInA4(600, 1200)
    expect(fitted.height).toBeLessThanOrEqual(A4_HEIGHT - 48)
    expect(fitted.width / fitted.height).toBeCloseTo(0.5, 5)
  })
})

describe('imageToPdf', () => {
  it('rejects an empty image list', async () => {
    await expect(imageToPdf([])).rejects.toThrow('请先添加图片')
  })
})
