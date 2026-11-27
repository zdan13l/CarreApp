import { ArrowRightLeft, Check, GraduationCap, Palette, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { loadCatalog, type CareerRow, type GroupRow } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import { loadTemplates, type TemplateUse } from '../../lib/themeUse'
import { errMsg } from './AdminContext'
import PageTitle from './PageTitle'

export type ThemeItem = TemplateUse

const slugTheme = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
/** Each group and each theme has its own ink (the same five of the stamps), in order, so the lists are told apart at a glance. */
const accent = (i: number): CSSProperties => ({ ['--accent' as string]: `var(--ink-${(i % 5) + 1})` })

// «Carreras y temáticas»: the two lists the rest of the app takes from.
//  * Carreras: the engineerings of the university, in groups (today five). A career belongs to ONE group; it can be moved, renamed or added.
//  * Temáticas: only the NAMES of the themes. When a carrera is created one of them is chosen, and a theme belongs to ONE carrera (0049); the
//    subthemes of each group and their seals are made inside that carrera (Preparación → Temática).
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
    const [g, c, t] = await Promise.all([
      supabase.from('career_groups').select('id, name, sort_order').order('sort_order'),
      supabase.from('careers').select('id, name, group_id').order('name'),
      loadTemplates(),
    ])
    if (g.error) return setError('Falta aplicar la migración 0035.')
    setGroups((g.data ?? []) as GroupRow[])
    setCareers((c.data ?? []) as CareerRow[])
    setThemes(t ?? [])
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
        if (!(await confirmDialog({ title: `¿Borrar la temática ${t.name}?`, message: t.usedBy ? `La ${t.usedBy} conserva su propia temática.` : undefined, confirmLabel: 'Borrar temática', tone: 'danger', icon: 'trash' }))) return
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
  const free = p.themes.filter((t) => !t.usedBy).length
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
          <span><strong>Temáticas</strong><small>{plural(p.themes.length, 'temática', 'temáticas')} · {plural(free, 'libre', 'libres')}</small></span>
        </button>
      </div>

      {p.tab === 'careers' ? <CareersTab {...p} /> : <ThemesTab {...p} />}
    </>
  )
}

/** The two small controls that end every inline edit: a gold check to save and a red cross to cancel. */
function EditButtons({ busy, disabled, save, cancel, onCancel }: { busy: boolean; disabled?: boolean; save: string; cancel: string; onCancel: () => void }) {
  return (
    <span className="edit-buttons">
      <button className="mini" disabled={busy || disabled} aria-label={save} title={save}><Check size={17} aria-hidden="true" /></button>
      <button type="button" className="mini btn-danger" onClick={onCancel} aria-label={cancel} title={cancel}><X size={17} aria-hidden="true" /></button>
    </span>
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
      <form className="card catalog-add" onSubmit={submitGroup}>
        <input value={newGroup} maxLength={40} onChange={(e) => setNewGroup(e.target.value)} placeholder="Un grupo nuevo" aria-label="Nombre del grupo nuevo" disabled={busy} />
        <button disabled={busy || !newGroup.trim()}><Plus size={18} aria-hidden="true" /> Agregar grupo</button>
      </form>
      <div className="catalog-groups">
        {groups.map((g, i) => (
          <GroupCard key={g.id} index={i} g={g} groups={groups} mine={careers.filter((c) => c.group_id === g.id)} busy={busy} onRename={onRenameGroup} onRemove={onRemoveGroup} onAddCareer={onAddCareer} onRenameCareer={onRenameCareer} onMoveCareer={onMoveCareer} onRemoveCareer={onRemoveCareer} />
        ))}
      </div>
    </>
  )
}

type Editing = { id: string; mode: 'rename' | 'move' } | null

interface CardProps {
  index: number
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

function GroupCard({ index, g, groups, mine, busy, onRename, onRemove, onAddCareer, onRenameCareer, onMoveCareer, onRemoveCareer }: CardProps) {
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
    <section className="card group-card" style={accent(index)}>
      <header className="group-card-head">
        <span className="ink-seal" aria-hidden="true">{g.name.trim().charAt(0).toUpperCase()}</span>
        {renaming ? (
          <form className="row-edit grow" onSubmit={saveGroup}>
            <input value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} aria-label={`Nombre del grupo ${g.name}`} />
            <EditButtons busy={busy} disabled={!name.trim()} save="Guardar" cancel="Cancelar" onCancel={() => { setRenaming(false); setName(g.name) }} />
          </form>
        ) : (
          <>
            <div className="group-title grow">
              <h2>{g.name}</h2>
              <span className="badge">{plural(mine.length, 'carrera', 'carreras')}</span>
            </div>
            <span className="row-actions">
              <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => setRenaming(true)} aria-label={`Cambiar el nombre del grupo ${g.name}`} title="Editar"><Pencil size={18} /></button>
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
                    <span className="career-name">{c.name} <small className="muted">pasa a</small></span>
                    <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label={`Nuevo grupo de ${c.name}`}>
                      {others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </>
                )}
                <EditButtons busy={busy} disabled={editing.mode === 'rename' ? !draft.trim() : !target} save={editing.mode === 'rename' ? 'Guardar' : 'Mover'} cancel="Cancelar" onCancel={() => setEditing(null)} />
              </form>
            ) : (
              <>
                <span className="career-name">{c.name}</span>
                <span className="row-actions">
                  <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => startRename(c)} aria-label={`Cambiar el nombre de ${c.name}`} title="Editar"><Pencil size={17} /></button>
                  <button type="button" className="ghost icon-btn" disabled={busy || others.length === 0} onClick={() => startMove(c)} aria-label={`Mover ${c.name} a otro grupo`} title="Mover"><ArrowRightLeft size={17} /></button>
                  <button type="button" className="ghost danger icon-btn" disabled={busy} onClick={() => onRemoveCareer(c)} aria-label={`Quitar ${c.name}`} title="Eliminar"><Trash2 size={17} /></button>
                </span>
              </>
            )}
          </li>
        ))}
        {mine.length === 0 && <li className="career-empty">Sin carreras todavía</li>}
      </ul>

      <form className="row-edit career-add" onSubmit={addCareer}>
        <input value={adding} maxLength={60} onChange={(e) => setAdding(e.target.value)} placeholder="Nueva carrera" aria-label={`Agregar una carrera a ${g.name}`} disabled={busy} />
        <button className="mini add" disabled={busy || !adding.trim()} aria-label={`Agregar la carrera a ${g.name}`} title="Agregar"><Plus size={17} aria-hidden="true" /></button>
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
      <form className="card catalog-add" onSubmit={submit}>
        <input value={newTheme} maxLength={40} onChange={(e) => setNewTheme(e.target.value)} placeholder="Una temática nueva" aria-label="Nombre de la temática nueva" disabled={busy} />
        <button disabled={busy || !newTheme.trim()}><Plus size={18} aria-hidden="true" /> Agregar temática</button>
      </form>
      <ul className="theme-grid">
        {themes.map((t, i) => (
          <li key={t.key} className={`card theme-item${editing === t.key ? ' is-editing' : ''}${t.usedBy ? ' taken' : ''}`} style={accent(i)}>
            <span className="ink-seal" aria-hidden="true"><Palette size={20} /></span>
            {editing === t.key ? (
              <form className="row-edit grow" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && draft.trim() !== t.name) onRenameTheme(t, draft.trim()); setEditing(null) }}>
                <input value={draft} maxLength={40} autoFocus onChange={(e) => setDraft(e.target.value)} aria-label={`Nombre de la temática ${t.name}`} />
                <EditButtons busy={busy} disabled={!draft.trim()} save="Guardar" cancel="Cancelar" onCancel={() => setEditing(null)} />
              </form>
            ) : (
              <>
                <div className="theme-main grow">
                  <h2>{t.name}</h2>
                  <span className={`badge${t.usedBy ? ' warn-tone' : ' ok'}`}>{t.usedBy ? `En uso · ${t.usedBy}` : 'Libre'}</span>
                </div>
                <span className="row-actions">
                  <button type="button" className="ghost icon-btn" disabled={busy} onClick={() => { setEditing(t.key); setDraft(t.name) }} aria-label={`Cambiar el nombre de ${t.name}`} title="Editar"><Pencil size={18} /></button>
                  <button type="button" className="ghost danger icon-btn" disabled={busy} onClick={() => onRemoveTheme(t)} aria-label={`Borrar ${t.name}`} title="Eliminar"><Trash2 size={18} /></button>
                </span>
              </>
            )}
          </li>
        ))}
        {themes.length === 0 && <li className="card theme-empty">Todavía no hay temáticas: agrega la primera para poder crear una carrera.</li>}
      </ul>
    </>
  )
}
