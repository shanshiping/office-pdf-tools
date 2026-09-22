const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

let mainWindow

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

function resolveAppIcon() {
  const packaged = path.join(process.resourcesPath, 'icon.png')
  const dev = path.join(__dirname, '../resources/icon.png')
  if (fs.existsSync(packaged)) return packaged
  if (fs.existsSync(dev)) return dev
  return undefined
}

function createWindow() {
  const isMac = process.platform === 'darwin'
  console.log('Creating window...')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: resolveAppIcon(),
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    titleBarOverlay: isMac
      ? false
      : {
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      console.error('Load URL failed:', err)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  createWindow()
}).catch((err) => {
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
  await shell.openPath(filePath)
  return true
})

ipcMain.handle('show-item-in-folder', async (_event, filePath) => {
  shell.showItemInFolder(filePath)
  return true
})

ipcMain.handle('print-html-to-pdf', async (_event, { html }) => {
  const tmpPath = path.join(os.tmpdir(), `word-print-${Date.now()}.html`)
  fs.writeFileSync(tmpPath, html, 'utf8')

  const printWindow = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
    },
  })

  try {
    await printWindow.loadFile(tmpPath)
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
    })
    return Array.from(pdfBuffer)
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      // ignore temp cleanup errors
    }
  }
})
