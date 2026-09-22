import { createWorker } from 'tesseract.js'

type OcrWorker = Awaited<ReturnType<typeof createWorker>>

let workerPromise: Promise<OcrWorker> | null = null
let progressCb: ((progress: number) => void) | undefined

function assetUrl(relativePath: string): string {
  return new URL(relativePath, window.location.href).href
}

export type OcrLine = {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
  confidence: number
}

export type OcrWord = OcrLine

export type OcrPage = {
  text: string
  lines: OcrLine[]
  words: OcrWord[]
}

export async function getOcrWorker(
  onProgress?: (progress: number) => void
): Promise<OcrWorker> {
  progressCb = onProgress
  if (!workerPromise) {
    workerPromise = createWorker('chi_sim+eng', 1, {
      workerPath: assetUrl('tesseract/worker.min.js'),
      corePath: assetUrl('tesseract/tesseract-core-simd-lstm.wasm.js'),
      langPath: assetUrl('tessdata'),
      gzip: true,
      workerBlobURL: true,
      cacheMethod: 'none',
      logger: (message) => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          progressCb?.(message.progress)
        }
      },
    }).then(async (worker) => {
      await worker.setParameters({
        preserve_interword_spaces: '1',
      })
      return worker
    })
  }
  return workerPromise
}

function pushBox(
  target: OcrLine[],
  text: string,
  bbox: { x0: number; y0: number; x1: number; y1: number } | undefined,
  confidence: number
): void {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim()
  if (!cleaned || !bbox) return
  target.push({
    text: cleaned,
    x0: bbox.x0,
    y0: bbox.y0,
    x1: bbox.x1,
    y1: bbox.y1,
    confidence,
  })
}

export async function recognizePage(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrPage> {
  const worker = await getOcrWorker(onProgress)
  const { data } = await worker.recognize(
    canvas,
    { rotateAuto: false },
    { text: true, blocks: true }
  )

  const lines: OcrLine[] = []
  const words: OcrWord[] = []
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        pushBox(lines, line.text, line.bbox, line.confidence ?? 0)
        for (const word of line.words || []) {
          pushBox(words, word.text, word.bbox, word.confidence ?? line.confidence ?? 0)
        }
      }
    }
  }

  return {
    text: (data.text || '').trim(),
    lines,
    words,
  }
}

export async function recognizeWords(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrWord[]> {
  const page = await recognizePage(canvas, onProgress)
  return page.words
}

export async function recognizeLines(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<OcrLine[]> {
  const page = await recognizePage(canvas, onProgress)
  return page.lines
}

export async function recognizeCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<string> {
  const page = await recognizePage(canvas, onProgress)
  return page.text
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return
  try {
    const worker = await workerPromise
    await worker.terminate()
  } finally {
    workerPromise = null
  }
}
