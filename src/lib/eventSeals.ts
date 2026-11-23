import { supabase } from './supabase'
import { deletePhoto, photoUrl } from './storage'

// The seals of ONE carrera (migration 0037): its theme, its subthemes, its groups, its committees and the golden seal of its coordi. Each element
// has one seal (shape, colour and an image turned into ink); two elements of the same kind cannot share the same design inside a carrera.
export type SealKind = 'theme' | 'subtheme' | 'team' | 'committee' | 'coordinator' | 'base'

export const SHAPES = ['circle', 'hexagon', 'octagon', 'pentagon', 'shield', 'arch', 'roundsq', 'tablet', 'oval', 'wide', 'scallop'] as const
export type SealShape = (typeof SHAPES)[number]
export const SHAPE_LABEL: Record<SealShape, string> = {
  circle: 'Círculo', hexagon: 'Hexágono', octagon: 'Octágono', pentagon: 'Pentágono', shield: 'Escudo', arch: 'Arco', roundsq: 'Cuadrado suave',
  tablet: 'Tableta', oval: 'Óvalo', wide: 'Alargado', scallop: 'Festón',
}
export const KIND_LABEL: Record<SealKind, string> = { theme: 'Temática', subtheme: 'Subtemática', team: 'Grupo', committee: 'Comité', coordinator: 'Coordi', base: 'Base' }

export interface EventSeal {
  id: string
  event_id: string
  kind: SealKind
  ref: string
  shape: SealShape
  color: string
  image_path: string | null
}

export async function loadEventSeals(eventId: string): Promise<EventSeal[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('event_seals').select('id, event_id, kind, ref, shape, color, image_path').eq('event_id', eventId)
  return error ? [] : ((data ?? []) as EventSeal[])
}

export const imageUrl = (path: string | null) => photoUrl(path)

/** Saves the seal of an element (creates it or replaces it). Returns a message when it fails. */
export async function saveEventSeal(
  existing: EventSeal | undefined,
  s: { event_id: string; kind: SealKind; ref: string; shape: SealShape; color: string },
  image: { blob: Blob } | 'keep' | 'remove',
): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  let image_path: string | null = existing?.image_path ?? null
  let uploaded: string | null = null
  if (image !== 'keep') {
    if (image === 'remove') image_path = null
    else {
      const path = `eventseals/${crypto.randomUUID()}.png`
      const up = await supabase.storage.from('photos').upload(path, image.blob, { contentType: 'image/png', cacheControl: '31536000' })
      if (up.error) return 'No se pudo subir la imagen (máximo 2 MB).'
      image_path = path
      uploaded = path
    }
  }
  const row = { ...s, image_path }
  const { error } = existing ? await supabase.from('event_seals').update({ shape: s.shape, color: s.color, image_path }).eq('id', existing.id) : await supabase.from('event_seals').insert(row)
  if (error) {
    if (uploaded) await deletePhoto(uploaded)
    return /ya lo usa otro elemento/.test(error.message) ? 'Ese sello (forma, color e imagen) ya lo usa otro elemento del mismo tipo en esta carrera: cambia el color, la forma o la imagen.' : 'No se pudo guardar el sello.'
  }
  if (existing?.image_path && existing.image_path !== image_path) await deletePhoto(existing.image_path)
  return null
}

export async function removeEventSeal(seal: EventSeal): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.from('event_seals').delete().eq('id', seal.id)
  if (error) return 'No se pudo quitar el sello.'
  await deletePhoto(seal.image_path)
  return null
}
