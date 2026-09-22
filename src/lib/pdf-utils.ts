import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { copyArrayBuffer } from './bytes'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export async function getPageCount(buffer: ArrayBuffer): Promise<number> {
  const buf = copyArrayBuffer(buffer)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  return pdf.numPages
}

export async function renderPageToCanvas(
  buffer: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale = 0.5
): Promise<void> {
  const buf = copyArrayBuffer(buffer)
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
  const buf = copyArrayBuffer(buffer)
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
