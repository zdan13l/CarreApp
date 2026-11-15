// Shrinks a photo in the browser before uploading it: phone photos weigh several MB,
// and the free Supabase plan has 1 GB of storage and mobile data may be slow.
const MAX_SIDE = 1000
const QUALITY = 0.82

export async function resizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
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
      QUALITY,
    )
  })
}
