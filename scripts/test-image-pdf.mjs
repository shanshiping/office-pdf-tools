import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'
import { pdfToWord, EMPTY_PDF_TEXT_ERROR } from '../src/lib/pdf-to-word.ts'

const pdfPath = process.argv[2]
if (!pdfPath) {
  console.error('Usage: node scripts/test-image-pdf.mjs <file.pdf>')
  process.exit(1)
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
).href

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'tmp-ocr-test')
fs.mkdirSync(outDir, { recursive: true })

function extractJpegs(buf) {
  const jpegs = []
  let i = 0
  while (i < buf.length - 1) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd8) {
      let j = i + 2
      while (j < buf.length - 1) {
        if (buf[j] === 0xff && buf[j + 1] === 0xd9) {
          jpegs.push(buf.subarray(i, j + 2))
          i = j + 2
          break
        }
        j++
      }
      if (j >= buf.length - 1) break
    } else i++
  }
  return jpegs
}

const absPdf = path.resolve(pdfPath)
const bytes = fs.readFileSync(absPdf)
console.log('file', absPdf)
console.log('size', bytes.length)

const copy = Uint8Array.from(bytes)
const pdf = await pdfjsLib.getDocument({ data: copy.slice() }).promise
console.log('pages', pdf.numPages)

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum)
  const text = await page.getTextContent()
  const strings = text.items
    .filter((item) => 'str' in item && item.str.trim())
    .map((item) => item.str)
  console.log(`page ${pageNum} text items:`, strings.length, strings.slice(0, 8))
}

const jpegs = extractJpegs(bytes)
console.log('embedded jpeg count', jpegs.length, 'sizes', jpegs.map((j) => j.length))
const imagePaths = jpegs.map((jpeg, idx) => {
  const raw = path.join(outDir, `page-${idx + 1}.jpg`)
  const rotated = path.join(outDir, `page-${idx + 1}-rot.jpg`)
  fs.writeFileSync(raw, jpeg)
  return fs.existsSync(rotated) ? rotated : raw
})

const langPath = path.join(root, 'public/tessdata')
console.log('starting tesseract...', langPath)
const worker = await createWorker('chi_sim+eng', 1, {
  langPath,
  gzip: true,
  cacheMethod: 'none',
  logger: (m) => {
    if (m.status === 'recognizing text') {
      process.stdout.write(`\r  ocr ${Math.round((m.progress || 0) * 100)}%   `)
    }
  },
})

const ocrTexts = []
try {
  if (imagePaths.length === 0) {
    throw new Error('PDF 里没抠出 JPEG，无法在 Node 里渲染页')
  }
  for (let i = 0; i < imagePaths.length; i++) {
    console.log(`\nOCR image ${i + 1}/${imagePaths.length}: ${imagePaths[i]}`)
    const { data } = await worker.recognize(imagePaths[i], { rotateAuto: true })
    const text = (data.text || '').trim()
    ocrTexts.push(text)
    console.log('\n--- text preview ---')
    console.log(text.slice(0, 800) || '(empty)')
    console.log('--- chars ---', text.replace(/\s/g, '').length)
  }
} finally {
  await worker.terminate()
}

let imageIndex = 0
const result = await pdfToWord(Uint8Array.from(bytes).buffer, (p, label) => {
  if (p === 5 || p === 90 || p === 100) console.log(`progress ${Math.round(p)} ${label || ''}`)
}, async () => {
  const text = ocrTexts[Math.min(imageIndex, ocrTexts.length - 1)] || ''
  imageIndex++
  return text
})

const outDocx = path.join(outDir, 'converted.docx')
fs.writeFileSync(outDocx, Buffer.from(result))
console.log('\nWrote', outDocx, 'bytes', result.byteLength)
if (result.byteLength < 500) {
  console.error('FAIL: docx too small')
  process.exit(1)
}
const joined = ocrTexts.join('')
if (!joined.replace(/\s/g, '').length) {
  console.error('FAIL:', EMPTY_PDF_TEXT_ERROR)
  process.exit(1)
}
console.log('PASS: image PDF converted to Word with OCR text')
