import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    writeBundle() {
      const src = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
      const dest = path.resolve(__dirname, 'dist/pdf.worker.min.mjs')
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
})
