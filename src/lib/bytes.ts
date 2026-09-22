export function copyArrayBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

export function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export function numberArrayToBuffer(data: number[] | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return copyArrayBuffer(data)
  if (data instanceof Uint8Array) return uint8ToArrayBuffer(data)
  return uint8ToArrayBuffer(Uint8Array.from(data))
}
