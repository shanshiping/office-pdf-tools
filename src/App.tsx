import { HashRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Compress from './pages/Compress'
import Merge from './pages/Merge'
import DeletePages from './pages/DeletePages'
import ImageToPdf from './pages/ImageToPdf'
import PdfToWord from './pages/PdfToWord'
import WordToPdf from './pages/WordToPdf'
import NUp from './pages/NUp'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/compress" element={<Compress />} />
        <Route path="/merge" element={<Merge />} />
        <Route path="/delete-pages" element={<DeletePages />} />
        <Route path="/image-to-pdf" element={<ImageToPdf />} />
        <Route path="/pdf-to-word" element={<PdfToWord />} />
        <Route path="/word-to-pdf" element={<WordToPdf />} />
        <Route path="/n-up" element={<NUp />} />
      </Routes>
    </HashRouter>
  )
}
