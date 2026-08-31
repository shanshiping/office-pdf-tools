import * as pdfjsLib from 'pdfjs-dist'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  PageOrientation,
} from 'docx'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

function isBold(fontName: string): boolean {
  return /bold|black|heavy/i.test(fontName)
}

function isItalic(fontName: string): boolean {
  return /italic|oblique/i.test(fontName)
}

function estimateHeadingLevel(fontSize: number, avgFontSize: number): typeof HeadingLevel[keyof typeof HeadingLevel] | null {
  if (fontSize > avgFontSize * 1.5) return HeadingLevel.HEADING_1
  if (fontSize > avgFontSize * 1.3) return HeadingLevel.HEADING_2
  if (fontSize > avgFontSize * 1.15) return HeadingLevel.HEADING_3
  return null
}

export async function pdfToWord(
  inputBuffer: ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5)

  const pdf = await pdfjsLib.getDocument({ data: copyBuffer(inputBuffer) }).promise
  const totalPages = pdf.numPages

  const allParagraphs: Paragraph[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()

    const validItems: { str: string; transform: number[]; width: number; height: number; fontName: string }[] = []
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string' && item.str.trim().length > 0) {
        validItems.push({
          str: item.str,
          transform: item.transform,
          width: item.width,
          height: item.height,
          fontName: (item as { fontName?: string }).fontName || '',
        })
      }
    }

    if (validItems.length === 0) continue

    const fontSizes = validItems.map((item) => item.transform[3])
    const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length || 12

    const sortedItems = [...validItems].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5]
      if (Math.abs(yDiff) > 5) return yDiff
      return a.transform[4] - b.transform[4]
    })

    let lastY = -1
    let currentLine: typeof validItems = []

    const flushLine = () => {
      if (currentLine.length === 0) return
      currentLine.sort((a, b) => a.transform[4] - b.transform[4])
      const lineText = currentLine.map((item) => item.str).join(' ')
      const representative = currentLine.reduce((a, b) =>
        a.transform[3] > b.transform[3] ? a : b
      )

      const headingLevel = estimateHeadingLevel(representative.transform[3], avgFontSize)

      const textRuns = currentLine.map(
        (item) =>
          new TextRun({
            text: item.str,
            size: Math.round(item.transform[3] * 2),
            bold: isBold(item.fontName),
            italics: isItalic(item.fontName),
          })
      )

      if (headingLevel) {
        allParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: lineText,
                size: Math.round(representative.transform[3] * 2),
                bold: true,
              }),
            ],
            heading: headingLevel,
            spacing: { after: 200 },
          })
        )
      } else {
        allParagraphs.push(
          new Paragraph({
            children: textRuns,
            spacing: { after: 120, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      }
      currentLine = []
    }

    for (const item of sortedItems) {
      const currentY = item.transform[5]
      if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
        flushLine()
      }
      currentLine.push(item)
      lastY = currentY
    }
    flushLine()

    if (pageNum < totalPages) {
      allParagraphs.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        })
      )
    }

    onProgress?.(5 + ((pageNum / totalPages) * 80))
  }

  onProgress?.(90)

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
          },
        },
        children: allParagraphs,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  onProgress?.(100)
  return await blob.arrayBuffer()
}
