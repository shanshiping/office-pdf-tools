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
  inputClassName?: string
}

function hintForAccept(accept: string): { title: string; subtitle: string } {
  const lower = accept.toLowerCase()
  const allowsPdf = lower.includes('.pdf') || lower === '*/*'
  const allowsImage = /image|\.jpg|\.png|\.webp|\.bmp|\.tif/.test(lower)
  if (allowsPdf && allowsImage) {
    return {
      title: '拖拽 PDF 或图片文件到这里',
      subtitle: '或点击选择文件 · 支持 PDF、JPG、PNG、WebP',
    }
  }
  if (allowsImage) {
    return {
      title: '拖拽图片到这里',
      subtitle: '或点击选择文件 · 支持 JPG、PNG、GIF、BMP、WebP',
    }
  }
  return {
    title: '拖拽 PDF 文件到这里',
    subtitle: '或点击选择文件 · 支持 .pdf',
  }
}

export default function FileUploader({
  multiple = false,
  isDragging,
  onBrowse,
  dragHandlers,
  color = '#EE6C4D',
  accept = '.pdf',
  inputClassName = '',
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hint = hintForAccept(accept)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
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
      onDragEnter={dragHandlers.handleDragEnter}
      onDragLeave={dragHandlers.handleDragLeave}
      onDragOver={dragHandlers.handleDragOver}
      onDrop={dragHandlers.handleDrop}
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
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
        }}
        className={inputClassName}
      />
      <div className="flex flex-col items-center gap-4 pointer-events-none">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: color + '15' }}
        >
          <Upload size={32} style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            {isDragging ? '松开鼠标上传文件' : hint.title}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {hint.subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}
