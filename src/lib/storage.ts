import { resizeImage } from './image'
import { supabase } from './supabase'

const BUCKET = 'photos'
const THUMB_SIDE = 240 // the small copy used in lists, avatars and crests

/** The path of the small copy of a photo ("teams/abc.jpg" -> "teams/abc-s.jpg"); null for images that ship with the app. */
export function thumbPath(path: string | null | undefined): string | null {
  if (!path || path.startsWith('/') || !/\.jpg$/.test(path)) return null
  return path.replace(/\.jpg$/, '-s.jpg')
}

// Resizes and uploads a photo in two sizes (1000 px and a 240 px copy); returns the storage path of the big one to save in the DB.
// A fresh file name per upload avoids stale caches when a photo is replaced. The small copy is a courtesy: if it fails nothing is lost,
// the screens fall back to the big photo.
export async function uploadPhoto(folder: 'teams' | 'bases' | 'users', file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const blob = await resizeImage(file)
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw new Error('No se pudo subir la foto.')
  try {
    const small = await resizeImage(file, THUMB_SIDE, 0.8)
    await supabase.storage.from(BUCKET).upload(thumbPath(path)!, small, { contentType: 'image/jpeg', cacheControl: '31536000' })
  } catch {
    /* the big photo is already saved */
  }
  return path
}

export async function deletePhoto(path: string | null) {
  await deletePhotos([path])
}

export async function deletePhotos(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p)).flatMap((p) => [p, thumbPath(p)].filter((x): x is string => Boolean(x)))
  if (!supabase || list.length === 0) return
  await supabase.storage.from(BUCKET).remove(list)
}

/** The public address of a photo; `small` asks for the 240 px copy (photos uploaded before it existed do not have one: see PhotoImg). */
export function photoUrl(path: string | null, small = false): string | null {
  if (path && path.startsWith('/')) return path // an image that ships with the app (campus photo, design previews)
  if (!supabase || !path) return null
  const wanted = small ? (thumbPath(path) ?? path) : path
  return supabase.storage.from(BUCKET).getPublicUrl(wanted).data.publicUrl
}
