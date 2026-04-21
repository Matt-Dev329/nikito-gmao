import { supabase } from '@/lib/supabase'

export type AlbaBucket =
  | 'alba-controles'
  | 'alba-equipements'
  | 'alba-incidents'
  | 'alba-interventions'
  | 'alba-signatures'
  | 'alba-documents'

export interface UploadPhotoOptions {
  bucket: AlbaBucket
  parcCode: string
  contexte: string
  utilisateurNom?: string
  withWatermark?: boolean
  maxSizeMB?: number
  maxDimension?: number
}

export interface UploadPhotoResult {
  path: string
  bucket: AlbaBucket
  size: number
  width: number
  height: number
}

export async function uploadPhotoControle(
  file: File,
  options: UploadPhotoOptions
): Promise<UploadPhotoResult> {
  const {
    bucket, parcCode, contexte, utilisateurNom,
    withWatermark = true, maxSizeMB = 1, maxDimension = 1920,
  } = options

  const blob = await processImage(file, { maxDimension, maxSizeMB, withWatermark, utilisateurNom })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const random = Math.random().toString(36).slice(2, 10)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const path = `${parcCode}/${contexte}/${timestamp}_${random}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: '3600', upsert: false, contentType: blob.type,
  })
  if (error) throw new Error(`Upload échoué : ${error.message}`)

  const dims = await getImageDimensions(blob)
  return { path, bucket, size: blob.size, width: dims.width, height: dims.height }
}

interface ProcessOptions {
  maxDimension: number
  maxSizeMB: number
  withWatermark: boolean
  utilisateurNom?: string
}

async function processImage(file: File, opts: ProcessOptions): Promise<Blob> {
  const img = await loadImage(file)
  let { width, height } = img
  if (width > opts.maxDimension || height > opts.maxDimension) {
    if (width > height) {
      height = Math.round((height * opts.maxDimension) / width)
      width = opts.maxDimension
    } else {
      width = Math.round((width * opts.maxDimension) / height)
      height = opts.maxDimension
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non supporté')
  ctx.drawImage(img, 0, 0, width, height)
  if (opts.withWatermark) drawWatermark(ctx, width, height, opts.utilisateurNom)
  const maxBytes = opts.maxSizeMB * 1024 * 1024
  let quality = 0.85
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, quality)
  }
  return blob
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, utilisateurNom?: string) {
  const date = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const text = utilisateurNom ? `${date} • ${utilisateurNom}` : date
  const fontSize = Math.max(14, Math.round(width / 60))
  ctx.font = `bold ${fontSize}px sans-serif`
  const padding = fontSize * 0.5
  const textMetrics = ctx.measureText(text)
  const bandHeight = fontSize + padding * 2
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(width - textMetrics.width - padding * 3, height - bandHeight, textMetrics.width + padding * 3, bandHeight)
  ctx.fillStyle = '#FFFFFF'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width - textMetrics.width - padding * 1.5, height - bandHeight / 2)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Image illisible'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Lecture du fichier échouée'))
    reader.readAsDataURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error('Conversion canvas → blob échouée')) },
      'image/jpeg', quality
    )
  })
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Lecture dimensions échouée'))
      i.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}
