import { deletePhoto } from './storage'
import type { GenerationRow } from './seals'
import { supabase } from './supabase'
import type { SealShape } from './eventSeals'

export const GENERATION_COLUMNS = 'key, name, term, sort_order, kind, ink, source_file, shape, color, image_path'

export async function loadGenerationRows(): Promise<GenerationRow[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('generations').select(GENERATION_COLUMNS).order('sort_order').order('name')
  return error ? null : ((data ?? []) as GenerationRow[])
}

/** Saves the seal of a generation (shape, colour, picture). Without one it keeps the seal the app brings. Returns a message when it fails. */
export async function saveGenerationSeal(row: GenerationRow, seal: { shape: SealShape; color: string }, image: { blob: Blob } | 'keep' | 'remove'): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  let image_path = row.image_path
  let uploaded: string | null = null
  if (image !== 'keep') {
    if (image === 'remove') image_path = null
    else {
      const path = `generations/${crypto.randomUUID()}.png`
      const up = await supabase.storage.from('photos').upload(path, image.blob, { contentType: 'image/png', cacheControl: '31536000' })
      if (up.error) return 'No se pudo subir la imagen (máximo 2 MB).'
      image_path = path
      uploaded = path
    }
  }
  const { error } = await supabase.from('generations').update({ shape: seal.shape, color: seal.color, image_path }).eq('key', row.key)
  if (error) {
    if (uploaded) await deletePhoto(uploaded)
    return 'No se pudo guardar el sello.'
  }
  if (row.image_path && row.image_path !== image_path) await deletePhoto(row.image_path)
  return null
}

/** Back to the seal the app brings. */
export async function resetGenerationSeal(row: GenerationRow): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.from('generations').update({ shape: null, color: null, image_path: null }).eq('key', row.key)
  if (error) return 'No se pudo volver al sello de siempre.'
  await deletePhoto(row.image_path)
  return null
}
