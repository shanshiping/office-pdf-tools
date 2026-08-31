import { PDFDocument } from 'pdf-lib'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

export async function deletePages(
  inputBuffer: ArrayBuffer,
  pagesToRemove: number[],
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(10)

  const buf = copyBuffer(inputBuffer)
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true })
  onProgress?.(30)

  const sortedPages = [...pagesToRemove].sort((a, b) => b - a)

  for (const pageIndex of sortedPages) {
    pdfDoc.removePage(pageIndex)
  }

  onProgress?.(70)

  const modifiedBytes = await pdfDoc.save()
  onProgress?.(100)

  return copyBuffer(modifiedBytes.buffer as ArrayBuffer)
}

export async function getPageCount(buffer: ArrayBuffer): Promise<number> {
  const buf = copyBuffer(buffer)
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true })
  return pdfDoc.getPageCount()
}
