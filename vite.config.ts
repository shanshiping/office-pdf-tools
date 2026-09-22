import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function copyFileIfExists(src: string, dest: string) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    async buildStart() {
      copyFileIfExists(
        path.resolve(__dirname, 'node_modules/tesseract.js/dist/worker.min.js'),
        path.resolve(__dirname, 'public/tesseract/worker.min.js')
      )
      copyFileIfExists(
        path.resolve(__dirname, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js'),
        path.resolve(__dirname, 'public/tesseract/tesseract-core-simd-lstm.wasm.js')
      )
      copyFileIfExists(
        path.resolve(__dirname, 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm'),
        path.resolve(__dirname, 'public/tesseract/tesseract-core-simd-lstm.wasm')
      )

      const tessDir = path.resolve(__dirname, 'public/tessdata')
      fs.mkdirSync(tessDir, { recursive: true })
      const langs: [string, string][] = [
        ['eng', 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'],
        ['chi_sim', 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/chi_sim@1.0.0/4.0.0_best_int/chi_sim.traineddata.gz'],
      ]
      for (const [lang, url] of langs) {
        const dest = path.join(tessDir, `${lang}.traineddata.gz`)
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) continue
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`下载 OCR 语言包失败: ${lang} (${res.status})`)
        }
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
      }
    },
    writeBundle() {
      copyFileIfExists(
        path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
        path.resolve(__dirname, 'dist/pdf.worker.min.mjs')
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), copyRuntimeAssets()],
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
