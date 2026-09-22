import { describe, expect, it } from 'vitest'
import { copyArrayBuffer, numberArrayToBuffer, uint8ToArrayBuffer } from './bytes'

describe('uint8ToArrayBuffer', () => {
  it('copies a view with byteOffset instead of sharing a larger buffer', () => {
    const backing = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
    const view = backing.subarray(2, 6)
    const copied = uint8ToArrayBuffer(view)
    expect(copied.byteLength).toBe(4)
    expect([...new Uint8Array(copied)]).toEqual([2, 3, 4, 5])
  })
})

describe('copyArrayBuffer', () => {
  it('returns an independent copy', () => {
    const src = new Uint8Array([9, 8, 7]).buffer
    const copy = copyArrayBuffer(src)
    new Uint8Array(copy)[0] = 1
    expect(new Uint8Array(src)[0]).toBe(9)
  })
})

describe('numberArrayToBuffer', () => {
  it('copies number arrays, views, and ArrayBuffers', () => {
    expect([...new Uint8Array(numberArrayToBuffer([1, 2, 3]))]).toEqual([1, 2, 3])
    expect([...new Uint8Array(numberArrayToBuffer(new Uint8Array([4, 5])))]).toEqual([4, 5])
    const src = new Uint8Array([6, 7]).buffer
    const copy = numberArrayToBuffer(src)
    new Uint8Array(copy)[0] = 0
    expect(new Uint8Array(src)[0]).toBe(6)
  })
})
