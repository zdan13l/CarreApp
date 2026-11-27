import { supabase } from './supabase'

export interface TemplateUse {
  key: string
  name: string
  usedBy: string | null // the carrera that already took this theme (null = free). A theme belongs to ONE carrera (migration 0049).
}

/** The theme templates the coordi keeps (only their names) and which carrera already took each one. Before 0049 every theme counts as free. */
export async function loadTemplates(): Promise<TemplateUse[] | null> {
  if (!supabase) return null
  const sb = supabase
  const t = await sb.from('themes').select('key, name').is('term_id', null).eq('is_global', false).order('name')
  if (t.error) return null
  const list = (t.data ?? []) as { key: string; name: string }[]
  return Promise.all(
    list.map(async (x) => {
      const used = await sb.rpc('theme_template_user', { p_template: x.key })
      return { ...x, usedBy: used.error || typeof used.data !== 'string' ? null : used.data }
    }),
  )
}
