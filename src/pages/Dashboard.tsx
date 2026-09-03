import { useNavigate } from 'react-router-dom'
import { FileDown, FileUp, Scissors, Image, FileText, FileType, LayoutGrid } from 'lucide-react'

const tools = [
  {
    id: 'merge',
    title: '合并 PDF',
    description: '将多个 PDF 文件按顺序合并为一个文件，支持拖拽排序。',
    icon: FileUp,
    color: '#EE6C4D',
    path: '/merge',
    category: 'organize',
  },
  {
    id: 'compress',
    title: '压缩 PDF',
    description: '减小 PDF 文件体积，支持多级压缩，在质量和大小间取得平衡。',
    icon: FileDown,
    color: '#8FBC5D',
    path: '/compress',
    category: 'optimize',
  },
  {
    id: 'delete-pages',
    title: '删除页面',
    description: '从 PDF 中移除不需要的页面，可视化预览每一页。',
    icon: Scissors,
    color: '#3498DB',
    path: '/delete-pages',
    category: 'organize',
  },
  {
    id: 'image-to-pdf',
    title: '图片转 PDF',
    description: '将多张图片合并为一个 PDF 文件，支持拖拽排序。',
    icon: Image,
    color: '#E67E22',
    path: '/image-to-pdf',
    category: 'convert',
  },
  {
    id: 'pdf-to-word',
    title: 'PDF 转 Word',
    description: '高级模式识别转换，保留字体样式、加粗和标题层级。',
    icon: FileText,
    color: '#2980B9',
    path: '/pdf-to-word',
    category: 'convert',
  },
  {
    id: 'word-to-pdf',
    title: 'Word 转 PDF',
    description: '将 Word 文档转换为 PDF 文件，保持排版一致。',
    icon: FileType,
    color: '#8E44AD',
    path: '/word-to-pdf',
    category: 'convert',
  },
  {
    id: 'n-up',
    title: '发票合并到A4纸',
    description: '将多张发票排列到A4纸上，支持多种布局和旋转。',
    icon: LayoutGrid,
    color: '#9B59B6',
    path: '/n-up',
    category: 'organize',
  },
]

const categories = [
  { id: 'all', label: '全部' },
  { id: 'organize', label: '整理 PDF' },
  { id: 'optimize', label: '优化 PDF' },
  { id: 'convert', label: '格式转换' },
]

export default function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-orange rounded-xl flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-800">PDF 工具箱</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            本地 PDF 处理工具
          </h2>
          <p className="text-gray-500 text-lg">
            压缩、合并、转换，所有操作在本地完成，文件不会上传
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <button
                key={tool.id}
                onClick={() => navigate(tool.path)}
                className="bg-white rounded-2xl p-6 text-left hover:shadow-lg transition-all duration-200 group border border-gray-100 hover:border-gray-200"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: tool.color + '15' }}
                >
                  <Icon size={24} style={{ color: tool.color }} />
                </div>
                <h3 className="text-base font-semibold text-gray-800 mb-1.5">
                  {tool.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {tool.description}
                </p>
              </button>
            )
          })}
        </div>

        <div className="text-center mt-16 text-sm text-gray-400">
          所有文件处理均在本地完成，不经过网络传输
        </div>
      </main>
    </div>
  )
}
