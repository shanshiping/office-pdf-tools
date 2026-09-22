import { PDFDocument } from 'pdf-lib'
import { copyArrayBuffer, uint8ToArrayBuffer } from './bytes'

export async function deletePages(
  inputBuffer: ArrayBuffer,
  pagesToRemove: number[],
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(10)

  const buf = copyArrayBuffer(inputBuffer)
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true })
  onProgress?.(30)

  const sortedPages = [...pagesToRemove].sort((a, b) => b - a)

  for (const pageIndex of sortedPages) {
    pdfDoc.removePage(pageIndex)
  }

  onProgress?.(70)

  const modifiedBytes = await pdfDoc.save()
  onProgress?.(100)

  return uint8ToArrayBuffer(modifiedBytes)
}

export async function getPageCount(buffer: ArrayBuffer): Promise<number> {
  const buf = copyArrayBuffer(buffer)
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true })
  return pdfDoc.getPageCount()
}
