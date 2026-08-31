const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFiles: () => ipcRenderer.invoke('open-files'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
})
