import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { uint8ToArrayBuffer } from './bytes'

export async function makePdf(
  label = 'Doc',
  pages = 1,
  size: [number, number] = [400, 600]
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage(size)
    page.drawRectangle({
      x: 0,
      y: 0,
      width: size[0],
      height: size[1],
      color: rgb(1, 1, 1),
    })
    page.drawText(`${label} page ${i + 1}`, {
      x: 36,
      y: size[1] - 48,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    })
  }
  return uint8ToArrayBuffer(await doc.save())
}
