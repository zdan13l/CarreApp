import { resizeImage } from './image'
import { supabase } from './supabase'

const BUCKET = 'photos'

// Resizes and uploads a photo; returns the storage path to save in the DB.
// A fresh file name per upload avoids stale caches when a photo is replaced.
export async function uploadPhoto(folder: 'teams' | 'bases' | 'users', file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const blob = await resizeImage(file)
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw new Error('No se pudo subir la foto.')
  return path
}

export async function deletePhoto(path: string | null) {
  if (!supabase || !path) return
  await supabase.storage.from(BUCKET).remove([path])
}

export async function deletePhotos(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p))
  if (!supabase || list.length === 0) return
  await supabase.storage.from(BUCKET).remove(list)
}

export function photoUrl(path: string | null): string | null {
  if (!supabase || !path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
