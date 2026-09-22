import { useCallback, useState, useRef } from 'react'

export interface PdfFile {
  id: string
  name: string
  size: number
  buffer: ArrayBuffer
  pageCount?: number
  type?: 'pdf' | 'image'
}

export type FileType = 'pdf' | 'image' | 'all'

interface UseFileDropOptions {
  multiple?: boolean
  fileType?: FileType
  onFilesAdded: (files: PdfFile[]) => void
}

const FILE_EXTENSIONS: Record<FileType, string[]> = {
  pdf: ['.pdf'],
  image: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff', '.tif'],
  all: ['.pdf', '.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff', '.tif'],
}

const MIME_TYPES: Record<FileType, string[]> = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/bmp', 'image/gif', 'image/webp', 'image/tiff'],
  all: ['application/pdf', 'image/jpeg', 'image/png', 'image/bmp', 'image/gif', 'image/webp', 'image/tiff'],
}

export function isFileType(file: { name: string; type: string }, fileType: FileType): boolean {
  const extensions = FILE_EXTENSIONS[fileType]
  const mimeTypes = MIME_TYPES[fileType]
  
  const hasValidExtension = extensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  )
  const hasValidMimeType = mimeTypes.includes(file.type)
  
  return hasValidExtension || hasValidMimeType
}

export function getFileType(file: { name: string; type: string }): 'pdf' | 'image' {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return 'pdf'
  }
  return 'image'
}

export function useFileDrop({ multiple = false, fileType = 'pdf', onFilesAdded }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(f => isFileType(f, fileType))
      if (files.length === 0) return

      const readFileBuffer = (file: File): Promise<ArrayBuffer> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const src = reader.result as ArrayBuffer
            const copy = new ArrayBuffer(src.byteLength)
            new Uint8Array(copy).set(new Uint8Array(src))
            resolve(copy)
          }
          reader.onerror = () => reject(reader.error)
          reader.readAsArrayBuffer(file)
        })
      }

      const processedFiles: PdfFile[] = await Promise.all(
        files.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          buffer: await readFileBuffer(file),
          type: getFileType(file),
        }))
      )

      onFilesAdded(multiple ? processedFiles : [processedFiles[0]])
    },
    [multiple, fileType, onFilesAdded]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  return {
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    processFiles,
  }
}
