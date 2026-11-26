import { allCommittees } from './committees'
import { loadEventSeals, type EventSeal, type SealKind } from './eventSeals'
import { supabase } from './supabase'

// Every element of a carrera that can carry a seal: its theme, each subtheme, each base, each committee that takes part and its coordi.
// The seals are CREATED in one place (Administración global → Sellos); the sections only show the ones that belong to them.
export interface SealElement {
  kind: SealKind
  ref: string
  name: string
  theme?: string // subtheme: the key of the theme it belongs to
}

export interface SealEvent {
  id: string
  term_id?: string | null
  coordinator_id?: string | null
}

/** The sections a seal can be made for, with the words the screens use. `kind` 'generation' is global (no carrera); the rest belong to ONE carrera. */
export type SealSection = SealKind | 'generation'
export const SECTIONS: { kind: SealSection; title: string; one: string; rule: string; perCarrera: boolean }[] = [
  { kind: 'generation', title: 'Generaciones', one: 'generación', rule: 'Las generaciones son permanentes: su sello vale para todas las inducciones.', perCarrera: false },
  { kind: 'theme', title: 'Temática', one: 'temática', rule: 'Cada carrera tiene su temática y su sello único.', perCarrera: true },
  { kind: 'subtheme', title: 'Subtemáticas', one: 'subtemática', rule: 'Cada subtemática de la carrera tiene su sello, distinto al de las demás.', perCarrera: true },
  { kind: 'base', title: 'Bases', one: 'base', rule: 'Cada base de la carrera tiene su sello: el de siempre (los 15 de la app) o uno editado solo para esa carrera.', perCarrera: true },
  { kind: 'committee', title: 'Comités', one: 'comité', rule: 'El sello de un comité está ligado a UNA inducción: el comité tiene un sello distinto en cada carrera.', perCarrera: true },
]
export const sectionOf = (kind: string) => SECTIONS.find((s) => s.kind === kind)

export async function loadSealElements(event: SealEvent): Promise<SealElement[]> {
  if (!supabase) return []
  const eventId = event.id
  const [th, ec, ppl, bs] = await Promise.all([
    event.term_id ? supabase.from('themes').select('key, name').eq('term_id', event.term_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('event_committees').select('committee_key').eq('event_id', eventId),
    event.coordinator_id ? supabase.from('passports').select('id, full_name').eq('id', event.coordinator_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('bases').select('id, name').eq('event_id', eventId).order('sort_order'),
  ])
  const out: SealElement[] = []
  const theme = th.data as { key: string; name: string } | null
  if (theme) {
    out.push({ kind: 'theme', ref: theme.key, name: theme.name })
    const cu = await supabase.from('theme_cultures').select('key, name').eq('theme_key', theme.key).order('sort_order')
    for (const c of cu.data ?? []) out.push({ kind: 'subtheme', ref: c.key as string, name: c.name as string, theme: theme.key })
  }
  for (const b of bs.data ?? []) out.push({ kind: 'base', ref: b.id as string, name: b.name as string })
  const names = new Map(allCommittees().map((c) => [c.key, c.name]))
  for (const c of ec.data ?? []) out.push({ kind: 'committee', ref: c.committee_key as string, name: names.get(c.committee_key as string) ?? (c.committee_key as string) })
  const coordi = ppl.data as { id: string; full_name: string } | null
  if (coordi) out.push({ kind: 'coordinator', ref: coordi.id, name: `Coordi: ${coordi.full_name}` })
  return out
}

export async function loadElementsAndSeals(event: SealEvent): Promise<{ elements: SealElement[]; seals: EventSeal[] }> {
  const [elements, seals] = await Promise.all([loadSealElements(event), loadEventSeals(event.id)])
  return { elements, seals }
}

/** The link to the workshop that opens the editor of one element. */
export const workshopLink = (kind: SealSection, eventId: string | null, ref?: string) => {
  const q = new URLSearchParams({ kind })
  if (eventId) q.set('event', eventId)
  if (ref) q.set('ref', ref)
  return `/admin/sellos?${q.toString()}`
}
