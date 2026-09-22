import { describe, expect, it } from 'vitest'
import { getFileType, isFileType } from './useFileDrop'

describe('isFileType', () => {
  it('accepts PDF by extension or mime', () => {
    expect(isFileType({ name: 'a.PDF', type: '' }, 'pdf')).toBe(true)
    expect(isFileType({ name: 'a.bin', type: 'application/pdf' }, 'pdf')).toBe(true)
    expect(isFileType({ name: 'a.jpg', type: 'image/jpeg' }, 'pdf')).toBe(false)
  })

  it('accepts images for the image filter', () => {
    expect(isFileType({ name: 'scan.webp', type: '' }, 'image')).toBe(true)
    expect(isFileType({ name: 'scan.tiff', type: '' }, 'image')).toBe(true)
    expect(isFileType({ name: 'doc.pdf', type: 'application/pdf' }, 'image')).toBe(false)
  })

  it('accepts both when fileType is all', () => {
    expect(isFileType({ name: 'a.pdf', type: '' }, 'all')).toBe(true)
    expect(isFileType({ name: 'a.png', type: '' }, 'all')).toBe(true)
    expect(isFileType({ name: 'a.txt', type: 'text/plain' }, 'all')).toBe(false)
  })
})

describe('getFileType', () => {
  it('classifies PDF and image uploads', () => {
    expect(getFileType({ name: 'a.pdf', type: '' })).toBe('pdf')
    expect(getFileType({ name: 'a.bin', type: 'application/pdf' })).toBe('pdf')
    expect(getFileType({ name: 'a.jpg', type: 'image/jpeg' })).toBe('image')
  })
})
