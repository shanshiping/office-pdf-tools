import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
).href

const bytes = fs.readFileSync(process.argv[2])
const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise
console.log('pages', pdf.numPages)
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i)
  const v = page.getViewport({ scale: 1 })
  console.log({
    page: i,
    rotate: page.rotate,
    width: Math.round(v.width),
    height: Math.round(v.height),
  })
}
