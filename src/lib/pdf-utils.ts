import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

export async function getPageCount(buffer: ArrayBuffer): Promise<number> {
  const buf = copyBuffer(buffer)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  return pdf.numPages
}

export async function renderPageToCanvas(
  buffer: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 0.5
): Promise<void> {
  const buf = copyBuffer(buffer)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  await page.render({ canvasContext: ctx, viewport }).promise
}

export async function renderAllPages(
  buffer: ArrayBuffer,
  scale = 0.4
): Promise<string[]> {
  const buf = copyBuffer(buffer)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const images: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.8))
  }

  return images
}
