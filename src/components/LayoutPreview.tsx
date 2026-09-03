import { useMemo } from 'react'
import { calculateLayout, PRESET_LAYOUTS, type PresetLayout } from '../lib/pdf-n-up'

interface PreviewProps {
  files: { name: string; rotation: number; fileType: 'pdf' | 'image' }[]
  rows: number
  cols: number
  margin: number
  spacing: number
}

export default function LayoutPreview({ files, rows, cols, margin, spacing }: PreviewProps) {
  const layoutInfo = useMemo(
    () => calculateLayout({ rows, cols, margin, spacing }),
    [rows, cols, margin, spacing]
  )

  const A4_WIDTH = 595.28
  const A4_HEIGHT = 841.89

  const previewScale = 0.25
  const previewWidth = A4_WIDTH * previewScale
  const previewHeight = A4_HEIGHT * previewScale

  const sheetCount = Math.ceil(files.length / layoutInfo.totalCells)

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100">
      <h3 className="text-base font-semibold text-gray-800 mb-4">布局预览</h3>
      
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: sheetCount }).map((_, sheetIndex) => {
          const startIndex = sheetIndex * layoutInfo.totalCells
          const endIndex = Math.min(startIndex + layoutInfo.totalCells, files.length)
          const sheetFiles = files.slice(startIndex, endIndex)

          return (
            <div key={sheetIndex} className="flex-shrink-0">
              <p className="text-xs text-gray-500 mb-2 text-center">
                第 {sheetIndex + 1} 页
              </p>
              <div
                className="bg-gray-100 rounded-lg border border-gray-200 relative"
                style={{
                  width: previewWidth,
                  height: previewHeight,
                }}
              >
                {sheetFiles.map((file, cellIndex) => {
                  const col = cellIndex % cols
                  const row = Math.floor(cellIndex / cols)

                  const cellWidth =
                    (previewWidth - margin * previewScale * 2 - spacing * previewScale * (cols - 1)) / cols
                  const cellHeight =
                    (previewHeight - margin * previewScale * 2 - spacing * previewScale * (rows - 1)) / rows

                  const cellX = margin * previewScale + col * (cellWidth + spacing * previewScale)
                  const cellY =
                    previewHeight -
                    margin * previewScale -
                    (row + 1) * cellHeight -
                    row * spacing * previewScale

                  const rotation = file.rotation || 0
                  const isRotated = rotation === 90 || rotation === 270

                  return (
                    <div
                      key={cellIndex}
                      className="absolute bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden"
                      style={{
                        left: cellX,
                        top: cellY,
                        width: cellWidth,
                        height: cellHeight,
                        transform: `rotate(${rotation}deg)`,
                      }}
                    >
                      <div className="text-center p-1">
                        <div className={`text-gray-400 ${cellWidth < 40 ? 'text-[6px]' : 'text-[8px]'}`}>
                          {file.fileType === 'image' ? 'IMG' : 'PDF'}
                        </div>
                        <div
                          className={`text-gray-600 font-medium truncate ${cellWidth < 40 ? 'text-[5px]' : 'text-[7px]'}`}
                          title={file.name}
                        >
                          {file.name.length > 8 ? file.name.slice(0, 6) + '..' : file.name}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {sheetFiles.length < layoutInfo.totalCells && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[8px] text-gray-400">
                      还需 {layoutInfo.totalCells - sheetFiles.length} 张
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-white border border-gray-300 rounded"></div>
          <span>文件位置</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 bg-gray-100 border border-gray-200 rounded"></div>
          <span>A4纸张</span>
        </div>
        <div className="flex items-center gap-2">
          <span>边距: {margin}mm</span>
          <span>间距: {spacing}mm</span>
        </div>
      </div>
    </div>
  )
}
