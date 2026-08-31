import { PDFDocument } from 'pdf-lib'

function copyBuffer(src: ArrayBuffer): ArrayBuffer {
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(new Uint8Array(src))
  return copy
}

async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = dataUrl
  })
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export interface ImageFile {
  id: string
  name: string
  size: number
  dataUrl: string
}

export async function imageToPdf(
  images: ImageFile[],
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  onProgress?.(5)
  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const { width, height } = await getImageDimensions(img.dataUrl)

    let embeddedImage
    if (img.name.toLowerCase().endsWith('.png')) {
      const pngBytes = dataUrlToUint8Array(img.dataUrl)
      embeddedImage = await pdfDoc.embedPng(pngBytes)
    } else {
      const jpgBytes = dataUrlToUint8Array(img.dataUrl)
      embeddedImage = await pdfDoc.embedJpg(jpgBytes)
    }

    const page = pdfDoc.addPage([width, height])
    page.drawImage(embeddedImage, { x: 0, y: 0, width, height })

    onProgress?.(5 + ((i + 1) / images.length) * 85)
  }

  onProgress?.(95)
  const pdfBytes = await pdfDoc.save()
  onProgress?.(100)
  return copyBuffer(pdfBytes.buffer as ArrayBuffer)
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
}
