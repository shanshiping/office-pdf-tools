import { PDFDocument } from 'pdf-lib'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

export async function mergePdf(
  files: { buffer: ArrayBuffer; name: string }[],
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const mergedDoc = await PDFDocument.create()
  const total = files.length

  for (let i = 0; i < total; i++) {
    const buf = copyBuffer(files[i].buffer)
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true })
    const pages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    pages.forEach((page) => mergedDoc.addPage(page))
    onProgress?.(((i + 1) / total) * 100)
  }

  const mergedBytes = await mergedDoc.save()
  return copyBuffer(mergedBytes.buffer as ArrayBuffer)
}
