const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { createWorker } = require('tesseract.js')
const { fromPath } = require('pdf2pic')
const { PDFDocument } = require('pdf-lib')
const { mkdtempSync } = require('fs')
const { tmpdir } = require('os')

let pdfjsLib
let docx

async function loadESModules() {
  pdfjsLib = (await import('pdfjs-dist')).default
  docx = await import('docx')
}

loadESModules()

let mainWindow

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

function createWindow() {
  const isMac = process.platform === 'darwin'
  console.log('Creating window...')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    titleBarOverlay: isMac ? false : {
      color: '#ffffff',
      symbolColor: '#333333',
      height: 40,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  console.log('Window created, loading URL...')

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully')
  })

  mainWindow.on('closed', () => {
    console.log('Window closed')
    mainWindow = null
  })

  mainWindow.on('close', (e) => {
    console.log('Window close event')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(err => {
      console.error('Load URL failed:', err)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.setMenuBarVisibility(false)
  console.log('Window setup complete')
}

app.whenReady().then(() => {
  console.log('App ready, creating window')
  createWindow()
}).catch(err => {
  console.error('Failed to create window:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('save-file', async (_event, { defaultPath, buffer }) => {
  const ext = path.extname(defaultPath).toLowerCase().slice(1) || 'pdf'
  const filterName = ext === 'docx' ? 'Word Documents' : 'PDF Files'
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [{ name: filterName, extensions: [ext] }],
  })
  if (filePath) {
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return filePath
  }
  return null
})

ipcMain.handle('open-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  if (canceled) return []
  return filePaths.map((fp) => ({
    path: fp,
    name: path.basename(fp),
    buffer: Array.from(fs.readFileSync(fp)),
  }))
})

ipcMain.handle('read-file', async (_event, filePath) => {
  const buffer = fs.readFileSync(filePath)
  return {
    path: filePath,
    name: path.basename(filePath),
    buffer: Array.from(buffer),
  }
})

ipcMain.handle('open-file', async (_event, filePath) => {
  const { shell } = require('electron')
  await shell.openPath(filePath)
  return true
})

ipcMain.handle('show-item-in-folder', async (_event, filePath) => {
  const { shell } = require('electron')
  await shell.showItemInFolder(filePath)
  return true
})

// PDF to Word with OCR - runs in main process
ipcMain.handle('pdf-to-word', async (_event, { inputBuffer }) => {
  console.log('pdf-to-word handler called')
  try {
    // Wait for ES modules to load
    if (!pdfjsLib) await loadESModules()
    
    const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, PageOrientation } = docx

  function copyBuffer(src) {
    const copy = Buffer.alloc(src.length)
    src.forEach((v, i) => copy[i] = v)
    return copy.buffer
  }

  function isBold(fontName) {
    return /bold|black|heavy/i.test(fontName)
  }

  function isItalic(fontName) {
    return /italic|oblique/i.test(fontName)
  }

  function estimateHeadingLevel(fontSize, avgFontSize) {
    if (fontSize > avgFontSize * 1.5) return HeadingLevel.HEADING_1
    if (fontSize > avgFontSize * 1.3) return HeadingLevel.HEADING_2
    if (fontSize > avgFontSize * 1.15) return HeadingLevel.HEADING_3
    return null
  }

  async function ocrPageAsImage(pageBuffer, pageNum, worker) {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'pdf-ocr-'))
    const pdfPath = path.join(tempDir, `page-${pageNum}.pdf`)
    fs.writeFileSync(pdfPath, Buffer.from(pageBuffer))

    const options = {
      density: 300,
      saveFilename: `page-${pageNum}`,
      savePath: tempDir,
      format: 'png',
      width: 2480,
      height: 3508,
    }

    const convert = fromPath(pdfPath, options)
    await convert(pageNum)

    const imagePath = path.join(tempDir, `page-${pageNum}.png`)
    const { data: { text } } = await worker.recognize(imagePath)

    fs.unlinkSync(pdfPath)
    fs.unlinkSync(imagePath)

    return text.trim()
  }

  async function extractSinglePagePdf(inputBuffer, pageNum) {
    const pdf = await PDFDocument.load(inputBuffer)
    const newPdf = await PDFDocument.create()
    const [copiedPage] = await newPdf.copyPages(pdf, [pageNum - 1])
    newPdf.addPage(copiedPage)
    
    const saved = await newPdf.save()
    return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength)
  }

  const pdf = await pdfjsLib.getDocument({ data: copyBuffer(inputBuffer) }).promise
  const totalPages = pdf.numPages

  const allParagraphs = []

  const worker = await createWorker('chi_sim+eng')
  await worker.load()
  await worker.reinitialize('chi_sim+eng')

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const validItems = []
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string' && item.str.trim().length > 0) {
          validItems.push({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height,
            fontName: item.fontName || '',
          })
        }
      }

      let pageText = ''

      if (validItems.length === 0) {
        const pageBuffer = await extractSinglePagePdf(inputBuffer, pageNum)
        pageText = await ocrPageAsImage(pageBuffer, pageNum, worker)
      } else {
        const fontSizes = validItems.map((item) => item.transform[3])
        const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length || 12

        const sortedItems = [...validItems].sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5]
          if (Math.abs(yDiff) > 5) return yDiff
          return a.transform[4] - b.transform[4]
        })

        let lastY = -1
        let currentLine = []

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
      }

      if (pageText) {
        allParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: pageText, size: 24 })],
            spacing: { after: 200, line: 360 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      }

      if (pageNum < totalPages) {
        allParagraphs.push(
          new Paragraph({
            children: [],
            pageBreakBefore: true,
          })
        )
      }
    }
  } finally {
    await worker.terminate()
  }

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
  return await blob.arrayBuffer()
  } catch (err) {
    console.error('pdf-to-word error:', err)
    throw err
  }
})
