import { useEffect } from 'react'
import { bumpCatalog } from './catalogStore'
import { setCommittees } from './committees'
import { setThemes, type ThemeRows } from './themes'
import { loadAllEventSeals } from './eventSealStore'
import { setGenerations, type GenerationRow } from './seals'
import { photoUrl } from './storage'
import { supabase } from './supabase'

export interface GroupRow { id: string; name: string; sort_order: number }
export interface CareerRow { id: string; name: string; group_id: string }

// Reads the catalog the coordinator keeps (committees, themes with their cultures, groups of careers). Before migration 0035 every query fails and
// the app keeps the lists it was made with.
export async function loadCatalog(): Promise<void> {
  if (!supabase) return
  const sb = supabase
  const [com, th, cu, gr, ca, gc, ge] = await Promise.all([
    sb.from('committees').select('key, name, tagline, myth, ink, active, sort_order').order('sort_order'),
    sb.from('themes').select('key, name, is_global, term_id'),
    sb.from('theme_cultures').select('theme_key, key, name, myth, ink, ornament, emblem, sort_order'),
    sb.from('career_groups').select('id, name, sort_order').order('sort_order'),
    sb.from('careers').select('id, name, group_id'),
    sb.from('group_cultures').select('theme_key, group_id, culture_key'),
    sb.from('generations').select('key, name, term, sort_order, kind, ink, source_file, shape, color, image_path'),
  ])
  if (!ge.error && ge.data) setGenerations(ge.data as GenerationRow[], (p) => photoUrl(p) ?? '') // the generations and their seals (migration 0039)
  if (!com.error && com.data) setCommittees(com.data as Parameters<typeof setCommittees>[0])
  if (!th.error && !cu.error && !gr.error && !ca.error && !gc.error) {
    setThemes({
      themes: (th.data ?? []) as ThemeRows['themes'],
      cultures: (cu.data ?? []) as ThemeRows['cultures'],
      groups: (gr.data ?? []) as ThemeRows['groups'],
      careers: (ca.data ?? []) as ThemeRows['careers'],
      groupCultures: (gc.data ?? []) as ThemeRows['groupCultures'],
    })
  }
  await loadAllEventSeals() // the seals of each carrera (passports and screens use the ones of their carrera)
  bumpCatalog()
}

export function useCatalog(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) void loadCatalog()
  }, [signedIn])
}
