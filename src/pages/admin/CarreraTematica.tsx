import { StepTag } from './PageTitle'
import type { SealKind } from '../../lib/eventSeals'
import SectionSeals from '../../components/SectionSeals'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { CultureSeal } from '../../components/Seals'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import type { Ornament } from '../../lib/themes'
import { errMsg, useAdmin } from './AdminContext'

interface Sub { key: string; name: string; myth: string | null; ink: number; ornament: Ornament; sort_order: number }
interface Group { id: string; name: string }
interface Theme { key: string; name: string }

const ORNAMENTS: Ornament[] = ['plain', 'runes', 'meander', 'steps', 'clouds', 'lotus']
const slugKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20)

// The theme of THIS carrera and its subthemes. It was copied from a template when the carrera was created, so changing it here changes only this
// edition. Every group of careers takes one subtheme (a culture); each subtheme has its own seal (see "Sellos").
const SEAL_KINDS: SealKind[] = ['theme', 'subtheme']
export default function CarreraTematica() {
  useCatalogVersion()
  const { event } = useAdmin()
  const [theme, setTheme] = useState<Theme | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [map, setMap] = useState<Record<string, string>>({}) // career group id -> subtheme key
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const termId = event?.term_id
  const load = useCallback(async () => {
    if (!supabase || !termId) return
    const th = await supabase.from('themes').select('key, name').eq('term_id', termId).maybeSingle()
    if (th.error) return setMissing(true)
    setTheme((th.data as Theme | null) ?? null)
    if (!th.data) return
    const [cu, gr, gc] = await Promise.all([
      supabase.from('theme_cultures').select('key, name, myth, ink, ornament, sort_order').eq('theme_key', th.data.key).order('sort_order'),
      supabase.from('career_groups').select('id, name').order('sort_order'),
      supabase.from('group_cultures').select('group_id, culture_key').eq('theme_key', th.data.key),
    ])
    setSubs((cu.data ?? []) as Sub[])
    setGroups((gr.data ?? []) as Group[])
    setMap(Object.fromEntries((gc.data ?? []).map((x) => [x.group_id as string, x.culture_key as string])))
    await loadCatalog()
  }, [termId])
  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  const must = async (p: PromiseLike<{ error: { message: string } | null }>, msg: string) => {
    const { error: err } = await p
    if (err) throw new Error(/duplicate|unique/i.test(err.message) ? 'Ya existe uno con ese nombre.' : msg)
  }

  if (!event) return null
  if (missing) return <p className="warn">Falta aplicar la migración 0037 (temática propia de cada carrera).</p>
  if (!termId || !theme) return <p className="warn">Esta carrera no tiene temática propia todavía. Las carreras nuevas la reciben al crearse.</p>

  const th = theme
  const renameTheme = (name: string) => supabase && name.trim() && name.trim() !== th.name && void run(() => must(supabase!.from('themes').update({ name: name.trim() }).eq('key', th.key), 'No se pudo renombrar la temática.'))
  const addSub = (form: HTMLFormElement) => {
    const f = new FormData(form)
    const name = String(f.get('name') ?? '').trim()
    const key = slugKey(name)
    if (!supabase || key.length < 2) return setError('El nombre necesita al menos 2 letras.')
    void run(async () => {
      await must(supabase!.from('theme_cultures').insert({ theme_key: th.key, key, name, myth: String(f.get('myth') ?? '').trim() || null, ink: Number(f.get('ink')), ornament: String(f.get('ornament')), emblem: 'Estrella', sort_order: subs.length + 1 }), 'No se pudo agregar la subtemática.')
      form.reset()
    })
  }
  const saveSub = (s: Sub, patch: Partial<Sub>) => supabase && void run(() => must(supabase!.from('theme_cultures').update(patch).eq('theme_key', th.key).eq('key', s.key), 'No se pudo guardar la subtemática.'))
  async function removeSub(s: Sub) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Quitar la subtemática ${s.name}?`, message: 'Los grupos de carreras que la tenían quedan sin subtemática en esta carrera. Su sello se quita en Sellos.', confirmLabel: 'Quitar subtemática', tone: 'danger', icon: 'trash' }))) return
    void run(() => must(supabase!.from('theme_cultures').delete().eq('theme_key', th.key).eq('key', s.key), 'No se pudo quitar la subtemática.'))
  }
  const assign = (g: Group, key: string) =>
    supabase && void run(async () => {
      if (!key) await must(supabase!.from('group_cultures').delete().eq('theme_key', th.key).eq('group_id', g.id), 'No se pudo cambiar la subtemática del grupo.')
      else await must(supabase!.from('group_cultures').upsert({ theme_key: th.key, group_id: g.id, culture_key: key }, { onConflict: 'theme_key,group_id' }), 'No se pudo cambiar la subtemática del grupo.')
    })

  const without = groups.filter((g) => !map[g.id])
  const used = Object.values(map)
  const repeated = subs.filter((s) => used.filter((k) => k === s.key).length > 1)
  return (
    <>
      <header className="page-head">
        <div className="head-title">
                    <h1>Temática</h1>
                    <StepTag n={2} />
        </div>
        <p className="head-meta">La temática se eligió al crear la carrera. Aquí armas sus subtemáticas, una por cada grupo de carreras, y sus sellos: son solo de esta edición y no afectan a otras carreras.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Temática principal</h2>
        <ThemeName key={th.key} name={th.name} busy={busy} onSave={renameTheme} />
        <p className="muted">{groups.length} grupos de carreras · {subs.length} subtemáticas.</p>
        {subs.length === 0 && <p className="warn">Esta temática empezó sin subtemáticas. Agrega una por cada grupo de carreras y asígnalas abajo. Cuando estén asignadas, en Inductores pulsa «Sumar a los activos que faltan» para que entren con la de su carrera.</p>}
        {subs.length > 0 && without.length > 0 && <p className="warn">Sin subtemática: {without.map((g) => g.name).join(', ')}.</p>}
        {repeated.length > 0 && <p className="warn">Dos grupos comparten la subtemática {repeated.map((s) => s.name).join(', ')}: cada grupo debería tener la suya.</p>}
      </section>

      <h2 className="section-title">Subtemáticas</h2>
      <div className="culture-grid">
        {subs.map((s) => (
          <SubEditor key={`${th.key}-${s.key}`} theme={th.key} s={s} busy={busy} onSave={saveSub} onRemove={removeSub} />
        ))}
      </div>
      <form className="culture-add card" onSubmit={(e) => { e.preventDefault(); addSub(e.currentTarget) }}>
        <input name="name" placeholder="Nueva subtemática" maxLength={30} required />
        <input name="myth" placeholder="Una línea sobre ella" maxLength={160} />
        <select name="ink" defaultValue="1" aria-label="Color">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Tinta {n}</option>)}</select>
        <select name="ornament" defaultValue="plain" aria-label="Borde">{ORNAMENTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <button disabled={busy}><Plus size={18} aria-hidden="true" /> Agregar subtemática</button>
      </form>

      <h2 className="section-title">Subtemática de cada grupo de carreras</h2>
      <section className="card">
        <ul className="career-chips">
          {groups.map((g) => (
            <li key={g.id}>
              <span>{g.name}</span>
              <select value={map[g.id] ?? ''} disabled={busy} onChange={(e) => assign(g, e.target.value)} aria-label={`Subtemática de ${g.name}`}>
                <option value="">Sin subtemática</option>
                {subs.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </li>
          ))}
        </ul>
        <p className="muted">Los grupos y sus carreras se administran en Administración global → Carreras y temáticas.</p>
      </section>
      <SectionSeals event={event} kinds={SEAL_KINDS} title="Sellos de la temática y las subtemáticas" />
    </>
  )
}

function ThemeName({ name, busy, onSave }: { name: string; busy: boolean; onSave: (n: string) => void }) {
  const [v, setV] = useState(name)
  return (
    <div className="inline-edit">
      <input value={v} maxLength={40} onChange={(e) => setV(e.target.value)} aria-label="Nombre de la temática" />
      {v.trim() !== name && <button type="button" disabled={busy} onClick={() => onSave(v)}>Guardar</button>}
    </div>
  )
}

function SubEditor({ theme, s, busy, onSave, onRemove }: { theme: string; s: Sub; busy: boolean; onSave: (s: Sub, p: Partial<Sub>) => void; onRemove: (s: Sub) => void }) {
  const [name, setName] = useState(s.name)
  const [myth, setMyth] = useState(s.myth ?? '')
  const changed = name.trim() !== s.name || myth.trim() !== (s.myth ?? '')
  return (
    <div className="culture-edit card">
      <CultureSeal culture={s.key} theme={theme} top={s.name.toUpperCase()} bottom={theme.toUpperCase().slice(0, 14)} size={64} />
      <div>
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={`Nombre de la subtemática ${s.name}`} />
        <input value={myth} maxLength={160} onChange={(e) => setMyth(e.target.value)} aria-label={`Descripción de ${s.name}`} />
        {changed && <button type="button" disabled={busy || !name.trim()} onClick={() => onSave(s, { name: name.trim(), myth: myth.trim() || null })}>Guardar</button>}
        <button type="button" className="ghost danger" disabled={busy} onClick={() => onRemove(s)}>Quitar</button>
      </div>
    </div>
  )
}
