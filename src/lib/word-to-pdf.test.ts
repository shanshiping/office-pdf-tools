import { describe, expect, it } from 'vitest'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import mammoth from 'mammoth'
import { uint8ToArrayBuffer } from './bytes'
import { wordToPdf, wrapTextByWidth, wrapWordHtml } from './word-to-pdf'

describe('wrapWordHtml', () => {
  it('embeds CJK-capable system fonts', () => {
    const html = wrapWordHtml('<p>你好</p>')
    expect(html).toContain('Microsoft YaHei')
    expect(html).toContain('PingFang SC')
    expect(html).toContain('<p>你好</p>')
  })
})

describe('wrapTextByWidth', () => {
  const ctx = {
    measureText: (text: string) => ({ width: [...text].length * 10 }),
  } as CanvasRenderingContext2D

  it('wraps a long line to the given width', () => {
    expect(wrapTextByWidth(ctx, 'abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('keeps paragraph breaks', () => {
    expect(wrapTextByWidth(ctx, 'ab\n\ncd', 100)).toEqual(['ab', '', 'cd'])
  })
})

describe('wordToPdf', () => {
  it('reads a docx through mammoth and then needs a browser canvas in Node', async () => {
    const doc = new Document({
      sections: [
        {
          children: [new Paragraph({ children: [new TextRun('Hello PDF')] })],
        },
      ],
    })
    const blob = await Packer.toBlob(doc)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const buffer = uint8ToArrayBuffer(bytes)
    const html = (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value
    expect(html).toContain('Hello PDF')
    await expect(wordToPdf(buffer, 'hello.docx')).rejects.toThrow()
  })
})
