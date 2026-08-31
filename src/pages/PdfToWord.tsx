import { useState, useCallback } from 'react'
import { FileText, Download } from 'lucide-react'
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

  const addFile = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const f = newFiles[0]
      const pageCount = await getPageCount(f.buffer)
      setFile({ ...f, pageCount })
      setDone(false)
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
  }

  const handleConvert = async () => {
    if (!file) return
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const result = await pdfToWord(file.buffer, setProgress)
      const filename = file.name.replace(/\.pdf$/i, '') + '.docx'

      if (window.electronAPI) {
        const uint8Array = new Uint8Array(result)
        await window.electronAPI.saveFile({ defaultPath: filename, buffer: Array.from(uint8Array) })
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
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm text-blue-600">
                <strong>高级模式:</strong> 保留原文档的字体样式、加粗、斜体和标题层级结构
              </p>
            </div>

            <FileList files={[file]} onRemove={removeFile} />

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在识别转换..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">转换完成！文件已保存</p>
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
