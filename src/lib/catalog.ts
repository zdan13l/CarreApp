import { useEffect } from 'react'
import { bumpCatalog } from './catalogStore'
import { setCommittees } from './committees'
import { setThemes, type ThemeRows } from './themes'
import { supabase } from './supabase'

export interface GroupRow { id: string; name: string; sort_order: number }
export interface CareerRow { id: string; name: string; group_id: string }

// Reads the catalog the coordinator keeps (committees, themes with their cultures, groups of careers). Before migration 0035 every query fails and
// the app keeps the lists it was made with.
export async function loadCatalog(): Promise<void> {
  if (!supabase) return
  const sb = supabase
  const [com, th, cu, gr, ca, gc] = await Promise.all([
    sb.from('committees').select('key, name, tagline, myth, ink, active, sort_order').order('sort_order'),
    sb.from('themes').select('key, name, is_global'),
    sb.from('theme_cultures').select('theme_key, key, name, myth, ink, ornament, emblem, sort_order'),
    sb.from('career_groups').select('id, name, sort_order').order('sort_order'),
    sb.from('careers').select('id, name, group_id'),
    sb.from('group_cultures').select('theme_key, group_id, culture_key'),
  ])
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
  bumpCatalog()
}

export function useCatalog(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) void loadCatalog()
  }, [signedIn])
}
