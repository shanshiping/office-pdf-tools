import { useState, useCallback } from 'react'
import { FileText, Download } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileList from '../components/FileList'
import ProgressBar from '../components/ProgressBar'
import { wordToPdf } from '../lib/word-to-pdf'
import { copyArrayBuffer } from '../lib/bytes'

interface WordFile {
  id: string
  name: string
  size: number
  buffer: ArrayBuffer
}

export default function WordToPdf() {
  const [file, setFile] = useState<WordFile | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const addFile = useCallback((files: FileList | File[]) => {
    const docFiles = Array.from(files).filter(
      (f) =>
        f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        f.name.toLowerCase().endsWith('.docx')
    )
    if (docFiles.length === 0) return

    const file = docFiles[0]
    const reader = new FileReader()
    reader.onload = () => {
      setFile({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        buffer: copyArrayBuffer(reader.result as ArrayBuffer),
      })
      setDone(false)
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFile(e.dataTransfer.files)
  }

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFile(e.target.files)
      e.target.value = ''
    }
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
      const result = await wordToPdf(file.buffer, file.name, setProgress)
      const filename = file.name.replace(/\.docx$/i, '') + '.pdf'

      if (window.electronAPI) {
        const uint8Array = new Uint8Array(result)
        await window.electronAPI.saveFile({ defaultPath: filename, buffer: Array.from(uint8Array) })
      } else {
        const blob = new Blob([result], { type: 'application/pdf' })
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

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="Word 转 PDF" description="将 Word 文档转换为 PDF 文件，桌面版保留中文排版" color="#8E44AD" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('word-input')?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all
              ${dragOver ? 'border-purple-400 bg-purple-50' : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'}
            `}
          >
            <input
              id="word-input"
              type="file"
              accept=".docx"
              onChange={handleBrowse}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center">
                <FileText size={32} className="text-purple-500" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">拖拽 Word 文档到这里</p>
                <p className="text-sm text-gray-400 mt-1">支持 .docx 格式</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <FileList files={[file]} onRemove={removeFile} />

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在转换..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">转换完成！文件已保存</p>
                {!window.electronAPI && (
                  <p className="text-xs text-green-500 mt-2">浏览器模式使用系统字体绘制，桌面版排版更完整</p>
                )}
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={!file || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${file && !processing
                  ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Download size={20} />
              {processing ? '转换中...' : '转换为 PDF'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
