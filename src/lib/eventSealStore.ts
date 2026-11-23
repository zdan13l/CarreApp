import { bumpCatalog } from './catalogStore'
import type { EventSeal, SealKind } from './eventSeals'
import { imageUrl } from './eventSeals'
import { setBaseOverrides } from './seals'
import { supabase } from './supabase'
import { themeOf } from './themes'

// The seals of every carrera (migration 0037/0038), kept in memory so the passports and the screens can use the ones of THEIR carrera: the
// subtheme of the culture, the committee seals, the base stamps. An element without an edited seal keeps the app's own drawing.
let seals: EventSeal[] = []
let events: { id: string; term_id: string | null; is_test: boolean }[] = []

export async function loadAllEventSeals(): Promise<void> {
  if (!supabase) return
  const [s, e] = await Promise.all([
    supabase.from('event_seals').select('id, event_id, kind, ref, shape, color, image_path'),
    supabase.from('events').select('id, term_id, is_test'),
  ])
  if (s.error || e.error) return
  seals = (s.data ?? []) as EventSeal[]
  events = (e.data ?? []) as typeof events
  setBaseOverrides(new Map(seals.filter((x) => x.kind === 'base').map((x) => [x.ref, { shape: x.shape, color: x.color, file: imageUrl(x.image_path) }])))
  bumpCatalog()
}

/** The carrera of a semester (the real one before the test one, if they share it). */
export const eventOfTerm = (termId: string | null | undefined): string | null =>
  termId ? ([...events].filter((e) => e.term_id === termId).sort((a, b) => Number(a.is_test) - Number(b.is_test))[0]?.id ?? null) : null

export const eventOfTheme = (themeKey: string): string | null => eventOfTerm(themeOf(themeKey).termId)

export const sealOverride = (eventId: string | null | undefined, kind: SealKind, ref: string): EventSeal | undefined =>
  eventId ? seals.find((s) => s.event_id === eventId && s.kind === kind && s.ref === ref) : undefined

/** The picture files of the seals a passport of these semesters can show (for the PDF, which cannot fetch them by itself). */
export const eventSealFilesOf = (termIds: string[]): string[] => {
  const ids = new Set(termIds.map((t) => eventOfTerm(t)).filter((x): x is string => Boolean(x)))
  return seals.filter((s) => ids.has(s.event_id) && s.image_path).map((s) => imageUrl(s.image_path) ?? '').filter(Boolean)
}
