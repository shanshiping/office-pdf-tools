import { useState, useCallback } from 'react'
import { ArrowUpDown, Download, Plus } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileUploader from '../components/FileUploader'
import FileList from '../components/FileList'
import ProgressBar from '../components/ProgressBar'
import { useFileDrop, type PdfFile } from '../hooks/useFileDrop'
import { mergePdf } from '../lib/pdf-merge'
import { getPageCount } from '../lib/pdf-utils'

export default function Merge() {
  const [files, setFiles] = useState<PdfFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  const addFiles = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const withPageCount = await Promise.all(
        newFiles.map(async (f) => ({
          ...f,
          pageCount: await getPageCount(f.buffer),
        }))
      )
      setFiles((prev) => [...prev, ...withPageCount])
      setDone(false)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      alert('无法读取 PDF 文件，请确认文件未损坏')
    }
  }, [])

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, processFiles } =
    useFileDrop({ multiple: true, fileType: 'pdf', onFilesAdded: addFiles })

  const handleBrowse = (fileList: FileList) => {
    processFiles(fileList)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setDone(false)
  }

  const handleReorder = (fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setDone(false)
  }

  const handleMerge = async () => {
    if (files.length < 2) return
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const result = await mergePdf(
        files.map((f) => ({ buffer: f.buffer, name: f.name })),
        setProgress
      )

      const filename = `merged_${files.length}_files.pdf`

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
      console.error('Merge failed:', err)
      alert('合并失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcessing(false)
    }
  }

  const handleAddMore = () => {
    document.querySelector<HTMLInputElement>('.file-input-merge')?.click()
  }

  const totalPages = files.reduce((sum, f) => sum + (f.pageCount || 0), 0)

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="合并 PDF" description="将多个 PDF 文件合并为一个" color="#EE6C4D" />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {files.length === 0 ? (
          <FileUploader
            multiple
            isDragging={isDragging}
            onFiles={addFiles}
            onBrowse={handleBrowse}
            dragHandlers={{ handleDragEnter, handleDragLeave, handleDragOver, handleDrop }}
            color="#EE6C4D"
            accept=".pdf"
            inputClassName="file-input-merge"
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {files.length} 个文件 · {totalPages} 页
                </h2>
                <p className="text-sm text-gray-400">拖拽文件可调整顺序</p>
              </div>
              <button
                onClick={handleAddMore}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-orange bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
              >
                <Plus size={16} />
                添加文件
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  className="file-input-merge hidden"
                  onChange={(e) => {
                    if (e.target.files) processFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </button>
            </div>

            <FileList files={files} onRemove={removeFile} onReorder={handleReorder} showOrder />

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在合并..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">合并完成！文件已保存</p>
              </div>
            )}

            <button
              onClick={handleMerge}
              disabled={files.length < 2 || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${files.length >= 2 && !processing
                  ? 'bg-brand-orange text-white hover:bg-orange-500 shadow-lg shadow-orange-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <ArrowUpDown size={20} />
              {processing ? '合并中...' : '开始合并'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
