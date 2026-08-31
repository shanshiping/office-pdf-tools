import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface ToolHeaderProps {
  title: string
  description: string
  color: string
}

export default function ToolHeader({ title, description, color }: ToolHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: color }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
