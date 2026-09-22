import { describe, expect, it } from 'vitest'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import * as pdfjsLib from 'pdfjs-dist'
import { getPageCount } from './pdf-utils'
import { makePdf } from './test-pdf'

pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
).href

describe('pdf-utils getPageCount', () => {
  it('counts pages through pdf.js', async () => {
    expect(await getPageCount(await makePdf('Utils', 3))).toBe(3)
  })
})
