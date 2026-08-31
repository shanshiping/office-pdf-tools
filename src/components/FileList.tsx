import { useState, useRef } from 'react'
import { File, X, GripVertical } from 'lucide-react'

interface FileItem {
  id: string
  name: string
  size: number
  pageCount?: number
}

interface FileListProps {
  files: FileItem[]
  onRemove?: (id: string) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  showOrder?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function FileList({ files, onRemove, onReorder, showOrder = false }: FileListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const dragItem = useRef<number>(-1)

  if (files.length === 0) return null

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragItem.current !== index) {
      setOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = dragItem.current
    if (fromIndex >= 0 && fromIndex !== toIndex && onReorder) {
      onReorder(fromIndex, toIndex)
    }
    setDragIndex(null)
    setOverIndex(null)
    dragItem.current = -1
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setOverIndex(null)
    dragItem.current = -1
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <div
          key={file.id}
          draggable={showOrder && !!onReorder}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`
            flex items-center gap-3 bg-white rounded-xl px-4 py-3 border transition-all group
            ${showOrder ? 'cursor-grab active:cursor-grabbing' : ''}
            ${dragIndex === index ? 'opacity-40 scale-[0.98]' : ''}
            ${overIndex === index && dragIndex !== index ? 'border-brand-orange bg-orange-50 shadow-md' : 'border-gray-100 hover:border-gray-200'}
          `}
        >
          {showOrder && (
            <div className="flex items-center text-gray-300 flex-shrink-0">
              <GripVertical size={16} className="cursor-grab active:cursor-grabbing" />
              <span className="text-xs font-medium text-gray-400 w-5 text-center">
                {index + 1}
              </span>
            </div>
          )}
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <File size={20} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">
              {formatSize(file.size)}
              {file.pageCount ? ` · ${file.pageCount} 页` : ''}
            </p>
          </div>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(file.id)
              }}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <X size={16} className="text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
