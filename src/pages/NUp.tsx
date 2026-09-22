import { useState, useCallback } from 'react'
import { Download, Plus, RotateCw, Grid, Settings, FileImage, File, Eye, EyeOff } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import FileUploader from '../components/FileUploader'
import ProgressBar from '../components/ProgressBar'
import LayoutPreview from '../components/LayoutPreview'
import { useFileDrop, type PdfFile } from '../hooks/useFileDrop'
import {
  createNUpPdf,
  calculateLayout,
  getPdfPageSize,
  sheetCount,
  PRESET_LAYOUTS,
  type PresetLayout,
  type PageWithRotation,
} from '../lib/pdf-n-up'
import { imageBufferToPdf } from '../lib/image-to-pdf'
import { getPageCount } from '../lib/pdf-utils'

interface FileWithMeta extends PdfFile {
  pageCount: number
  rotation: number
  pageSize?: { width: number; height: number }
  fileType: 'pdf' | 'image'
}

export default function NUp() {
  const [files, setFiles] = useState<FileWithMeta[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [layoutPreset, setLayoutPreset] = useState<PresetLayout | 'custom'>('2x2')
  const [customRows, setCustomRows] = useState(2)
  const [customCols, setCustomCols] = useState(2)
  const [margin, setMargin] = useState(20)
  const [spacing, setSpacing] = useState(5)
  const [showPreview, setShowPreview] = useState(true)

  const rows = layoutPreset === 'custom' ? customRows : PRESET_LAYOUTS[layoutPreset].rows
  const cols = layoutPreset === 'custom' ? customCols : PRESET_LAYOUTS[layoutPreset].cols

  const layoutInfo = calculateLayout({ rows, cols, margin, spacing })

  const addFiles = useCallback(async (newFiles: PdfFile[]) => {
    try {
      const withMeta = await Promise.all(
        newFiles.map(async (f) => {
          const fileType = f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
          let buffer = f.buffer
          let pageCount = 1
          let pageSize = { width: 0, height: 0 }

          if (fileType === 'image') {
            buffer = await imageBufferToPdf(f.buffer, f.name)
            pageSize = await getPdfPageSize(buffer)
          } else {
            pageCount = await getPageCount(f.buffer)
            pageSize = await getPdfPageSize(f.buffer)
          }

          return {
            ...f,
            buffer,
            pageCount,
            rotation: 0,
            pageSize,
            fileType,
          }
        })
      )
      setFiles((prev) => [...prev, ...withMeta])
      setDone(false)
    } catch (err) {
      console.error('Failed to load file:', err)
      alert('无法读取文件，请确认文件未损坏')
    }
  }, [])

  const { isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, processFiles } =
    useFileDrop({ multiple: true, fileType: 'all', onFilesAdded: addFiles })

  const handleBrowse = (fileList: FileList) => {
    processFiles(fileList)
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setDone(false)
  }

  const handleRotate = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f))
    )
    setDone(false)
  }

  const handleAddMore = () => {
    document.querySelector<HTMLInputElement>('.file-input-n-up')?.click()
  }

  const handleMerge = async () => {
    if (files.length === 0) return
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const pages: PageWithRotation[] = files.map((f) => ({
        buffer: f.buffer,
        name: f.name,
        rotation: f.rotation,
      }))

      const { buffer: result, failed } = await createNUpPdf(
        pages,
        { rows, cols, margin, spacing },
        setProgress
      )

      if (failed.length > 0) {
        alert(`部分文件未能加入：${failed.join('、')}`)
      }

      const filename = `invoices_${rows}x${cols}_merged.pdf`

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
      console.error('N-up merge failed:', err)
      alert('合并失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcessing(false)
    }
  }

  const totalPages = files.reduce((sum, f) => sum + f.pageCount, 0)
  const sheetsNeeded = sheetCount(totalPages, layoutInfo.totalCells)

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <ToolHeader title="发票合并到A4纸" description="将多张发票排列到A4纸上，方便打印" color="#9B59B6" />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {files.length === 0 ? (
          <FileUploader
            multiple
            isDragging={isDragging}
            onFiles={addFiles}
            onBrowse={handleBrowse}
            dragHandlers={{ handleDragEnter, handleDragLeave, handleDragOver, handleDrop }}
            color="#9B59B6"
            accept=".pdf,.jpg,.jpeg,.png,.bmp,.gif,.webp,.tif,.tiff"
            inputClassName="file-input-n-up"
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {files.length} 个文件 · {totalPages} 页
                  </h2>
                  <p className="text-sm text-gray-400">
                    预计需要 {sheetsNeeded} 张A4纸
                  </p>
                </div>
                <button
                  onClick={handleAddMore}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors"
                >
                  <Plus size={16} />
                  添加文件
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.bmp,.gif,.webp,.tif,.tiff"
                    multiple
                    className="file-input-n-up hidden"
                    onChange={(e) => {
                      if (e.target.files) processFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
                  >
                    <span className="text-xs font-medium text-gray-400 w-6 text-center">
                      {index + 1}
                    </span>
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      {file.fileType === 'image' ? (
                        <FileImage size={20} className="text-purple-500" />
                      ) : (
                        <File size={20} className="text-purple-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {file.fileType === 'image' ? '图片' : 'PDF'} · 旋转: {file.rotation}°
                        {file.pageSize && (
                          <span className="ml-2">
                            {Math.round(file.pageSize.width)}×{Math.round(file.pageSize.height)}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRotate(file.id)}
                      className="p-2 rounded-lg hover:bg-purple-100 transition-colors text-gray-400 hover:text-purple-600"
                      title="旋转90°"
                    >
                      <RotateCw size={16} />
                    </button>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors text-gray-400 hover:text-red-500"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Grid size={20} className="text-purple-600" />
                  <h3 className="text-base font-semibold text-gray-800">布局设置</h3>
                </div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPreview ? '隐藏预览' : '显示预览'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">预设布局</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PRESET_LAYOUTS) as PresetLayout[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setLayoutPreset(key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          layoutPreset === key
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {PRESET_LAYOUTS[key].label}
                      </button>
                    ))}
                    <button
                      onClick={() => setLayoutPreset('custom')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        layoutPreset === 'custom'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      自定义
                    </button>
                  </div>
                </div>

                {layoutPreset === 'custom' && (
                  <div className="flex gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">行数</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={customRows}
                        onChange={(e) => setCustomRows(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">列数</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={customCols}
                        onChange={(e) => setCustomCols(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                        className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">边距 (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={margin}
                      onChange={(e) => setMargin(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">间距 (mm)</label>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={spacing}
                      onChange={(e) => setSpacing(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                      className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Settings size={16} />
                    <span>布局信息：{rows}行 × {cols}列 = 每页{layoutInfo.totalCells}张</span>
                  </div>
                </div>
              </div>

              {showPreview && files.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <LayoutPreview
                    files={files.flatMap((f) =>
                      Array.from({ length: Math.max(1, f.pageCount) }, (_, i) => ({
                        name: f.pageCount > 1 ? `${f.name} · ${i + 1}` : f.name,
                        rotation: f.rotation,
                        fileType: f.fileType,
                      }))
                    )}
                    rows={rows}
                    cols={cols}
                    margin={margin}
                    spacing={spacing}
                  />
                </div>
              )}
            </div>

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在生成..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">生成完成！文件已保存</p>
              </div>
            )}

            <button
              onClick={handleMerge}
              disabled={files.length === 0 || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${files.length > 0 && !processing
                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Download size={20} />
              {processing ? '生成中...' : '生成A4纸'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
