import { useCallback, useState, useRef } from 'react'

export interface PdfFile {
  id: string
  name: string
  size: number
  buffer: ArrayBuffer
  pageCount?: number
}

interface UseFileDropOptions {
  multiple?: boolean
  onFilesAdded: (files: PdfFile[]) => void
}

export function useFileDrop({ multiple = false, onFilesAdded }: UseFileDropOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      )
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

      const pdfFiles: PdfFile[] = await Promise.all(
        files.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          buffer: await readFileBuffer(file),
        }))
      )

      onFilesAdded(multiple ? pdfFiles : [pdfFiles[0]])
    },
    [multiple, onFilesAdded]
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
