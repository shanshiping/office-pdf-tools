import { Upload } from 'lucide-react'
import { useRef } from 'react'
import type { PdfFile } from '../hooks/useFileDrop'

interface FileUploaderProps {
  multiple?: boolean
  isDragging: boolean
  onFiles: (files: PdfFile[]) => void
  onBrowse: (files: FileList) => void
  dragHandlers: {
    handleDragEnter: (e: React.DragEvent) => void
    handleDragLeave: (e: React.DragEvent) => void
    handleDragOver: (e: React.DragEvent) => void
    handleDrop: (e: React.DragEvent) => void
  }
  color?: string
  accept?: string
}

export default function FileUploader({
  multiple = false,
  isDragging,
  onBrowse,
  dragHandlers,
  color = '#EE6C4D',
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onBrowse(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div
      {...dragHandlers}
      onClick={handleClick}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12
        transition-all duration-200 text-center
        ${isDragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: color + '15' }}
        >
          <Upload size={32} style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            {isDragging ? '松开鼠标上传文件' : '拖拽 PDF 文件到这里'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            或点击选择文件 · 支持 .pdf 格式
          </p>
        </div>
      </div>
    </div>
  )
}
