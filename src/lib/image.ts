// Shrinks a photo in the browser before uploading it: phone photos weigh several MB,
// and the free Supabase plan has 1 GB of storage and mobile data may be slow.
const MAX_SIDE = 1000
const QUALITY = 0.82

export async function resizeImage(file: File, maxSide = MAX_SIDE, quality = QUALITY): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen.'))),
      'image/jpeg',
      quality,
    )
  })
}

// ---------- cropping (the profile-photo step, see components/PhotoCropDialog.tsx) ----------
export const MAX_ZOOM = 4

export interface CropView {
  zoom: number // 1 = the picture just covers the square; more is closer
  x: number // how far the centre of the picture is from the centre of the square, in screen pixels
  y: number
}

/** The part of the picture that sits inside the square, in picture pixels. Pure, so it can be checked without a browser. */
export function cropRect(image: { width: number; height: number }, square: number, view: CropView) {
  const scale = (square / Math.min(image.width, image.height)) * view.zoom // screen pixels per picture pixel
  const side = square / scale
  return { sx: image.width / 2 - view.x / scale - side / 2, sy: image.height / 2 - view.y / scale - side / 2, side }
}

/** Keeps the picture covering the whole square (no empty corners) and the zoom inside its limits. */
export function clampView(image: { width: number; height: number }, square: number, view: CropView): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom))
  const scale = (square / Math.min(image.width, image.height)) * zoom
  const maxX = Math.max(0, (image.width * scale - square) / 2)
  const maxY = Math.max(0, (image.height * scale - square) / 2)
  return { zoom, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) }
}
