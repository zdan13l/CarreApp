import type { EventSeal } from './eventSeals'
import { supabase } from './supabase'

export interface TemplateUse {
  key: string
  name: string
  usedBy: string | null // the carrera that already took this theme (null = free). A theme belongs to ONE carrera (migration 0049).
  seal: EventSeal | null // the seal that carrera made for its theme in the workshop (null until it exists)
}

/** The theme templates the coordi keeps (only their names) and which carrera already took each one. Before 0049 every theme counts as free. */
export async function loadTemplates(): Promise<TemplateUse[] | null> {
  if (!supabase) return null
  const sb = supabase
  const t = await sb.from('themes').select('key, name').is('term_id', null).eq('is_global', false).order('name')
  if (t.error) return null
  const list = (t.data ?? []) as { key: string; name: string }[]
  // the seal of the theme of the carrera that took each template: the copy of the template (themes.template_of) belongs to a semester, whose carrera has the seal
  const [copies, events, seals] = await Promise.all([
    sb.from('themes').select('key, term_id, template_of').not('template_of', 'is', null).not('term_id', 'is', null),
    sb.from('events').select('id, term_id, is_test'),
    sb.from('event_seals').select('id, event_id, kind, ref, shape, color, image_path').eq('kind', 'theme'),
  ])
  const sealOf = (template: string): EventSeal | null => {
    for (const c of (copies.data ?? []) as { key: string; term_id: string; template_of: string }[]) {
      if (c.template_of !== template) continue
      const e = ((events.data ?? []) as { id: string; term_id: string | null; is_test: boolean }[]).find((x) => x.term_id === c.term_id && !x.is_test)
      const seal = e && ((seals.data ?? []) as EventSeal[]).find((x) => x.event_id === e.id && x.ref === c.key)
      if (seal) return seal
    }
    return null
  }
  return Promise.all(
    list.map(async (x) => {
      const used = await sb.rpc('theme_template_user', { p_template: x.key })
      const usedBy = used.error || typeof used.data !== 'string' ? null : used.data
      return { ...x, usedBy, seal: usedBy ? sealOf(x.key) : null }
    }),
  )
}
