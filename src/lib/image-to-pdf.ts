import { PDFDocument } from 'pdf-lib'
import { uint8ToArrayBuffer } from './bytes'

export const A4_WIDTH = 595.28
export const A4_HEIGHT = 841.89

export interface ImageFile {
  id: string
  name: string
  size: number
  dataUrl: string
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('图片数据无效')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function mimeFromName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'bmp':
      return 'image/bmp'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    default:
      return 'image/jpeg'
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取图片'))
    img.src = src
  })
}

async function rasterizeToJpeg(dataUrl: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const img = await loadImage(dataUrl)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) throw new Error('图片尺寸无效')

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0)
  const jpegUrl = canvas.toDataURL('image/jpeg', 0.92)
  return { bytes: dataUrlToUint8Array(jpegUrl), width, height }
}

export function fitInA4(width: number, height: number): { width: number; height: number } {
  const margin = 24
  const availW = A4_WIDTH - margin * 2
  const availH = A4_HEIGHT - margin * 2
  const scale = Math.min(availW / width, availH / height)
  return { width: width * scale, height: height * scale }
}

export async function imageToPdf(
  images: ImageFile[],
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  if (images.length === 0) throw new Error('请先添加图片')
  onProgress?.(5)
  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < images.length; i++) {
    const { bytes } = await rasterizeToJpeg(images[i].dataUrl)
    const embeddedImage = await pdfDoc.embedJpg(bytes)
    const fitted = fitInA4(embeddedImage.width, embeddedImage.height)
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
    page.drawImage(embeddedImage, {
      x: (A4_WIDTH - fitted.width) / 2,
      y: (A4_HEIGHT - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height,
    })
    onProgress?.(5 + ((i + 1) / images.length) * 85)
  }

  onProgress?.(95)
  const pdfBytes = await pdfDoc.save()
  onProgress?.(100)
  return uint8ToArrayBuffer(pdfBytes)
}

export async function imageBufferToPdf(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ArrayBuffer> {
  const blob = new Blob([buffer], { type: mimeFromName(fileName) })
  const url = URL.createObjectURL(blob)
  try {
    return await imageToPdf([
      {
        id: 'buffer',
        name: fileName,
        size: buffer.byteLength,
        dataUrl: url,
      },
    ])
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|tif|tiff)$/i.test(file.name)
}
