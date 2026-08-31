const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

function createWindow() {
  const isMac = process.platform === 'darwin'

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

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('save-file', async (_event, { defaultPath, buffer }) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
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
