import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CultureSeal } from '../../components/Seals'
import { loadCatalog, type CareerRow, type GroupRow } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import { THEMES, themeOf, type Ornament } from '../../lib/themes'
import { errMsg } from './AdminContext'

interface GroupCulture { theme_key: string; group_id: string; culture_key: string }
const ORNAMENTS: Ornament[] = ['plain', 'runes', 'meander', 'steps', 'clouds', 'lotus']
const slugKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20)
const slugTheme = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

// The careers and how they are grouped, and the themes with the cultures each group takes in them. Careers are grouped (Tronicas, Sistemas…);
// every theme gives each group a culture (in "Mitologías": griega, nórdica…). There is always one global theme, which has no culture of its own.
export default function Programas() {
  useCatalogVersion()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [careers, setCareers] = useState<CareerRow[]>([])
  const [gcs, setGcs] = useState<GroupCulture[]>([])
  const [themeKey, setThemeKey] = useState<string>('')
  const [currentTheme, setCurrentTheme] = useState<string>('mitologias')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newGroup, setNewGroup] = useState('')
  const [newTheme, setNewTheme] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const [g, c, gc, t] = await Promise.all([
      supabase.from('career_groups').select('id, name, sort_order').order('sort_order'),
      supabase.from('careers').select('id, name, group_id').order('name'),
      supabase.from('group_cultures').select('theme_key, group_id, culture_key'),
      supabase.from('terms').select('theme').eq('is_current', true).maybeSingle(),
    ])
    if (g.error) return setError('Falta aplicar la migración 0035.')
    setGroups((g.data ?? []) as GroupRow[])
    setCareers((c.data ?? []) as CareerRow[])
    setGcs((gc.data ?? []) as GroupCulture[])
    if (t.data?.theme) setCurrentTheme(t.data.theme)
    await loadCatalog()
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!themeKey) setThemeKey(currentTheme)
  }, [currentTheme, themeKey])

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

  const theme = themeOf(themeKey || currentTheme)
  const cultureOfGroup = (groupId: string) => gcs.find((x) => x.theme_key === theme.key && x.group_id === groupId)?.culture_key ?? null

  const addGroup = (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || !newGroup.trim()) return
    void run(async () => {
      await must(supabase!.from('career_groups').insert({ name: newGroup.trim(), sort_order: groups.length + 1 }), 'No se pudo crear el grupo.')
      setNewGroup('')
    })
  }
  const renameGroup = (g: GroupRow, name: string) => supabase && name.trim() && name.trim() !== g.name && void run(() => must(supabase!.from('career_groups').update({ name: name.trim() }).eq('id', g.id), 'No se pudo renombrar el grupo.'))
  const setCulture = (g: GroupRow, culture: string) =>
    supabase && void run(async () => {
      if (!culture) await must(supabase!.from('group_cultures').delete().eq('theme_key', theme.key).eq('group_id', g.id), 'No se pudo cambiar la cultura.')
      else await must(supabase!.from('group_cultures').upsert({ theme_key: theme.key, group_id: g.id, culture_key: culture }, { onConflict: 'theme_key,group_id' }), 'No se pudo cambiar la cultura.')
    })
  async function removeGroup(g: GroupRow) {
    if (!supabase) return
    if (careers.some((c) => c.group_id === g.id)) return setError('Primero pasa sus carreras a otro grupo.')
    if (!(await confirmDialog({ title: `¿Borrar el grupo ${g.name}?`, confirmLabel: 'Borrar grupo', tone: 'danger', icon: 'trash' }))) return
    void run(() => must(supabase!.from('career_groups').delete().eq('id', g.id), 'No se pudo borrar el grupo.'))
  }
  const addCareer = (g: GroupRow, name: string) => supabase && name.trim() && void run(() => must(supabase!.from('careers').insert({ name: name.trim(), group_id: g.id }), 'No se pudo agregar la carrera.'))
  const moveCareer = (c: CareerRow, groupId: string) => supabase && void run(() => must(supabase!.from('careers').update({ group_id: groupId }).eq('id', c.id), 'No se pudo mover la carrera.'))
  async function removeCareer(c: CareerRow) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Quitar la carrera ${c.name}?`, message: 'Los inductores ya registrados la conservan.', confirmLabel: 'Quitar carrera', tone: 'danger', icon: 'trash' }))) return
    void run(() => must(supabase!.from('careers').delete().eq('id', c.id), 'No se pudo quitar la carrera.'))
  }

  const addTheme = (e: FormEvent) => {
    e.preventDefault()
    const key = slugTheme(newTheme)
    if (!supabase || key.length < 2) return setError('El nombre necesita al menos 2 letras.')
    void run(async () => {
      await must(supabase!.from('themes').insert({ key, name: newTheme.trim() }), 'No se pudo crear la temática.')
      setNewTheme('')
      setThemeKey(key)
    })
  }
  const renameTheme = (key: string, name: string) => supabase && name.trim() && void run(() => must(supabase!.from('themes').update({ name: name.trim() }).eq('key', key), 'No se pudo renombrar la temática.'))
  async function removeTheme(key: string, name: string) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Borrar la temática ${name}?`, message: 'Se borran sus culturas. Los semestres que la usan muestran una temática neutra.', confirmLabel: 'Borrar temática', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      await must(supabase!.from('themes').delete().eq('key', key), 'No se pudo borrar la temática (la global no se borra).')
      setThemeKey(currentTheme)
    })
  }
  const addCulture = (form: HTMLFormElement) => {
    const f = new FormData(form)
    const name = String(f.get('name') ?? '').trim()
    const key = slugKey(name)
    if (!supabase || key.length < 2) return setError('El nombre de la cultura necesita al menos 2 letras.')
    void run(async () => {
      await must(
        supabase!.from('theme_cultures').insert({ theme_key: theme.key, key, name, myth: String(f.get('myth') ?? '').trim() || null, ink: Number(f.get('ink')), ornament: String(f.get('ornament')), emblem: 'Estrella', sort_order: theme.cultures.length + 1 }),
        'No se pudo agregar la cultura.',
      )
      form.reset()
    })
  }
  const saveCulture = (key: string, name: string, myth: string) => supabase && name.trim() && void run(() => must(supabase!.from('theme_cultures').update({ name: name.trim(), myth: myth.trim() || null }).eq('theme_key', theme.key).eq('key', key), 'No se pudo guardar la cultura.'))
  async function removeCulture(key: string, name: string) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Quitar la cultura ${name}?`, message: 'Los grupos que la tenían quedan sin cultura en esta temática.', confirmLabel: 'Quitar cultura', tone: 'danger', icon: 'trash' }))) return
    void run(() => must(supabase!.from('theme_cultures').delete().eq('theme_key', theme.key).eq('key', key), 'No se pudo quitar la cultura.'))
  }

  const isGlobal = theme.key === 'global'
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Preparación</p>
          <h1>Programas y temáticas</h1>
        </div>
        <p className="head-meta">Las carreras van en grupos (Tronicas, Sistemas…). Cada temática le da una cultura a cada grupo. Siempre existe una temática global.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <label className="inline-field">
          Temática que estás viendo
          <select value={theme.key} onChange={(e) => setThemeKey(e.target.value)}>
            {Object.values(THEMES).map((t) => (
              <option key={t.key} value={t.key}>{t.name}{t.key === 'global' ? ' (global)' : ''}{t.key === currentTheme ? ' · semestre vigente' : ''}</option>
            ))}
          </select>
        </label>
        <ThemeName key={theme.key} name={theme.name} locked={busy} onSave={(n) => renameTheme(theme.key, n)} />
        <h3>Culturas de {theme.name}</h3>
        <div className="culture-grid">
          {theme.cultures.map((c) => (
            <CultureEditor key={`${theme.key}-${c.key}`} theme={theme.key} c={c} busy={busy} locked={isGlobal} onSave={saveCulture} onRemove={removeCulture} />
          ))}
        </div>
        {!isGlobal && (
          <form className="culture-add" onSubmit={(e) => { e.preventDefault(); addCulture(e.currentTarget) }}>
            <input name="name" placeholder="Nueva cultura" maxLength={30} required />
            <input name="myth" placeholder="Una línea sobre ella" maxLength={160} />
            <select name="ink" defaultValue="1" aria-label="Color">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Tinta {n}</option>)}</select>
            <select name="ornament" defaultValue="plain" aria-label="Borde">{ORNAMENTS.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <button disabled={busy}><Plus size={18} aria-hidden="true" /> Agregar cultura</button>
          </form>
        )}
        {!isGlobal && theme.key !== currentTheme && (
          <div className="row">
            <button type="button" className="ghost danger" disabled={busy} onClick={() => void removeTheme(theme.key, theme.name)}>Borrar esta temática</button>
          </div>
        )}
      </section>

      <h2 className="section-title">Grupos de carreras</h2>
      <div className="group-list">
        {groups.map((g) => {
          const culture = cultureOfGroup(g.id)
          const mine = careers.filter((c) => c.group_id === g.id)
          return (
            <section key={g.id} className="card group-card">
              <div className="group-head">
                <CultureSeal culture={culture ?? theme.cultures[0]?.key ?? 'general'} theme={theme.key} top={g.name.toUpperCase()} bottom={theme.name.toUpperCase()} size={84} />
                <div className="group-main">
                  <GroupName g={g} busy={busy} onSave={renameGroup} />
                  {!isGlobal && (
                    <label className="inline-field">
                      Cultura en {theme.name}
                      <select value={culture ?? ''} disabled={busy} onChange={(e) => setCulture(g, e.target.value)}>
                        <option value="">Sin cultura</option>
                        {theme.cultures.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </div>
              <ul className="career-chips">
                {mine.map((c) => (
                  <li key={c.id}>
                    <span>{c.name}</span>
                    <select value={g.id} disabled={busy} onChange={(e) => moveCareer(c, e.target.value)} aria-label={`Grupo de ${c.name}`}>
                      {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <button type="button" className="ghost icon-btn" onClick={() => void removeCareer(c)} aria-label={`Quitar ${c.name}`} title="Quitar"><Trash2 size={16} /></button>
                  </li>
                ))}
                {mine.length === 0 && <li className="muted">Sin carreras</li>}
              </ul>
              <AddCareer g={g} busy={busy} onAdd={addCareer} />
              <button type="button" className="ghost danger" disabled={busy || mine.length > 0} onClick={() => void removeGroup(g)}>Borrar grupo</button>
            </section>
          )
        })}
      </div>
      <form className="card" onSubmit={addGroup}>
        <h2>Agregar un grupo de carreras</h2>
        <label className="inline-field">
          Nombre
          <input value={newGroup} maxLength={40} onChange={(e) => setNewGroup(e.target.value)} placeholder="Arquitectura" />
        </label>
        <div className="row"><button disabled={busy || !newGroup.trim()}><Plus size={18} aria-hidden="true" /> Agregar grupo</button></div>
      </form>

      <form className="card" onSubmit={addTheme}>
        <h2>Agregar una temática</h2>
        <p className="muted">Por ejemplo «Casas de Harry Potter». Después le agregas sus culturas y eliges la cultura de cada grupo.</p>
        <label className="inline-field">
          Nombre
          <input value={newTheme} maxLength={40} onChange={(e) => setNewTheme(e.target.value)} />
        </label>
        <div className="row"><button disabled={busy || !newTheme.trim()}><Plus size={18} aria-hidden="true" /> Agregar temática</button></div>
      </form>
    </>
  )
}

function ThemeName({ name, locked, onSave }: { name: string; locked: boolean; onSave: (n: string) => void }) {
  const [v, setV] = useState(name)
  return (
    <div className="inline-edit">
      <input value={v} maxLength={40} onChange={(e) => setV(e.target.value)} aria-label="Nombre de la temática" />
      {v.trim() !== name && <button type="button" disabled={locked} onClick={() => onSave(v)}>Guardar</button>}
    </div>
  )
}
function GroupName({ g, busy, onSave }: { g: GroupRow; busy: boolean; onSave: (g: GroupRow, n: string) => void }) {
  const [v, setV] = useState(g.name)
  return (
    <div className="inline-edit">
      <input value={v} maxLength={40} onChange={(e) => setV(e.target.value)} aria-label={`Nombre del grupo ${g.name}`} />
      {v.trim() !== g.name && <button type="button" disabled={busy} onClick={() => onSave(g, v)}>Guardar</button>}
    </div>
  )
}
function AddCareer({ g, busy, onAdd }: { g: GroupRow; busy: boolean; onAdd: (g: GroupRow, n: string) => void }) {
  const [v, setV] = useState('')
  return (
    <form className="inline-edit" onSubmit={(e) => { e.preventDefault(); onAdd(g, v); setV('') }}>
      <input value={v} maxLength={60} onChange={(e) => setV(e.target.value)} placeholder="Agregar una carrera" aria-label={`Agregar una carrera a ${g.name}`} />
      <button disabled={busy || !v.trim()}><Plus size={16} aria-hidden="true" /> Agregar</button>
    </form>
  )
}
function CultureEditor({ theme, c, busy, locked, onSave, onRemove }: { theme: string; c: { key: string; name: string; myth: string }; busy: boolean; locked: boolean; onSave: (key: string, name: string, myth: string) => void; onRemove: (key: string, name: string) => void }) {
  const [name, setName] = useState(c.name)
  const [myth, setMyth] = useState(c.myth)
  return (
    <div className="culture-edit">
      <CultureSeal culture={c.key} theme={theme} top={c.name.toUpperCase()} bottom={theme.toUpperCase()} size={64} />
      <div>
        <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={`Nombre de la cultura ${c.name}`} disabled={locked} />
        <input value={myth} maxLength={160} onChange={(e) => setMyth(e.target.value)} aria-label={`Descripción de ${c.name}`} disabled={locked} />
        {!locked && (name.trim() !== c.name || myth.trim() !== c.myth) && <button type="button" disabled={busy} onClick={() => onSave(c.key, name, myth)}>Guardar</button>}
        {!locked && <button type="button" className="ghost danger" disabled={busy} onClick={() => onRemove(c.key, c.name)}>Quitar</button>}
      </div>
    </div>
  )
}
