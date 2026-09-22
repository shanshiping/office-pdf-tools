# PDF 工具箱 — Agent 架构说明

本地桌面 PDF 工具。Electron 壳 + Vite/React 渲染进程。文件只在本机处理，不上传。

版权：`Copyright © 2026 shanshiping`。

读完本文即可改功能、补测试、打包装，不必先通读全仓库。

---

## 1. 运行时拓扑

```
┌─────────────────────────────────────────────────────────┐
│ Electron 主进程  electron/main.cjs                      │
│  窗口、系统对话框、读/写文件、HTML printToPDF            │
└───────────────┬─────────────────────────────────────────┘
                │ IPC (preload.cjs → window.electronAPI)
┌───────────────▼─────────────────────────────────────────┐
│ 渲染进程  src/  (React + HashRouter, base './')         │
│  全部 PDF/Word/OCR 算法都在这里跑                        │
│  库：pdf-lib, pdfjs-dist, docx, mammoth, tesseract.js   │
└─────────────────────────────────────────────────────────┘
```

- 开发：Vite `http://localhost:5173`，Electron 加载该 URL。
- 打包：`vite build` → `dist/`，Electron `loadFile(dist/index.html)`。
- **必须用 HashRouter**。`file://` 下 BrowserRouter 会坏。
- `vite.config.ts` 的 `base: './'`，资源用相对路径。
- 主进程 **没有** PDF 算法。不要把转换逻辑加回 `electron/main.cjs`。
- 已去掉 `pdf2pic` / Ghostscript。Win/Mac 都不依赖外部 PDF 工具。

---

## 2. 目录

| 路径 | 职责 |
|---|---|
| `electron/main.cjs` | 窗口、IPC：存盘、打开、读文件、printHtmlToPdf |
| `electron/preload.cjs` | 暴露 `window.electronAPI` |
| `src/App.tsx` | 路由表 |
| `src/pages/` | 每个工具一页，只做 UI / 进度 / 调 lib |
| `src/lib/` | 全部转换算法。**新逻辑写这里** |
| `src/hooks/useFileDrop.ts` | 拖拽/选择，读成 `ArrayBuffer` |
| `src/components/` | 通用上传、列表、进度、页头 |
| `public/tesseract/` `public/tessdata/` | OCR worker / wasm / `chi_sim+eng`，构建时复制或下载 |
| `resources/` | 应用图标、NSIS 侧栏、DMG 背景（`buildResources`） |
| `docs/ARCHITECTURE.md` | 本文 |

页面只应：收文件 → 调 `src/lib/*` → 进度条 → `electronAPI.saveFile`。不要把 PDF 操作写进 JSX。

---

## 3. 路由与功能模块

| 路由 | 页面 | 算法 | 作用 |
|---|---|---|---|
| `/` | `Dashboard.tsx` | — | 工具入口 |
| `/merge` | `Merge.tsx` | `pdf-merge.ts` `mergePdf` | 多 PDF 按序合并 |
| `/delete-pages` | `DeletePages.tsx` | `pdf-delete.ts` `deletePages` | 按页码删除（0-based） |
| `/compress` | `Compress.tsx` | `pdf-compress.ts` `compressPdf` | pdf.js 渲成 JPEG 再嵌回 |
| `/n-up` | `NUp.tsx` | `pdf-n-up.ts` `createNUpPdf` | 多页铺到 A4（发票 2×2 等） |
| `/image-to-pdf` | `ImageToPdf.tsx` | `image-to-pdf.ts` `imageToPdf` | 图片转 A4 PDF |
| `/pdf-to-word` | `PdfToWord.tsx` | `pdf-to-word.ts` `pdfToWord` + `ocr.ts` | PDF→可编辑 docx |
| `/word-to-pdf` | `WordToPdf.tsx` | `word-to-pdf.ts` `wordToPdf` | docx→PDF |

共享：

- `bytes.ts`：`copyArrayBuffer` / `uint8ToArrayBuffer`。`pdf-lib` `save().buffer` 会切到共享底层，**禁止直接用 `.buffer` 当结果**。
- `pdf-utils.ts`：pdf.js worker、页数、缩略图。删页页数用 `pdf-delete.getPageCount`（pdf-lib），预览用 `pdf-utils`。
- `ocr.ts`：tesseract.js，`chi_sim+eng`，资源走 `public/`。`rotateAuto: false`（pdf.js viewport 已转正）。

---

## 4. 模块约定（改代码时遵守）

### 合并 `mergePdf(files)`

`files: { buffer, name }[]`。`copyPages` 全部页。忽略加密。

### 删页 `deletePages(buffer, pagesToRemove)`

`pagesToRemove` 是 **0-based**，内部从大到小删。

### 压缩 `compressPdf(buffer, 'low'|'medium'|'high')`

要 `document` + canvas。Node 测试只测 `getCompressionParams` / `getCompressionLabel`。

### N-up `createNUpPdf(files, { rows, cols, margin, spacing })`

返回 `{ buffer, failed }`。多页源 PDF 的每一页都要铺上去，不要只铺第一页。坏文件进 `failed`，全坏才 throw。

### 图片转 PDF

canvas 转 JPEG 再 `embedJpg`。不要对 webp/bmp 直接 `embedPng/embedJpg`。`fitInA4` 留 24pt 边。

### PDF → Word（扫描件重点）

1. pdf.js 按页渲染（处理 `/Rotate`）。
2. 文字层字数 ≥ 15：用 pdf.js items；否则 OCR。
3. OCR 用 **词框** 自己组行，丢掉异常高框（曾出现整页巨字叠字）。
4. `linesToDocBlocks` 合成 title / greeting / heading / list / paragraph。
5. `packPagesToWord` 输出 **普通段落**，不要逐行 Textbox/frame。
6. 页眉 Logo、印章各裁一张图，inline 进去。
7. 无 `document`（纯 Node）时 `pdfToWord` 必须抛「需要在应用窗口中运行」。

### Word → PDF

mammoth → HTML。Electron 有 `printHtmlToPdf` 就走系统打印（中文靠微软雅黑）。否则 canvas 栅格化。`wrapWordHtml` 必须带 CJK 字体栈。

---

## 5. IPC（`window.electronAPI`）

定义：`electron/preload.cjs`、`src/vite-env.d.ts`。

| 方法 | 用途 |
|---|---|
| `saveFile({ defaultPath, buffer })` | 存 PDF/docx，`buffer` 是 `number[]` |
| `openFiles()` | 系统选 PDF |
| `readFile(path)` | 读已有路径 |
| `openFile` / `showItemInFolder` | 打开结果 |
| `printHtmlToPdf({ html })` | Word→PDF |

渲染进程传文件：`Array.from(new Uint8Array(arrayBuffer))`。主进程 `Buffer.from(buffer)`。

---

## 6. 字节与 PDF 加载

```ts
// 错：save() 后 .buffer 可能比实际短
const { buffer } = await pdf.save()

// 对
return uint8ToArrayBuffer(await pdf.save())
```

`pdf-lib` / pdf.js 加载前 `copyArrayBuffer`，避免 `getDocument` 转移后原缓冲被 detach。

---

## 7. OCR / 打包资源

- Vite 插件 `copy-runtime-assets`：复制 tesseract worker/wasm，缺 tessdata 就下载。
- `ocr.ts` 用 `new URL(rel, window.location.href)` 找 `tesseract/`、`tessdata/`。
- `asarUnpack`：`*.wasm`、`pdf.worker*`、`tesseract/**`、`tessdata/**`。
- 语言：`chi_sim+eng`。不要改回在线拉 worker。

---

## 8. UI 模式

工具页统一：

`ToolHeader` → `FileUploader` / `FileList` → 选项 → `ProgressBar` → 保存/打开。

上传：`useFileDrop`。类型过滤：`isFileType` / `getFileType`（`pdf` | `image` | `all`）。

版权文案在首页底部；安装包版权在 `package.json` → `build.copyright`。

---

## 9. 测试

`npm test` → `vitest run`，环境 `node`，匹配 `src/**/*.test.ts`。

| 文件 | 覆盖 |
|---|---|
| `pdf-merge.test.ts` | 合并 |
| `pdf-delete.test.ts` | 删页 |
| `pdf-n-up.test.ts` | N-up |
| `pdf-compress.test.ts` | 压缩档位（渲染需窗口） |
| `image-to-pdf.test.ts` | 类型 / A4 适配 |
| `pdf-to-word.test.ts` | 排版块、pack docx |
| `word-to-pdf.test.ts` | HTML / 折行 / mammoth |
| `pdf-utils.test.ts` | pdf.js 页数 |
| `tools.integration.test.ts` | 合并+删页、合并+N-up |
| `bytes.test.ts` | 缓冲拷贝 |
| `hooks/useFileDrop.test.ts` | 扩展名过滤 |
| `test-pdf.ts` | 测试用造 PDF |

改 `src/lib/*` 后跑 `npm test`。画布/OCR 全链路只能在 Electron 窗口里手测。

---

## 10. 命令

```bash
npm run electron:dev   # 开发：Vite + 窗口
npm test               # 自动化
npm run build:mac      # dmg
npm run build:win      # NSIS x64
```

产物在 `release/`。图标与安装界面素材在 `resources/`。

---

## 11. Agent 改动清单

1. 新工具：`src/lib/<name>.ts` + `src/pages/<Name>.tsx` + `App.tsx` 路由 + Dashboard 卡片 + `*.test.ts`。
2. 不要引入需要本机 Ghostscript/LibreOffice 的库。
3. 不要把算法放进主进程。
4. 保存 PDF/docx 一律 `uint8ToArrayBuffer`。
5. 扫描件转 Word：段落文字，不要整页大图，不要一行一个文本框。
6. 中文输出用微软雅黑 / PingFang / Noto Sans SC，不要 Helvetica。
7. Win 安装包目前只打 x64 NSIS；英文 Windows 缺中文字体时 Word→PDF 可能缺字。
