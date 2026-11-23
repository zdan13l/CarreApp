import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import CommitteeSeal from '../../components/CommitteeSeal'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { allCommittees, type Committee } from '../../lib/committees'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20)

// The committees of the induction, kept by hand: rename them, add or remove one, and choose who coordinates each one in the open semester.
// A committee always has a coordi: the one with the golden stamp. The coordi is chosen per semester (it is a mark on the person's record of that
// semester), so changing it here never touches old passports.
export default function Comites() {
  useCatalogVersion()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newTagline, setNewTagline] = useState('')
  const [newInk, setNewInk] = useState(1)

  const load = useCallback(async () => {
    if (!supabase) return
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

  function save(c: Committee, name: string, tagline: string) {
    if (!supabase || !name.trim()) return
    void run(async () => {
      const { error: err } = await supabase!.from('committees').update({ name: name.trim(), tagline: tagline.trim() || null }).eq('key', c.key)
      if (err) throw new Error('No se pudo guardar el comité.')
    })
  }

  async function toggle(c: Committee) {
    if (!supabase) return
    if (c.active !== false && !(await confirmDialog({ title: `¿Quitar el comité ${c.name}?`, message: 'Deja de ofrecerse al registrar inductores. Los pasaportes que ya lo tienen lo conservan.', confirmLabel: 'Quitar comité', tone: 'danger', icon: 'warning' }))) return
    void run(async () => {
      const { error: err } = await supabase!.from('committees').update({ active: c.active === false }).eq('key', c.key)
      if (err) throw new Error('No se pudo cambiar el comité.')
    })
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const key = slug(newName)
    if (!supabase) return
    if (key.length < 3) return setError('El nombre necesita al menos 3 letras.')
    if (allCommittees().some((c) => c.key === key)) return setError('Ya existe un comité con ese nombre.')
    void run(async () => {
      const { error: err } = await supabase!.from('committees').insert({ key, name: newName.trim(), tagline: newTagline.trim() || null, ink: newInk, sort_order: allCommittees().length + 1 })
      if (err) throw new Error('No se pudo crear el comité.')
      setNewName('')
      setNewTagline('')
    })
  }

  const committees = allCommittees()
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Administración global</p>
          <h1>Comités</h1>
        </div>
        <p className="head-meta">El catálogo global de comités: cámbiales el nombre y la frase, agrega o quita. Qué comités participan en cada carrera y quién los coordina se elige dentro de la carrera (Coordi y comités).</p>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="committee-list">
        {committees.map((c) => {
          return (
            <section key={c.key} className={`card committee-card${c.active === false ? ' off' : ''}`}>
              <CommitteeSeal committee={c.key} size={84} label={`Sello de ${c.name}`} />
              <div className="committee-body">
                <CommitteeEditor c={c} busy={busy} onSave={save} />
                <button type="button" className="ghost" disabled={busy} onClick={() => void toggle(c)}>
                  {c.active === false ? 'Volver a ofrecer' : 'Quitar comité'}
                </button>
              </div>
            </section>
          )
        })}
      </div>

      <form className="card" onSubmit={add}>
        <h2>Agregar un comité</h2>
        <label className="inline-field">
          Nombre
          <input value={newName} maxLength={30} onChange={(e) => setNewName(e.target.value)} placeholder="Logística" />
        </label>
        <label className="inline-field">
          Frase del sello
          <input value={newTagline} maxLength={60} onChange={(e) => setNewTagline(e.target.value)} placeholder="Lo que lo define" />
        </label>
        <label className="inline-field">
          Color
          <select value={newInk} onChange={(e) => setNewInk(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Tinta {n}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button disabled={busy || !newName.trim()}>
            <Plus size={18} aria-hidden="true" /> Agregar comité
          </button>
        </div>
      </form>
    </>
  )
}

function CommitteeEditor({ c, busy, onSave }: { c: Committee; busy: boolean; onSave: (c: Committee, name: string, tagline: string) => void }) {
  const [name, setName] = useState(c.name)
  const [tagline, setTagline] = useState(c.tagline)
  const changed = name.trim() !== c.name || tagline.trim() !== c.tagline
  return (
    <div className="committee-edit">
      <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={`Nombre del comité ${c.name}`} />
      <input value={tagline} maxLength={60} onChange={(e) => setTagline(e.target.value)} aria-label={`Frase del comité ${c.name}`} placeholder="Frase del sello" />
      {changed && (
        <button type="button" disabled={busy || !name.trim()} onClick={() => onSave(c, name, tagline)}>Guardar</button>
      )}
    </div>
  )
}
