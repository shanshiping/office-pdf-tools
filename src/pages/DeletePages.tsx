import { useState, useCallback } from 'react'
import { Trash2, Eye, EyeOff, Check, X } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileUploader from '../components/FileUploader'
import ProgressBar from '../components/ProgressBar'
import { useFileDrop, type PdfFile } from '../hooks/useFileDrop'
import { deletePages } from '../lib/pdf-delete'
import { getPageCount, renderAllPages } from '../lib/pdf-utils'

export default function DeletePages() {
  const [file, setFile] = useState<PdfFile | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [loadingPages, setLoadingPages] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)

  const addFile = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const f = newFiles[0]
      const count = await getPageCount(f.buffer)
      setFile(f)
      setPageCount(count)
      setSelectedPages(new Set())
      setDone(false)
      setLoadingPages(true)

      try {
        const images = await renderAllPages(f.buffer, 0.4)
        setPageImages(images)
      } catch (err) {
        console.error('Failed to render pages:', err)
      } finally {
        setLoadingPages(false)
      }
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

  const togglePage = (index: number, shiftKey: boolean) => {
    setSelectedPages((prev) => {
      const next = new Set(prev)

      if (shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
        const start = Math.min(lastClickedIndex, index)
        const end = Math.max(lastClickedIndex, index)
        for (let i = start; i <= end; i++) {
          next.add(i)
        }
      } else {
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
      }

      return next
    })
    setLastClickedIndex(index)
    setDone(false)
  }

  const selectAll = () => {
    setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i)))
  }

  const deselectAll = () => {
    setSelectedPages(new Set())
  }

  const selectRange = () => {
    const input = prompt('输入页码范围，例如: 1-5 或 1,3,5')
    if (!input) return
    const pages = new Set<number>()
    const parts = input.split(',')
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(Number)
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(pageCount, end); i++) {
            pages.add(i - 1)
          }
        }
      } else {
        const num = Number(trimmed)
        if (!isNaN(num) && num >= 1 && num <= pageCount) {
          pages.add(num - 1)
        }
      }
    }
    setSelectedPages((prev) => new Set([...prev, ...pages]))
  }

  const selectOdd = () => {
    const pages = new Set<number>()
    for (let i = 0; i < pageCount; i += 2) {
      pages.add(i)
    }
    setSelectedPages(pages)
  }

  const selectEven = () => {
    const pages = new Set<number>()
    for (let i = 1; i < pageCount; i += 2) {
      pages.add(i)
    }
    setSelectedPages(pages)
  }

  const removeFile = () => {
    setFile(null)
    setPageCount(0)
    setPageImages([])
    setSelectedPages(new Set())
    setDone(false)
    setShowConfirm(false)
  }

  const handleConfirmDelete = async () => {
    if (!file || selectedPages.size === 0) return
    setShowConfirm(false)
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const result = await deletePages(file.buffer, Array.from(selectedPages), setProgress)

      const filename = `deleted_pages_${file.name}`

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
      console.error('Delete pages failed:', err)
      alert('处理失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcessing(false)
    }
  }

  const keptCount = pageCount - selectedPages.size

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="删除页面" description="从 PDF 中移除不需要的页面" color="#3498DB" />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!file ? (
          <FileUploader
            isDragging={isDragging}
            onFiles={addFile}
            onBrowse={handleBrowse}
            dragHandlers={{ handleDragEnter, handleDragLeave, handleDragOver, handleDrop }}
            color="#3498DB"
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{file.name}</h2>
                <p className="text-sm text-gray-400">
                  共 {pageCount} 页 · 已选 <span className="text-red-500 font-medium">{selectedPages.size}</span> 页删除 · 保留 <span className="text-green-600 font-medium">{keptCount}</span> 页
                </p>
              </div>
              <button
                onClick={removeFile}
                className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                重新选择
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 mr-1">批量选择:</span>
                <button onClick={selectAll} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  全选
                </button>
                <button onClick={deselectAll} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  取消全选
                </button>
                <button onClick={selectRange} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  指定范围
                </button>
                <button onClick={selectOdd} className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  奇数页
                </button>
                <button onClick={selectEven} className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  偶数页
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">点击选择单页，按住 Shift 可批量选择连续页</p>
            </div>

            {loadingPages ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-400">正在加载页面预览...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {pageImages.map((src, index) => {
                  const isSelected = selectedPages.has(index)
                  return (
                    <button
                      key={index}
                      onClick={(e) => togglePage(index, e.shiftKey)}
                      className={`
                        relative group rounded-xl overflow-hidden border-2 transition-all duration-150
                        ${isSelected
                          ? 'border-red-400 ring-2 ring-red-200 shadow-md'
                          : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
                        }
                      `}
                    >
                      <img
                        src={src}
                        alt={`第 ${index + 1} 页`}
                        className={`
                          w-full aspect-[1/1.414] object-cover object-top bg-white
                          ${isSelected ? 'opacity-50 grayscale' : ''}
                        `}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                            <Trash2 size={18} className="text-white" />
                          </div>
                        </div>
                      )}
                      <div className={`
                        absolute bottom-0 left-0 right-0 p-2
                        ${isSelected
                          ? 'bg-gradient-to-t from-red-500/80 to-transparent'
                          : 'bg-gradient-to-t from-black/50 to-transparent'
                        }
                      `}>
                        <span className="text-xs font-medium text-white">第 {index + 1} 页</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在删除页面..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">
                  处理完成！已删除 {selectedPages.size} 页，文件已保存
                </p>
              </div>
            )}

            <button
              onClick={() => setShowConfirm(true)}
              disabled={selectedPages.size === 0 || processing || selectedPages.size === pageCount}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${selectedPages.size > 0 && !processing && selectedPages.size < pageCount
                  ? 'bg-brand-red text-white hover:bg-red-500 shadow-lg shadow-red-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Trash2 size={20} />
              {processing ? '处理中...' : `删除 ${selectedPages.size} 页`}
            </button>
          </div>
        )}
      </main>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">确认删除页面</h3>
            <p className="text-sm text-gray-500 mb-4">
              即将从 <span className="font-medium text-gray-700">{file?.name}</span> 中删除以下页面：
            </p>

            <div className="bg-gray-50 rounded-xl p-3 mb-4 max-h-32 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedPages).sort((a, b) => a - b).map((idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-lg"
                  >
                    第 {idx + 1} 页
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <span>删除后将保留 <strong className="text-green-600">{keptCount}</strong> 页</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
