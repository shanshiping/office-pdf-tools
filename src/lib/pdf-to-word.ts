import * as pdfjsLib from 'pdfjs-dist'
import type { PDFPageProxy, PageViewport } from 'pdfjs-dist'
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  convertInchesToTwip,
  PageOrientation,
} from 'docx'
import { copyArrayBuffer, uint8ToArrayBuffer } from './bytes'
import { recognizePage, type OcrLine, type OcrWord } from './ocr'
import './pdf-utils'

export const EMPTY_PDF_TEXT_ERROR = '未能识别到文字。请确认 PDF 不是空白页，或尝试更清晰的扫描件。'

export type ProgressFn = (progress: number, label?: string) => void

export type PageLine = {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  bold?: boolean
  confidence?: number
}

export type LaidOutItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontName?: string
  bold?: boolean
  hasEOL?: boolean
}

export type PageImage = {
  jpeg: Uint8Array
  x: number
  y: number
  width: number
  height: number
}

export type WordPage = {
  widthPt: number
  heightPt: number
  lines: PageLine[]
  images?: PageImage[]
}

const NATIVE_TEXT_MIN_CHARS = 15
const RENDER_SCALE = 2.4
const CJK_FONT = {
  ascii: 'Times New Roman',
  hAnsi: 'Times New Roman',
  eastAsia: 'Microsoft YaHei',
}

function isCjkChar(ch: string): boolean {
  return /[\u3400-\u9fff]/.test(ch)
}

export function joinLineItems(parts: string[]): string {
  let out = ''
  for (const part of parts) {
    if (!part) continue
    if (!out) {
      out = part
      continue
    }
    const prev = out[out.length - 1]
    const next = part[0]
    const skipSpace =
      /\s/.test(prev) ||
      /\s/.test(next) ||
      (isCjkChar(prev) && isCjkChar(next))
    out += skipSpace ? part : ` ${part}`
  }
  return out
}

export function tightenCjkSpacing(text: string): string {
  return text
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .replace(/([\u3400-\u9fff])\s+(?=[\u3000-\u303f\uff00-\uffef])/g, '$1')
    .replace(/([\u3000-\u303f\uff00-\uffef])\s+(?=[\u3400-\u9fff])/g, '$1')
}

const LATIN_KEEP_RE = /^(TEL|CO|LTD|NO|PDF|VAT|CEO|HR|OK)$/i

export function isRedInkPixel(r: number, g: number, b: number): boolean {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b
  // Keep near-black strokes (chromatic fringe); bleach bright seal red.
  if (luma < 55) return false
  return r > 120 && r > g + 30 && r > b + 30
}

export function stripLatinNoise(text: string): string {
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length
  const latin = (text.match(/[A-Za-z]/g) || []).length
  if (cjk < 4 && cjk < latin) return text

  let out = text.replace(/\b[A-Za-z]{1,4}\s*\(\s*[A-Za-z]{1,12}\s*\)/g, '')
  out = out.replace(/\(\s*[A-Za-z]{1,12}\s*\)/g, '')
  out = out.replace(/\b[A-Za-z]{2,16}\b/g, (token) => (LATIN_KEEP_RE.test(token) ? token : ''))
  out = out.replace(/\b[A-Za-z]\b/g, (token) => (LATIN_KEEP_RE.test(token) ? token : ''))
  out = out.replace(/([：:])\s*[.．]\s*/g, '$1')
  out = out.replace(/(?<=[\u3400-\u9fff：:])\s*[.．]\s*(?=[\u3400-\u9fff])/g, '')
  return tightenCjkSpacing(out.replace(/\s{2,}/g, ' ').trim())
}

export function cleanOcrText(text: string): string {
  return stripLatinNoise(
    tightenCjkSpacing(
      text
        .replace(/[|｜¦]/g, '')
        .replace(/[·•]/g, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/([，。；：、])\1+/g, '$1')
        .trim()
    )
  )
}

export function isUsefulOcrLine(text: string, confidence = 100): boolean {
  const cleaned = cleanOcrText(text)
  const hasCjk = /[\u3400-\u9fff]/.test(cleaned)
  const minConfidence = hasCjk ? 22 : 38
  if (!cleaned || confidence < minConfidence) return false
  const compact = cleaned.replace(/\s/g, '')
  if (compact.length < 2) return false
  const useful = compact.replace(/[^\u3400-\u9fffA-Za-z0-9]/g, '')
  if (useful.length === 0) return false
  if (compact.length > 6 && useful.length / compact.length < 0.4) return false
  if (!hasCjk && useful.length < 8) return false
  return true
}

export function isLikelyStamp(
  image: { x: number; y: number; width: number; height: number },
  pageWidth: number,
  pageHeight: number
): boolean {
  if (image.width < 56 || image.height < 56) return false
  if (image.width > pageWidth * 0.42 || image.height > pageHeight * 0.38) return false
  const aspect = image.width / image.height
  if (aspect < 0.55 || aspect > 1.85) return false
  if (image.x + image.width / 2 < pageWidth * 0.48) return false
  if (image.y < pageHeight * 0.32) return false
  return true
}

const SCANNER_WATERMARK_RE = /AI\s*校对|本地方开|扫描全能王|福昕|CamScanner/i

export function isScannerWatermark(text: string): boolean {
  return SCANNER_WATERMARK_RE.test(text)
}

export function isEdgeStampText(
  line: { x: number; width: number },
  pageWidth: number
): boolean {
  return line.x > pageWidth * 0.86 && line.width < pageWidth * 0.14
}

export function isRedSealSample(redInk: number, darkInk: number): boolean {
  return darkInk >= 20 && redInk / darkInk >= 0.15
}

export function enhanceForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, out.width, out.height)
  const pixels = img.data
  for (let i = 0; i < pixels.length; i += 4) {
    if (isRedInkPixel(pixels[i], pixels[i + 1], pixels[i + 2])) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255
    }
  }
  let min = 255
  let max = 0
  for (let i = 0; i < pixels.length; i += 32) {
    const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    if (luma < min) min = luma
    if (luma > max) max = luma
  }
  const range = Math.max(24, max - min)
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    let value = ((luma - min) / range) * 255
    if (value > 232) value = 255
    else if (value < 48) value = 0
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value
  }
  ctx.putImageData(img, 0, 0)
  return out
}

function sampleBoxInk(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number }
): { redInk: number; darkInk: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { redInk: 0, darkInk: 0 }
  const sx = Math.max(0, Math.floor(box.x))
  const sy = Math.max(0, Math.floor(box.y))
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.round(box.w)))
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.round(box.h)))
  const data = ctx.getImageData(sx, sy, sw, sh).data
  let redInk = 0
  let darkInk = 0
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    if (luma > 236) continue
    darkInk++
    if (isRedInkPixel(r, g, b)) redInk++
  }
  return { redInk, darkInk }
}

export function throwIfNoText(charCount: number): void {
  if (charCount <= 0) {
    throw new Error(EMPTY_PDF_TEXT_ERROR)
  }
}

/** PDF 点（72dpi）→ Word twip */
export function pdfPointsToTwips(points: number): number {
  return convertInchesToTwip(points / 72)
}

/** PDF 点 → Word 图片像素（96dpi） */
export function pdfPointsToWordPixels(points: number): number {
  return Math.max(1, Math.round((points / 72) * 96))
}

/** PDF 点 → EMU（浮动图偏移） */
export function pdfPointsToEmu(points: number): number {
  return Math.round(points * 12700)
}

export function medianNumber(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

export function filterOutlierItems(items: LaidOutItem[]): LaidOutItem[] {
  if (items.length < 3) return items
  const median = medianNumber(items.map((item) => item.height)) || 12
  return items.filter((item) => {
    if (item.height > median * 2.4) return false
    if (item.width > median * 18) return false
    return true
  })
}

function boxesOverlap(a: PageLine, b: PageLine): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX <= 0 || overlapY <= 0) return false
  const area = Math.min(a.width * a.height, b.width * b.height)
  return overlapX * overlapY > area * 0.45
}

function unionLineBox(a: PageLine, b: PageLine): Pick<PageLine, 'x' | 'y' | 'width' | 'height'> {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) }
}

function usefulCharCount(text: string): number {
  return (text.match(/[\u3400-\u9fffA-Za-z0-9]/g) || []).length
}

export function mergeOverlappingPageLines(a: PageLine, b: PageLine): PageLine {
  if (a.text.includes(b.text)) return { ...a, ...unionLineBox(a, b) }
  if (b.text.includes(a.text)) return { ...b, ...unionLineBox(a, b) }
  // Same-line duplicate / OCR double-read: keep the denser text, do not glue junk.
  return usefulCharCount(b.text) > usefulCharCount(a.text)
    ? { ...b, ...unionLineBox(a, b) }
    : { ...a, ...unionLineBox(a, b) }
}

export function normalizePageLines(lines: PageLine[], pageWidth: number): PageLine[] {
  if (lines.length === 0) return lines
  const median = medianNumber(lines.map((line) => line.height)) || 12
  const bodyFont = Math.min(12.5, Math.max(10, median * 0.78))
  const maxHeight = Math.max(median * 2.05, 20)

  const cleaned = lines
    .filter((line) => line.height <= maxHeight)
    .map((line) => {
      const centered =
        Math.abs(line.x + line.width / 2 - pageWidth / 2) < pageWidth * 0.14 &&
        line.width < pageWidth * 0.82
      const title = centered && line.fontSize >= median * 1.15
      const fontSize = title
        ? Math.min(18, Math.max(14, bodyFont * 1.4))
        : Math.min(13, Math.max(10, Math.min(line.fontSize * 0.8, bodyFont * 1.1)))
      return {
        ...line,
        fontSize,
        height: Math.min(line.height, fontSize * 1.35),
      }
    })

  const kept: PageLine[] = []
  const sorted = [...cleaned].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const line of sorted) {
    const index = kept.findIndex((item) => boxesOverlap(item, line))
    if (index < 0) {
      kept.push(line)
      continue
    }
    const prev = kept[index]
    const midGap = Math.abs(prev.y + prev.height / 2 - (line.y + line.height / 2))
    // Tall OCR boxes often overlap the next wrap line — keep both instead of dropping.
    if (midGap > Math.max(prev.height, line.height) * 0.35) {
      kept.push(line)
      continue
    }
    kept[index] = mergeOverlappingPageLines(prev, line)
  }
  return kept
}

export function groupLaidOutItems(items: LaidOutItem[]): PageLine[] {
  const usable = items.filter((item) => item.text.trim())
  usable.sort((a, b) => a.y - b.y || a.x - b.x)

  const groups: LaidOutItem[][] = []
  for (const item of usable) {
    const last = groups[groups.length - 1]
    if (!last) {
      groups.push([item])
      continue
    }
    const prev = last[last.length - 1]
    if (prev.hasEOL) {
      groups.push([item])
      continue
    }
    const threshold = Math.max(item.height, prev.height, 8) * 0.45
    if (Math.abs(item.y - prev.y) <= threshold) last.push(item)
    else groups.push([item])
  }

  return groups
    .map((parts) => {
      const ordered = [...parts].sort((a, b) => a.x - b.x)
      const x = Math.min(...ordered.map((part) => part.x))
      const y = Math.min(...ordered.map((part) => part.y))
      const right = Math.max(...ordered.map((part) => part.x + part.width))
      const bottom = Math.max(...ordered.map((part) => part.y + part.height))
      const fontSize = Math.max(...ordered.map((part) => part.height))
      const bold = ordered.some(
        (part) => part.bold || /bold|black|heavy|semibold/i.test(part.fontName || '')
      )
      return {
        text: tightenCjkSpacing(joinLineItems(ordered.map((part) => part.text))),
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
        fontSize,
        bold,
      }
    })
    .filter((line) => line.text.trim())
}

export function detectHeaderBottom(lines: PageLine[], pageHeight: number): number {
  if (lines.length < 2) return 0
  const sorted = [...lines].sort((a, b) => a.y - b.y)
  for (let i = 0; i < Math.min(sorted.length - 1, 8); i++) {
    const bottom = sorted[i].y + sorted[i].height
    if (bottom > pageHeight * 0.42) break
    const gap = sorted[i + 1].y - bottom
    if (gap >= 14) {
      return Math.max(0, sorted[i + 1].y - Math.min(8, gap / 2))
    }
  }
  return 0
}

export function markSectionHeadings(lines: PageLine[]): PageLine[] {
  if (lines.length === 0) return lines
  const sizes = lines.map((line) => line.fontSize).sort((a, b) => a - b)
  const median = sizes[Math.floor(sizes.length / 2)] || 12
  return lines.map((line) => ({
    ...line,
    bold:
      line.bold ||
      line.fontSize >= median * 1.28 ||
      /^[一二三四五六七八九十]+[、．.]/.test(line.text.trim()),
  }))
}

export type DocBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'greeting'; text: string }
  | { kind: 'list'; text: string }
  | { kind: 'paragraph'; text: string; firstLineIndent?: boolean }

const HEADING_RE = /^[一二三四五六七八九十]+[、．.]/
const LIST_RE = /^\d+\s*[\.、，,．)]/
const GREETING_RE = /全体员工|各部门/

export function isLikelyListContinuation(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (LIST_RE.test(t) || HEADING_RE.test(t)) return false
  if (/^(其他|备注|注[：:])/.test(t)) return false
  if (/^[\u3400-\u9fff0-9A-Za-z]{1,16}类?支出[：:;；]/.test(t)) return false
  return true
}

export function splitFusedNumberedText(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const byNumber = trimmed.split(/(?<=[。；;])\s*(?=\d+\s*[\.、，,．)])/)
  const out: string[] = []
  for (const chunk of byNumber) {
    for (const part of chunk.split(/(?<=[。])(?=其他)/)) {
      const clean = part.trim()
      if (clean) out.push(clean)
    }
  }
  return out.length ? out : [trimmed]
}

export function expandFusedListLines(lines: PageLine[]): PageLine[] {
  const out: PageLine[] = []
  for (const line of lines) {
    const parts = splitFusedNumberedText(line.text)
    if (parts.length <= 1) {
      out.push(line)
      continue
    }
    parts.forEach((text, index) => {
      out.push({
        ...line,
        text,
        y: line.y + index * Math.max(12, line.height * 0.9),
        height: Math.max(10, line.height * 0.85),
      })
    })
  }
  return out
}

export function linesToDocBlocks(lines: PageLine[], _pageWidth: number): DocBlock[] {
  const sorted = expandFusedListLines([...lines]).sort((a, b) => a.y - b.y || a.x - b.x)
  if (sorted.length === 0) return []

  const classify = (line: PageLine, isFirst: boolean): DocBlock['kind'] => {
    const text = line.text.trim()
    if (HEADING_RE.test(text)) return 'heading'
    if (LIST_RE.test(text)) return 'list'
    if (/^(其他|备注)/.test(text) && /支出|说明|要求/.test(text)) return 'list'
    if (GREETING_RE.test(text) && text.length < 48) return 'greeting'
    if (isFirst && !LIST_RE.test(text) && !HEADING_RE.test(text)) return 'title'
    return 'paragraph'
  }

  const groups: { kind: DocBlock['kind']; lines: PageLine[] }[] = []
  for (const line of sorted) {
    const last = groups[groups.length - 1]
    const kind = classify(line, groups.length === 0)
    const prev = last?.lines[last.lines.length - 1]
    const gap = prev ? line.y - (prev.y + prev.height) : 999
    const text = line.text.trim()
    const newListItem = LIST_RE.test(text) || (/^(其他|备注)/.test(text) && /支出|说明|要求/.test(text))

    if (
      last?.kind === 'list' &&
      !newListItem &&
      kind === 'paragraph' &&
      gap <= 14 &&
      isLikelyListContinuation(text)
    ) {
      last.lines.push(line)
      continue
    }
    if (last?.kind === 'paragraph' && kind === 'paragraph' && gap <= 14) {
      last.lines.push(line)
      continue
    }
    if (last?.kind === 'title' && kind === 'paragraph' && gap <= 8 && text.length < 24) {
      last.lines.push(line)
      continue
    }

    groups.push({ kind, lines: [line] })
  }

  const xs = sorted.map((line) => line.x).sort((a, b) => a - b)
  const leftEdge = xs[Math.floor(xs.length * 0.2)] ?? 72

  return groups
    .map((group) => {
      const text = tightenCjkSpacing(joinLineItems(group.lines.map((line) => line.text.trim())))
      if (!text) return null
      if (group.kind === 'paragraph') {
        return {
          kind: 'paragraph' as const,
          text,
          firstLineIndent: group.lines[0].x > leftEdge + 14,
        }
      }
      return { kind: group.kind, text } as DocBlock
    })
    .filter((block): block is DocBlock => !!block)
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('页面渲染失败')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function cropCanvasJpeg(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  quality = 0.92
): Uint8Array {
  const sx = Math.max(0, Math.floor(x))
  const sy = Math.max(0, Math.floor(y))
  const sw = Math.max(1, Math.min(canvas.width - sx, Math.round(width)))
  const sh = Math.max(1, Math.min(canvas.height - sy, Math.round(height)))
  const cropped = document.createElement('canvas')
  cropped.width = sw
  cropped.height = sh
  const ctx = cropped.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, sw, sh)
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  return dataUrlToBytes(cropped.toDataURL('image/jpeg', quality))
}

type PixelBox = { x: number; y: number; w: number; h: number }

function boxesNear(a: PixelBox, b: PixelBox, gap: number): boolean {
  return (
    a.x <= b.x + b.w + gap &&
    b.x <= a.x + a.w + gap &&
    a.y <= b.y + b.h + gap &&
    b.y <= a.y + a.h + gap
  )
}

function unionBox(a: PixelBox, b: PixelBox): PixelBox {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

function mergeNearbyBoxes(boxes: PixelBox[], gap: number): PixelBox[] {
  const out = boxes.map((box) => ({ ...box }))
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (!boxesNear(out[i], out[j], gap)) continue
        out[i] = unionBox(out[i], out[j])
        out.splice(j, 1)
        changed = true
        break
      }
      if (changed) break
    }
  }
  return out
}

function findGraphicBoxes(
  canvas: HTMLCanvasElement,
  masked: PixelBox[],
  minCells = 4
): PixelBox[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const { width, height } = canvas
  const cell = 8
  const cols = Math.ceil(width / cell)
  const rows = Math.ceil(height / cell)
  const ink = new Uint8Array(cols * rows)
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let dark = false
      const y0 = row * cell
      const x0 = col * cell
      for (let dy = 0; dy < cell && y0 + dy < height && !dark; dy += 2) {
        for (let dx = 0; dx < cell && x0 + dx < width; dx += 2) {
          const i = ((y0 + dy) * width + (x0 + dx)) * 4
          if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) {
            dark = true
            break
          }
        }
      }
      if (dark) ink[row * cols + col] = 1
    }
  }

  const pad = 18
  for (const box of masked) {
    const x0 = Math.max(0, Math.floor((box.x - pad) / cell))
    const y0 = Math.max(0, Math.floor((box.y - pad) / cell))
    const x1 = Math.min(cols, Math.ceil((box.x + box.w + pad) / cell))
    const y1 = Math.min(rows, Math.ceil((box.y + box.h + pad) / cell))
    for (let row = y0; row < y1; row++) {
      for (let col = x0; col < x1; col++) {
        ink[row * cols + col] = 0
      }
    }
  }

  const seen = new Uint8Array(cols * rows)
  const boxes: PixelBox[] = []
  const stack: number[] = []

  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue
    let minC = cols
    let minR = rows
    let maxC = 0
    let maxR = 0
    let count = 0
    stack.push(start)
    seen[start] = 1
    while (stack.length) {
      const idx = stack.pop() as number
      const row = (idx / cols) | 0
      const col = idx % cols
      minC = Math.min(minC, col)
      maxC = Math.max(maxC, col)
      minR = Math.min(minR, row)
      maxR = Math.max(maxR, row)
      count++
      const neighbors = [
        [row, col - 1],
        [row, col + 1],
        [row - 1, col],
        [row + 1, col],
      ]
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
        const n = nr * cols + nc
        if (!ink[n] || seen[n]) continue
        seen[n] = 1
        stack.push(n)
      }
    }
    if (count < minCells) continue
    const x = minC * cell
    const y = minR * cell
    const w = Math.min(width - x, (maxC - minC + 1) * cell)
    const h = Math.min(height - y, (maxR - minR + 1) * cell)
    if (w < 24 && h < 24) continue
    if (w > width * 0.48 || h > height * 0.4) continue
    if (w * h > width * height * 0.22) continue
    boxes.push({ x, y, w, h })
  }

  return mergeNearbyBoxes(boxes, 8)
}

async function renderPageCanvas(
  page: PDFPageProxy,
  scale = RENDER_SCALE
): Promise<{ canvas: HTMLCanvasElement; widthPt: number; heightPt: number; viewport: PageViewport }> {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return {
    canvas,
    widthPt: base.width,
    heightPt: base.height,
    viewport: base,
  }
}

function pdfItemsToLaidOut(
  items: Array<{
    str: string
    transform: number[]
    width: number
    height: number
    fontName: string
    hasEOL?: boolean
  }>,
  viewport: PageViewport
): LaidOutItem[] {
  const laid: LaidOutItem[] = []
  for (const item of items) {
    if (!item.str?.trim()) continue
    const fontSize = Math.abs(item.height) || Math.abs(item.transform[3]) || 12
    const x0 = item.transform[4]
    const y0 = item.transform[5]
    const rect = viewport.convertToViewportRectangle([
      x0,
      y0,
      x0 + item.width,
      y0 + fontSize,
    ])
    const left = Math.min(rect[0], rect[2])
    const top = Math.min(rect[1], rect[3])
    laid.push({
      text: item.str,
      x: left,
      y: Math.max(0, top),
      width: Math.max(1, Math.abs(rect[2] - rect[0])),
      height: Math.max(1, Math.abs(rect[3] - rect[1])),
      fontName: item.fontName,
      hasEOL: item.hasEOL,
    })
  }
  return laid
}

function ocrBoxToLaidOut(
  items: Array<OcrLine | OcrWord>,
  canvas: HTMLCanvasElement,
  widthPt: number,
  heightPt: number
): LaidOutItem[] {
  const sx = widthPt / canvas.width
  const sy = heightPt / canvas.height
  return items
    .filter((item) => isUsefulOcrLine(item.text, item.confidence) && !isScannerWatermark(item.text))
    .map((item) => ({
      text: cleanOcrText(item.text),
      x: item.x0 * sx,
      y: item.y0 * sy,
      width: Math.max(1, (item.x1 - item.x0) * sx),
      height: Math.max(1, (item.y1 - item.y0) * sy),
    }))
    .filter((item) => item.text)
}

function ocrPageToLines(
  ocrLines: OcrLine[],
  ocrWords: OcrWord[],
  canvas: HTMLCanvasElement,
  widthPt: number,
  heightPt: number
): PageLine[] {
  const fromLines = ocrBoxToLaidOut(ocrLines, canvas, widthPt, heightPt).map((item) => ({
    text: item.text,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fontSize: item.height * 0.8,
    confidence: undefined as number | undefined,
  }))
  const median = medianNumber(fromLines.map((line) => line.height)) || 14
  const sane = fromLines.filter((line) => line.height <= median * 2.2)
  if (sane.length >= 4) return normalizePageLines(sane, widthPt)
  return normalizePageLines(
    groupLaidOutItems(filterOutlierItems(ocrBoxToLaidOut(ocrWords, canvas, widthPt, heightPt))),
    widthPt
  )
}

function runOf(text: string, sizePt: number, bold = false): TextRun {
  return new TextRun({
    text,
    size: Math.round(sizePt * 2),
    bold,
    font: CJK_FONT,
  })
}

function blockToParagraph(block: DocBlock): Paragraph {
  if (block.kind === 'title') {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 280, line: 360 },
      children: [runOf(block.text, 16, true)],
    })
  }
  if (block.kind === 'greeting') {
    return new Paragraph({
      spacing: { before: 80, after: 120, line: 360 },
      children: [runOf(block.text, 12)],
    })
  }
  if (block.kind === 'heading') {
    return new Paragraph({
      spacing: { before: 240, after: 80, line: 360 },
      children: [runOf(block.text, 12, true)],
    })
  }
  if (block.kind === 'list') {
    return new Paragraph({
      indent: { left: 420, hanging: 240 },
      spacing: { after: 80, line: 360 },
      children: [runOf(block.text, 12)],
    })
  }
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: block.firstLineIndent ? { firstLine: 420 } : undefined,
    spacing: { after: 80, line: 360 },
    children: [runOf(block.text, 12)],
  })
}

function inlineImageParagraph(
  image: PageImage,
  name: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType],
  maxWidthPt?: number
): Paragraph {
  const scale = maxWidthPt ? Math.min(1, maxWidthPt / image.width) : 1
  return new Paragraph({
    alignment: align,
    spacing: { before: 80, after: 160 },
    children: [
      new ImageRun({
        type: 'jpg',
        data: image.jpeg,
        transformation: {
          width: pdfPointsToWordPixels(image.width * scale),
          height: pdfPointsToWordPixels(image.height * scale),
        },
        altText: { name, title: name, description: name },
      }),
    ],
  })
}

function pickHeaderImage(images: PageImage[]): PageImage | undefined {
  return images.find((image) => image.y <= 36) || images[0]
}

function pickStampImage(
  images: PageImage[],
  header: PageImage | undefined,
  pageWidth: number,
  pageHeight: number
): PageImage | undefined {
  return images
    .filter((image) => image !== header && isLikelyStamp(image, pageWidth, pageHeight))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0]
}

export async function packPagesToWord(pages: WordPage[]): Promise<ArrayBuffer> {
  if (pages.length < 1) throw new Error('PDF 没有页面')

  const charCount = pages.reduce(
    (sum, page) => sum + page.lines.reduce((n, line) => n + line.text.replace(/\s/g, '').length, 0),
    0
  )
  throwIfNoText(charCount)

  const sections = pages.map((page) => {
    const margin = 56
    const contentWidth = Math.max(200, page.widthPt - margin * 2)
    const images = page.images || []
    const header = pickHeaderImage(images)
    const stamp = pickStampImage(images, header, page.widthPt, page.heightPt)
    const children: Paragraph[] = []

    if (header) {
      children.push(inlineImageParagraph(header, '页眉', AlignmentType.CENTER, contentWidth))
    }
    for (const block of linesToDocBlocks(page.lines, page.widthPt)) {
      children.push(blockToParagraph(block))
    }
    if (stamp) {
      children.push(inlineImageParagraph(stamp, '印章', AlignmentType.RIGHT, Math.min(160, stamp.width)))
    }

    return {
      properties: {
        page: {
          size: {
            width: pdfPointsToTwips(page.widthPt),
            height: pdfPointsToTwips(page.heightPt),
            orientation: PageOrientation.PORTRAIT,
          },
          margin: {
            top: pdfPointsToTwips(48),
            right: pdfPointsToTwips(margin),
            bottom: pdfPointsToTwips(48),
            left: pdfPointsToTwips(margin),
          },
        },
      },
      children,
    }
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: CJK_FONT },
        },
      },
    },
    sections,
  })

  const blob = await Packer.toBlob(doc)
  return uint8ToArrayBuffer(new Uint8Array(await blob.arrayBuffer()))
}

async function extractPageModel(
  page: PDFPageProxy,
  onOcrProgress?: (progress: number) => void
): Promise<WordPage> {
  const { canvas, widthPt, heightPt, viewport } = await renderPageCanvas(page)
  const textContent = await page.getTextContent()
  const pdfItems = textContent.items.flatMap((item) => ('str' in item ? [item] : []))
  const nativeChars = pdfItems.reduce((n, item) => n + item.str.replace(/\s/g, '').length, 0)

  let lines: PageLine[]
  if (nativeChars >= NATIVE_TEXT_MIN_CHARS) {
    lines = groupLaidOutItems(filterOutlierItems(pdfItemsToLaidOut(pdfItems, viewport)))
    lines = markSectionHeadings(normalizePageLines(lines, widthPt))
  } else {
    const ocr = await recognizePage(enhanceForOcr(canvas), onOcrProgress)
    lines = markSectionHeadings(ocrPageToLines(ocr.lines, ocr.words, canvas, widthPt, heightPt))
  }

  const headerBottom = detectHeaderBottom(lines, heightPt)
  const bodyLines = (headerBottom > 24
    ? lines.filter((line) => line.y + line.height / 2 >= headerBottom)
    : lines
  ).filter(
    (line) =>
      isUsefulOcrLine(line.text, line.confidence ?? 100) &&
      !isScannerWatermark(line.text) &&
      !isEdgeStampText(line, widthPt)
  )

  const scaleX = canvas.width / widthPt
  const scaleY = canvas.height / heightPt
  const masked: PixelBox[] = bodyLines.map((line) => ({
    x: line.x * scaleX,
    y: line.y * scaleY,
    w: line.width * scaleX,
    h: line.height * scaleY,
  }))
  if (headerBottom > 24) {
    masked.push({ x: 0, y: 0, w: canvas.width, h: headerBottom * scaleY })
  }

  const images: PageImage[] = []
  if (headerBottom > 24) {
    const headerPx = Math.min(canvas.height, headerBottom * scaleY)
    images.push({
      jpeg: cropCanvasJpeg(canvas, 0, 0, canvas.width, headerPx),
      x: 0,
      y: 0,
      width: widthPt,
      height: headerPx / scaleY,
    })
  }

  for (const box of findGraphicBoxes(canvas, masked, 8)) {
    const image = {
      jpeg: cropCanvasJpeg(canvas, box.x, box.y, box.w, box.h),
      x: box.x / scaleX,
      y: box.y / scaleY,
      width: box.w / scaleX,
      height: box.h / scaleY,
    }
    if (!isLikelyStamp(image, widthPt, heightPt)) continue
    const ink = sampleBoxInk(canvas, box)
    if (!isRedSealSample(ink.redInk, ink.darkInk)) continue
    images.push(image)
  }

  return { widthPt, heightPt, lines: bodyLines, images }
}

export async function pdfToWord(
  inputBuffer: ArrayBuffer,
  onProgress?: ProgressFn
): Promise<ArrayBuffer> {
  if (typeof document === 'undefined') {
    throw new Error('PDF 转 Word 需要在应用窗口中运行，才能按原页保留排版')
  }

  onProgress?.(5, '正在读取 PDF...')

  const pdf = await pdfjsLib.getDocument({ data: copyArrayBuffer(inputBuffer) }).promise
  const totalPages = pdf.numPages
  if (totalPages < 1) throw new Error('PDF 没有页面')

  const pages: WordPage[] = []
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageStart = 5 + ((pageNum - 1) / totalPages) * 85
    onProgress?.(pageStart, `正在识别第 ${pageNum}/${totalPages} 页...`)
    const page = await pdf.getPage(pageNum)
    pages.push(
      await extractPageModel(page, (ocrProgress) => {
        onProgress?.(
          pageStart + ocrProgress * (85 / totalPages),
          `正在识别第 ${pageNum}/${totalPages} 页...`
        )
      })
    )
  }

  onProgress?.(92, '正在生成 Word...')
  const buffer = await packPagesToWord(pages)
  onProgress?.(100, '转换完成')
  return buffer
}
