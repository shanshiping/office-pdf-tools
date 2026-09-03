const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFiles: () => ipcRenderer.invoke('open-files'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  pdfToWord: (data) => ipcRenderer.invoke('pdf-to-word', data),
})
