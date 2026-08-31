import { useState, useCallback } from 'react'
import { Image, Download, X, GripVertical } from 'lucide-react'
import ToolHeader from '../components/ToolHeader'
import ProgressBar from '../components/ProgressBar'
import { imageToPdf, type ImageFile } from '../lib/image-to-pdf'

export default function ImageToPdf() {
  const [images, setImages] = useState<ImageFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const addImages = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f.name)
    )
    if (imageFiles.length === 0) return

    Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<ImageFile>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({
                id: crypto.randomUUID(),
                name: file.name,
                size: file.size,
                dataUrl: reader.result as string,
              })
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
      )
    ).then((newImages) => {
      setImages((prev) => [...prev, ...newImages])
      setDone(false)
    })
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
    addImages(e.dataTransfer.files)
  }

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImages(e.target.files)
      e.target.value = ''
    }
  }

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
    setDone(false)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    setDragIdx(index)
  }

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setOverIdx(index)
  }

  const handleItemDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragIdx !== null && dragIdx !== toIndex) {
      setImages((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIdx, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
  }

  const handleConvert = async () => {
    if (images.length === 0) return
    setProcessing(true)
    setProgress(0)
    setDone(false)

    try {
      const result = await imageToPdf(images, setProgress)
      const filename = `images_${images.length}_pages.pdf`

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
      <ToolHeader title="图片转 PDF" description="将多张图片合并为一个 PDF 文件" color="#E67E22" />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {images.length === 0 ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('image-input')?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all
              ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'}
            `}
          >
            <input
              id="image-input"
              type="file"
              accept="image/*"
              multiple
              onChange={handleBrowse}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center">
                <Image size={32} className="text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">拖拽图片到这里</p>
                <p className="text-sm text-gray-400 mt-1">支持 JPG、PNG、GIF、BMP、WebP</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{images.length} 张图片</h2>
                <p className="text-sm text-gray-400">拖拽可调整顺序</p>
              </div>
              <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors cursor-pointer">
                <Image size={16} />
                添加图片
                <input type="file" accept="image/*" multiple onChange={handleBrowse} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleItemDragOver(e, index)}
                  onDrop={(e) => handleItemDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    relative group rounded-xl overflow-hidden border-2 bg-white
                    cursor-grab active:cursor-grabbing
                    ${dragIdx === index ? 'opacity-40' : ''}
                    ${overIdx === index && dragIdx !== index ? 'border-orange-400 shadow-md' : 'border-gray-100'}
                  `}
                >
                  <img src={img.dataUrl} alt={img.name} className="w-full aspect-[1/1.414] object-cover" />
                  <div className="absolute top-2 left-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-white">{index + 1}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                    <p className="text-xs text-white truncate">{img.name}</p>
                    <p className="text-xs text-gray-300">{formatSize(img.size)}</p>
                  </div>
                </div>
              ))}
            </div>

            {processing && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <ProgressBar progress={progress} label="正在转换..." />
              </div>
            )}

            {done && (
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-green-600 font-medium">转换完成！文件已保存</p>
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={images.length === 0 || processing}
              className={`
                w-full py-4 rounded-2xl text-lg font-semibold transition-all duration-200
                flex items-center justify-center gap-3
                ${images.length > 0 && !processing
                  ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              <Download size={20} />
              {processing ? '转换中...' : '生成 PDF'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
