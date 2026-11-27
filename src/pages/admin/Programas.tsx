import { ArrowRightLeft, Compass, GraduationCap, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadCatalog, type CareerRow, type GroupRow } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'
import PageTitle from './PageTitle'

export interface ThemeItem {
  key: string
  name: string
  uses: number // how many carreras were created with it
}

const slugTheme = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// «Carreras y temáticas»: the two lists the rest of the app takes from.
//  * Carreras: the engineerings of the university, in groups (today five). A career belongs to ONE group; it can be moved, renamed or added.
//  * Temáticas: only the NAMES of the themes. When a carrera is created one of them is chosen; the subthemes of each group and their seals are
//    made inside that carrera (Preparación → Temática).
export default function Programas() {
  useCatalogVersion()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [careers, setCareers] = useState<CareerRow[]>([])
  const [themes, setThemes] = useState<ThemeItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const tab = params.get('vista') === 'tematicas' ? 'themes' : 'careers'

  const load = useCallback(async () => {
    if (!supabase) return
    const [g, c, t, used] = await Promise.all([
      supabase.from('career_groups').select('id, name, sort_order').order('sort_order'),
      supabase.from('careers').select('id, name, group_id').order('name'),
      supabase.from('themes').select('key, name').is('term_id', null).eq('is_global', false).order('name'),
      supabase.from('themes').select('template_of').not('template_of', 'is', null),
    ])
    if (g.error) return setError('Falta aplicar la migración 0035.')
    setGroups((g.data ?? []) as GroupRow[])
    setCareers((c.data ?? []) as CareerRow[])
    const count = new Map<string, number>()
    for (const u of (used.data ?? []) as { template_of: string }[]) count.set(u.template_of, (count.get(u.template_of) ?? 0) + 1)
    setThemes(((t.data ?? []) as { key: string; name: string }[]).map((x) => ({ ...x, uses: count.get(x.key) ?? 0 })))
    await loadCatalog()
  }, [])
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
  const must = async (p: PromiseLike<{ error: { message: string } | null }>, msg: string, repeated = 'Ya existe uno con ese nombre.') => {
    const { error: err } = await p
    if (err) throw new Error(/duplicate|unique/i.test(err.message) ? repeated : msg)
  }

  return (
    <ProgramasView
      groups={groups}
      careers={careers}
      themes={themes}
      busy={busy}
      error={error}
      tab={tab}
      onTab={(next) => setParams(next === 'themes' ? { vista: 'tematicas' } : {}, { replace: true })}
      onAddGroup={(name) => supabase && void run(() => must(supabase!.from('career_groups').insert({ name, sort_order: groups.length + 1 }), 'No se pudo crear el grupo.', 'Ya existe un grupo con ese nombre.'))}
      onRenameGroup={(g, name) => supabase && void run(() => must(supabase!.from('career_groups').update({ name }).eq('id', g.id), 'No se pudo cambiar el nombre del grupo.', 'Ya existe un grupo con ese nombre.'))}
      onRemoveGroup={async (g) => {
        if (!supabase) return
        if (careers.some((c) => c.group_id === g.id)) return setError('Primero pasa sus carreras a otro grupo.')
        if (!(await confirmDialog({ title: `¿Borrar el grupo ${g.name}?`, confirmLabel: 'Borrar grupo', tone: 'danger', icon: 'trash' }))) return
        void run(() => must(supabase!.from('career_groups').delete().eq('id', g.id), 'No se pudo borrar el grupo.'))
      }}
      onAddCareer={(g, name) => supabase && void run(() => must(supabase!.from('careers').insert({ name, group_id: g.id }), 'No se pudo agregar la carrera.', 'Ya existe una carrera con ese nombre.'))}
      onRenameCareer={(c, name) =>
        supabase && void run(async () => {
          const { error: err } = await supabase!.rpc('rename_career', { p_id: c.id, p_name: name })
          if (!err) return
          if (/rename_career|schema cache/i.test(err.message)) throw new Error('Falta aplicar la migración 0048 (cambiar el nombre de una carrera).')
          throw new Error(/duplicate|unique/i.test(err.message) ? 'Ya existe una carrera con ese nombre.' : err.message || 'No se pudo cambiar el nombre.')
        })
      }
      onMoveCareer={(c, groupId) => supabase && void run(() => must(supabase!.from('careers').update({ group_id: groupId }).eq('id', c.id), 'No se pudo mover la carrera.'))}
      onRemoveCareer={async (c) => {
        if (!supabase) return
        if (!(await confirmDialog({ title: `¿Quitar la carrera ${c.name}?`, message: 'Los inductores ya registrados la conservan.', confirmLabel: 'Quitar carrera', tone: 'danger', icon: 'trash' }))) return
        void run(() => must(supabase!.from('careers').delete().eq('id', c.id), 'No se pudo quitar la carrera.'))
      }}
      onAddTheme={(name) => {
        const key = slugTheme(name)
        if (!supabase || key.length < 2) return setError('El nombre necesita al menos 2 letras.')
        void run(() => must(supabase!.from('themes').insert({ key, name }), 'No se pudo crear la temática.', 'Ya existe una temática con ese nombre.'))
      }}
      onRenameTheme={(t, name) => supabase && void run(() => must(supabase!.from('themes').update({ name }).eq('key', t.key), 'No se pudo cambiar el nombre de la temática.', 'Ya existe una temática con ese nombre.'))}
      onRemoveTheme={async (t) => {
        if (!supabase) return
        if (!(await confirmDialog({ title: `¿Borrar la temática ${t.name}?`, message: 'Las carreras que ya se crearon con ella conservan su propia temática.', confirmLabel: 'Borrar temática', tone: 'danger', icon: 'trash' }))) return
        void run(() => must(supabase!.from('themes').delete().eq('key', t.key), 'No se pudo borrar la temática.'))
      }}
    />
  )
}

interface ViewProps {
  groups: GroupRow[]
  careers: CareerRow[]
  themes: ThemeItem[]
  busy: boolean
  error: string | null
  tab: 'careers' | 'themes'
  onTab: (tab: 'careers' | 'themes') => void
  onAddGroup: (name: string) => void
  onRenameGroup: (g: GroupRow, name: string) => void
  onRemoveGroup: (g: GroupRow) => void
  onAddCareer: (g: GroupRow, name: string) => void
  onRenameCareer: (c: CareerRow, name: string) => void
  onMoveCareer: (c: CareerRow, groupId: string) => void
  onRemoveCareer: (c: CareerRow) => void
  onAddTheme: (name: string) => void
  onRenameTheme: (t: ThemeItem, name: string) => void
  onRemoveTheme: (t: ThemeItem) => void
}

export function ProgramasView(p: ViewProps) {
  return (
    <>
      <PageTitle>Carreras y temáticas</PageTitle>
      {p.error && <p className="error" role="alert">{p.error}</p>}

      <div className="catalog-tabs" role="tablist" aria-label="Qué quieres ver">
        <button type="button" role="tab" aria-selected={p.tab === 'careers'} className={`action-tab${p.tab === 'careers' ? ' on' : ''}`} onClick={() => p.onTab('careers')}>
          <GraduationCap size={20} aria-hidden="true" />
          <span><strong>Carreras</strong><small>{plural(p.careers.length, 'carrera', 'carreras')} en {plural(p.groups.length, 'grupo', 'grupos')}</small></span>
        </button>
        <button type="button" role="tab" aria-selected={p.tab === 'themes'} className={`action-tab${p.tab === 'themes' ? ' on' : ''}`} onClick={() => p.onTab('themes')}>
          <Palette size={20} aria-hidden="true" />
          <span><strong>Temáticas</strong><small>{plural(p.themes.length, 'temática', 'temáticas')}</small></span>
        </button>
      </div>

      {p.tab === 'careers' ? <CareersTab {...p} /> : <ThemesTab {...p} />}
    </>
  )
}

function Hint({ children }: { children: string }) {
  return (
    <p className="catalog-hint">
      <Compass size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

// ---------- carreras ----------

function CareersTab({ groups, careers, busy, onAddGroup, onRenameGroup, onRemoveGroup, onAddCareer, onRenameCareer, onMoveCareer, onRemoveCareer }: ViewProps) {
  const [newGroup, setNewGroup] = useState('')
  const submitGroup = (e: FormEvent) => {
    e.preventDefault()
    if (!newGroup.trim()) return
    onAddGroup(newGroup.trim())
    setNewGroup('')
  }
  return (
    <>
      <Hint>Cada carrera de ingeniería está en un solo grupo. Puedes mover una carrera a otro grupo, cambiarle el nombre o agregar una nueva si llega alguna. Los grupos reciben su subtemática dentro de cada carrera (la competencia).</Hint>
      <div className="catalog-groups">
        {groups.map((g) => (
          <GroupCard key={g.id} g={g} groups={groups} mine={careers.filter((c) => c.group_id === g.id)} busy={busy} onRename={onRenameGroup} onRemove={onRemoveGroup} onAddCareer={onAddCareer} onRenameCareer={onRenameCareer} onMoveCareer={onMoveCareer} onRemoveCareer={onRemoveCareer} />
        ))}
        <form className="card group-add" onSubmit={submitGroup}>
          <h2>Un grupo nuevo</h2>
          <label className="inline-field">
            <span>Nombre</span>
            <input value={newGroup} maxLength={40} onChange={(e) => setNewGroup(e.target.value)} placeholder="Arquitectura" disabled={busy} />
          </label>
          <button disabled={busy || !newGroup.trim()}><Plus size={18} aria-hidden="true" /> Agregar grupo</button>
        </form>
      </div>
    </>
  )
}

type Editing = { id: string; mode: 'rename' | 'move' } | null

interface CardProps {
  g: GroupRow
  groups: GroupRow[]
  mine: CareerRow[]
  busy: boolean
  onRename: ViewProps['onRenameGroup']
  onRemove: ViewProps['onRemoveGroup']
  onAddCareer: ViewProps['onAddCareer']
  onRenameCareer: ViewProps['onRenameCareer']
  onMoveCareer: ViewProps['onMoveCareer']
  onRemoveCareer: ViewProps['onRemoveCareer']
}

function GroupCard({ g, groups, mine, busy, onRename, onRemove, onAddCareer, onRenameCareer, onMoveCareer, onRemoveCareer }: CardProps) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(g.name)
  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState('')
  const [adding, setAdding] = useState('')
  const others = groups.filter((x) => x.id !== g.id)

  const saveGroup = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && name.trim() !== g.name) onRename(g, name.trim())
    setRenaming(false)
  }
  const startRename = (c: CareerRow) => {
    setEditing({ id: c.id, mode: 'rename' })
    setDraft(c.name)
  }
  const startMove = (c: CareerRow) => {
    setEditing({ id: c.id, mode: 'move' })
    setTarget(others[0]?.id ?? '')
  }
  const saveCareer = (e: FormEvent, c: CareerRow) => {
    e.preventDefault()
    if (editing?.mode === 'rename' && draft.trim() && draft.trim() !== c.name) onRenameCareer(c, draft.trim())
    if (editing?.mode === 'move' && target) onMoveCareer(c, target)
    setEditing(null)
  }
  const addCareer = (e: FormEvent) => {
    e.preventDefault()
    if (!adding.trim()) return
    onAddCareer(g, adding.trim())
    setAdding('')
  }

  return (
    <section className="card group-card">
      <header className="group-card-head">
        {renaming ? (
          <form className="row-edit grow" onSubmit={saveGroup}>
            <input value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} aria-label={`Nombre del grupo ${g.name}`} />
            <button disabled={busy || !name.trim()}>Guardar</button>
            <button type="button" className="btn-danger" onClick={() => { setRenaming(false); setName(g.name) }}>Cancelar</button>
          </form>
        ) : (
          <>
            <div className="group-title grow">
              <h2>{g.name}</h2>
              <span className="badge">{plural(mine.length, 'carrera', 'carreras')}</span>
            </div>
            <span className="row-actions">
              <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => setRenaming(true)} aria-label={`Cambiar el nombre del grupo ${g.name}`} title="Cambiar el nombre"><Pencil size={18} /></button>
              <button type="button" className="ghost danger icon-btn" disabled={busy || mine.length > 0} onClick={() => onRemove(g)} aria-label={`Borrar el grupo ${g.name}`} title={mine.length > 0 ? 'Primero pasa sus carreras a otro grupo' : 'Borrar el grupo'}><Trash2 size={18} /></button>
            </span>
          </>
        )}
      </header>

      <ul className="career-list">
        {mine.map((c) => (
          <li key={c.id} className={editing?.id === c.id ? 'is-editing' : undefined}>
            {editing?.id === c.id ? (
              <form className="row-edit" onSubmit={(e) => saveCareer(e, c)}>
                {editing.mode === 'rename' ? (
                  <input value={draft} maxLength={60} autoFocus onChange={(e) => setDraft(e.target.value)} aria-label={`Nombre de la carrera ${c.name}`} />
                ) : (
                  <>
                    <span className="career-name">{c.name} <small className="muted">pasa a…</small></span>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={`Nuevo grupo de ${c.name}`}>
                      {others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </>
                )}
                <button disabled={busy || (editing.mode === 'rename' ? !draft.trim() : !target)}>{editing.mode === 'rename' ? 'Guardar' : 'Mover'}</button>
                <button type="button" className="btn-danger" onClick={() => setEditing(null)}>Cancelar</button>
              </form>
            ) : (
              <>
                <span className="career-name">{c.name}</span>
                <span className="row-actions">
                  <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => startRename(c)} aria-label={`Cambiar el nombre de ${c.name}`} title="Cambiar el nombre"><Pencil size={18} /></button>
                  <button type="button" className="ghost icon-btn" disabled={busy || others.length === 0} onClick={() => startMove(c)} aria-label={`Mover ${c.name} a otro grupo`} title="Mover a otro grupo"><ArrowRightLeft size={18} /></button>
                  <button type="button" className="ghost danger icon-btn" disabled={busy} onClick={() => onRemoveCareer(c)} aria-label={`Quitar ${c.name}`} title="Quitar la carrera"><Trash2 size={18} /></button>
                </span>
              </>
            )}
          </li>
        ))}
        {mine.length === 0 && <li className="career-empty">Sin carreras todavía</li>}
      </ul>

      <form className="row-edit career-add" onSubmit={addCareer}>
        <input value={adding} maxLength={60} onChange={(e) => setAdding(e.target.value)} placeholder="Nueva carrera" aria-label={`Agregar una carrera a ${g.name}`} disabled={busy} />
        <button disabled={busy || !adding.trim()}><Plus size={18} aria-hidden="true" /> Agregar</button>
      </form>
    </section>
  )
}

// ---------- temáticas ----------

function ThemesTab({ themes, busy, onAddTheme, onRenameTheme, onRemoveTheme }: ViewProps) {
  const [newTheme, setNewTheme] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!newTheme.trim()) return
    onAddTheme(newTheme.trim())
    setNewTheme('')
  }
  return (
    <>
      <Hint>Aquí solo van los nombres de las temáticas, sin sellos ni nada más. Al crear una carrera eliges una de esta lista; sus subtemáticas (una por cada grupo de carreras) y sus sellos se arman dentro de esa carrera, en Preparación → Temática.</Hint>
      <section className="card theme-card">
        <form className="row-edit theme-add" onSubmit={submit}>
          <input value={newTheme} maxLength={40} onChange={(e) => setNewTheme(e.target.value)} placeholder="Una temática nueva, por ejemplo: Casas de Harry Potter" aria-label="Nombre de la temática nueva" disabled={busy} />
          <button disabled={busy || !newTheme.trim()}><Plus size={18} aria-hidden="true" /> Agregar temática</button>
        </form>
        <ul className="career-list theme-list">
          {themes.map((t) => (
            <li key={t.key} className={editing === t.key ? 'is-editing' : undefined}>
              {editing === t.key ? (
                <form className="row-edit" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && draft.trim() !== t.name) onRenameTheme(t, draft.trim()); setEditing(null) }}>
                  <input value={draft} maxLength={40} autoFocus onChange={(e) => setDraft(e.target.value)} aria-label={`Nombre de la temática ${t.name}`} />
                  <button disabled={busy || !draft.trim()}>Guardar</button>
                  <button type="button" className="btn-danger" onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <span className="career-name theme-name">{t.name}</span>
                  <span className="badge">{t.uses === 0 ? 'Sin usar' : `En ${plural(t.uses, 'carrera', 'carreras')}`}</span>
                  <span className="row-actions">
                    <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => { setEditing(t.key); setDraft(t.name) }} aria-label={`Cambiar el nombre de ${t.name}`} title="Cambiar el nombre"><Pencil size={18} /></button>
                    <button type="button" className="ghost danger icon-btn" disabled={busy} onClick={() => onRemoveTheme(t)} aria-label={`Borrar ${t.name}`} title="Borrar la temática"><Trash2 size={18} /></button>
                  </span>
                </>
              )}
            </li>
          ))}
          {themes.length === 0 && <li className="career-empty">Todavía no hay temáticas: agrega la primera para poder crear una carrera.</li>}
        </ul>
      </section>
    </>
  )
}
