import { useState, useCallback } from 'react'
import { Download, FileDown } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileUploader from '../components/FileUploader'
import FileList from '../components/FileList'
import ProgressBar from '../components/ProgressBar'
import { useFileDrop, type PdfFile } from '../hooks/useFileDrop'
import { compressPdf, getCompressionLabel } from '../lib/pdf-compress'
import { getPageCount } from '../lib/pdf-utils'

type CompressionLevel = 'low' | 'medium' | 'high'

export default function Compress() {
  const [files, setFiles] = useState<PdfFile[]>([])
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [originalSize, setOriginalSize] = useState(0)
  const [compressedSize, setCompressedSize] = useState(0)

  const addFiles = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const file = newFiles[0]
      const pageCount = await getPageCount(file.buffer)
      setFiles([{ ...file, pageCount }])
      setOriginalSize(file.size)
      setDone(false)
      setCompressedSize(0)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      alert('无法读取 PDF 文件，请确认文件未损坏')
    }
  }, [])

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, processFiles } =
    useFileDrop({ multiple: false, onFilesAdded: addFiles })

  const handleBrowse = (fileList: FileList) => {
    processFiles(fileList)
  }

  const removeFile = () => {
    setFiles([])
    setDone(false)
    setCompressedSize(0)
  }

  const handleCompress = async () => {
    if (files.length === 0) return
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const result = await compressPdf(files[0].buffer, compressionLevel, setProgress)
      setCompressedSize(result.byteLength)

      const filename = `compressed_${files[0].name}`

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
      console.error('Compress failed:', err)
      alert('压缩失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcessing(false)
    }
  }

  const compressionOptions: { value: CompressionLevel; label: string; desc: string }[] = [
    { value: 'low', label: '低压缩', desc: '保持高质量' },
    { value: 'medium', label: '中等压缩', desc: '质量与体积均衡' },
    { value: 'high', label: '高压缩', desc: '最小文件体积' },
  ]

  const reduction = originalSize > 0 && compressedSize > 0
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : 0

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="压缩 PDF" description="减小 PDF 文件体积" color="#8FBC5D" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {files.length === 0 ? (
          <FileUploader
            isDragging={isDragging}
            onFiles={addFiles}
            onBrowse={handleBrowse}
            dragHandlers={{ handleDragEnter, handleDragLeave, handleDragOver, handleDrop }}
            color="#8FBC5D"
            accept=".pdf"
            inputClassName="file-input-compress"
          />
        ) : (
          <div className="space-y-6">
            <FileList files={files} onRemove={removeFile} />

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">压缩级别</h3>
              <div className="grid grid-cols-3 gap-3">
                {compressionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCompressionLevel(opt.value)}
                    className={`
                      p-4 rounded-xl border-2 transition-all text-left
                      ${compressionLevel === opt.value
                        ? 'border-brand-green bg-green-50'
                        : 'border-gray-100 hover:border-gray-200'
                      }
                    `}
                  >
                    <p className="text-sm font-semibold text-gray-700">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在压缩..." />
              </div>
            )}

            {done && compressedSize > 0 && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <FileDown size={24} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-green-600 font-semibold">压缩完成！文件已保存</p>
                    <p className="text-sm text-green-500 mt-1">
                      文件体积减小 {reduction}% · 原始 {(originalSize / 1024 / 1024).toFixed(1)}MB → 压缩后 {(compressedSize / 1024 / 1024).toFixed(1)}MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleCompress}
              disabled={files.length === 0 || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${files.length > 0 && !processing
                  ? 'bg-brand-green text-white hover:bg-green-500 shadow-lg shadow-green-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Download size={20} />
              {processing ? '压缩中...' : '开始压缩'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
