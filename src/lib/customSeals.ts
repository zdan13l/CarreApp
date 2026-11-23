import { useEffect } from 'react'
import { setCustomSeals, type CustomSealRow } from './seals'
import { photoUrl, deletePhoto } from './storage'
import { supabase } from './supabase'

// The seals the coordinator uploaded (migration 0034). The app keeps working without them (or before the migration): it has its own fifteen.
export async function loadCustomSeals(): Promise<CustomSealRow[]> {
  if (!supabase) return []
  const full = await supabase.from('custom_seals').select('id, name, culture, color, path, story, event_id').order('created_at')
  const old = full.error ? await supabase.from('custom_seals').select('id, name, culture, color, path, story').order('created_at') : null // before migration 0038
  if (full.error && old?.error) return []
  const rows = ((full.error ? old?.data : full.data) ?? []) as CustomSealRow[]
  setCustomSeals(rows, (p) => photoUrl(p) ?? '')
  return rows
}

export function useCustomSeals(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) void loadCustomSeals()
  }, [signedIn])
}

// A picture becomes ink: white where there is ink, transparent elsewhere (what the stamps use as a mask). A dark drawing on a light page
// (the usual case) is read by its darkness; a picture that already has transparency is read by its opacity; `invert` is for a light drawing
// on a dark background.
export async function pictureToInk(file: File, invert = false, side = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let transparent = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transparent++
  const hasAlpha = transparent > d.length / 4 / 20 // more than 5 % of the pixels are see-through
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
    let ink = hasAlpha ? d[i + 3] / 255 : 1 - lum
    if (invert && !hasAlpha) ink = lum
    ink = Math.min(1, Math.max(0, (ink - 0.12) / 0.6)) // a little contrast: the paper goes fully clear
    d[i] = d[i + 1] = d[i + 2] = 255
    d[i + 3] = Math.round(ink * 255)
  }
  ctx.putImageData(img, 0, 0)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo convertir la imagen.'))), 'image/png'))
}

export async function uploadSeal(blob: Blob, row: { name: string; culture: string; color: string; story: string; event_id: string }): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const path = `seals/${crypto.randomUUID()}.png`
  const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/png', cacheControl: '31536000' })
  if (up.error) return 'No se pudo subir la imagen (máximo 2 MB).'
  const ins = await supabase.from('custom_seals').insert({ name: row.name.trim(), culture: row.culture, color: row.color, path, story: row.story.trim() || null, event_id: row.event_id })
  if (ins.error) {
    await deletePhoto(path)
    return 'No se pudo guardar el sello.'
  }
  return null
}

export async function removeSeal(row: CustomSealRow): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.from('custom_seals').delete().eq('id', row.id)
  if (error) return /No puedes borrar/.test(error.message) ? 'No puedes borrar este sello: hay una carrera con tantas bases como sellos.' : 'No se pudo borrar el sello.'
  await deletePhoto(row.path)
  return null
}
