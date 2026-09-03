import { useState, useCallback } from 'react'
import { FileText, Download, FolderOpen, File } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileUploader from '../components/FileUploader'
import FileList from '../components/FileList'
import ProgressBar from '../components/ProgressBar'
import { useFileDrop, type PdfFile } from '../hooks/useFileDrop'
import { pdfToWord } from '../lib/pdf-to-word'
import { getPageCount } from '../lib/pdf-utils'

export default function PdfToWord() {
  const [file, setFile] = useState<PdfFile | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null)

  const addFile = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const f = newFiles[0]
      const pageCount = await getPageCount(f.buffer)
      setFile({ ...f, pageCount })
      setDone(false)
      setSavedFilePath(null)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      alert('无法读取 PDF 文件，请确认文件未损坏')
    }
  }, [])

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, processFiles } =
    useFileDrop({ multiple: false, onFilesAdded: addFile })

  const handleBrowse = (fileList: FileList) => {
    processFiles(fileList)
  }

  const removeFile = () => {
    setFile(null)
    setDone(false)
    setSavedFilePath(null)
  }

  const handleOpenFile = async () => {
    if (savedFilePath && window.electronAPI) {
      await window.electronAPI.openFile(savedFilePath)
    }
  }

  const handleOpenFolder = async () => {
    if (savedFilePath && window.electronAPI) {
      await window.electronAPI.showItemInFolder(savedFilePath)
    }
  }

  const handleConvert = async () => {
    if (!file) return
    setProcessing(true)
    setProgress(0)
    setDone(false)
    setSavedFilePath(null)

    try {
      let result: ArrayBuffer

      if (window.electronAPI?.pdfToWord) {
        // Use main process with OCR support
        const uint8Array = new Uint8Array(file.buffer)
        result = await window.electronAPI.pdfToWord({ inputBuffer: Array.from(uint8Array) })
      } else {
        // Fallback to browser version (no OCR)
        result = await pdfToWord(file.buffer, setProgress)
      }

      const filename = file.name.replace(/\.pdf$/i, '') + '.docx'

      let finalPath: string | null = null

      if (window.electronAPI) {
        const uint8Array = new Uint8Array(result)
        finalPath = await window.electronAPI.saveFile({ defaultPath: filename, buffer: Array.from(uint8Array) })
        if (finalPath) {
          setSavedFilePath(finalPath)
        }
      } else {
        const blob = new Blob([result], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }

      setDone(true)
    } catch (err) {
      console.error('Convert failed:', err)
      alert('转换失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="PDF 转 Word" description="将 PDF 文件转换为可编辑的 Word 文档" color="#2980B9" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {!file ? (
          <FileUploader
            isDragging={isDragging}
            onFiles={addFile}
            onBrowse={handleBrowse}
            dragHandlers={{ handleDragEnter, handleDragLeave, handleDragOver, handleDrop }}
            color="#2980B9"
            inputClassName="file-input-pdf-to-word"
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm text-blue-600">
                <strong>高级模式:</strong> 保留原文档的字体样式、加粗、斜体和标题层级结构，无文本层时自动 OCR 识别
              </p>
            </div>

            <FileList files={[file]} onRemove={removeFile} />

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在识别转换..." />
              </div>
            )}

            {done && savedFilePath && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <p className="text-green-600 font-medium mb-4">转换完成！文件已保存</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleOpenFile}
                    className="px-5 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <File size={18} />
                    打开文件
                  </button>
                  <button
                    onClick={handleOpenFolder}
                    className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <FolderOpen size={18} />
                    打开所在文件夹
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={!file || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${file && !processing
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <FileText size={20} />
              {processing ? '转换中...' : '转换为 Word'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
