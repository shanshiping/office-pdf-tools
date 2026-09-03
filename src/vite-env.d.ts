/// <reference types="vite/client" />

interface ElectronAPI {
  saveFile: (data: { defaultPath: string; buffer: number[] }) => Promise<string | null>
  openFiles: () => Promise<Array<{ path: string; name: string; buffer: number[] }>>
  readFile: (filePath: string) => Promise<{ path: string; name: string; buffer: number[] }>
  openFile: (filePath: string) => Promise<boolean>
  showItemInFolder: (filePath: string) => Promise<boolean>
  pdfToWord: (data: { inputBuffer: number[] }) => Promise<ArrayBuffer>
}

interface Window {
  electronAPI: ElectronAPI
}