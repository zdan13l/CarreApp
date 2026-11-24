import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import GenerationSeals from '../../components/GenerationSeal'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { confirmDialog } from '../../lib/dialog'
import { workshopLink } from '../../lib/sealElements'
import { generationKeyOf, type GenerationRow } from '../../lib/seals'
import { deletePhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

type Row = GenerationRow

const COLUMNS = 'key, name, term, sort_order, kind, ink, source_file, shape, color, image_path'

// GLOBAL: the generations (Champiñones, Peluches, Barbies, Minichips, Textiles…) are permanent and belong to ALL the inducciones. Here they are
// listed, given their semester, added and removed. Their SEALS are made in the workshop (Sellos), which is the only place that creates seals; a
// person is placed in a generation by CHOOSING it in Inductores, never by writing it.
export default function Generaciones() {
  useCatalogVersion()
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Map<string, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTerm, setNewTerm] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const [g, p] = await Promise.all([supabase.from('generations').select(COLUMNS).order('sort_order').order('name'), supabase.from('passports').select('generation')])
    if (g.error) return setMissing(true)
    setMissing(false)
    setRows((g.data ?? []) as Row[])
    const count = new Map<string, number>()
    for (const r of p.data ?? []) {
      const keys = new Set(String((r as { generation: string | null }).generation ?? '').split(/[/,+]/).map(generationKeyOf).filter(Boolean))
      for (const k of keys) count.set(k, (count.get(k) ?? 0) + 1)
    }
    setPeople(count)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function refresh() {
    await load()
    await loadCatalog() // the passports and the screens read the seals from the catalog
  }
  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await refresh()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    const key = generationKeyOf(name)
    if (!supabase) return
    if (key.length < 3 || key.length > 20 || name.length > 30) return setError('El nombre necesita entre 3 y 20 letras.')
    if (newTerm && !/^\d{4}$/.test(newTerm)) return setError('El semestre son 4 números, por ejemplo 2810.')
    void run(async () => {
      const { error: err } = await supabase!.from('generations').insert({ key, name, term: newTerm || null, sort_order: (rows[rows.length - 1]?.sort_order ?? 0) + 1 })
      if (err) throw new Error(/duplicate|unique/i.test(err.message) ? 'Ya existe una generación con ese nombre.' : 'No se pudo crear la generación.')
      setNewName('')
      setNewTerm('')
    })
  }
  const setTerm = (r: Row, term: string) => {
    if (!supabase) return
    if (term && !/^\d{4}$/.test(term)) return setError('El semestre son 4 números, por ejemplo 2810.')
    void run(async () => {
      const { error: err } = await supabase!.from('generations').update({ term: term || null }).eq('key', r.key)
      if (err) throw new Error('No se pudo guardar el semestre.')
    })
  }
  async function remove(r: Row) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Borrar la generación ${r.name}?`, message: 'Nadie pertenece a ella. Se borra también su sello editado.', confirmLabel: 'Borrar', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      const { error: err } = await supabase!.from('generations').delete().eq('key', r.key)
      if (err) throw new Error(/hay personas/.test(err.message) ? 'Hay personas en esta generación: cámbialas antes de borrarla.' : 'No se pudo borrar la generación.')
      await deletePhoto(r.image_path)
    })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Generaciones</h1>
        </div>
        <p className="head-meta">Son permanentes y de todas las inducciones. Su sello se crea y se cambia en el taller de Sellos, y a cada persona se le elige su generación en Inductores.</p>
      </header>
      {missing && <p className="error">Falta aplicar la migración 0039 (Generaciones) en Supabase.</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Las generaciones</h2>
        <ul className="list gen-list">
          {rows.map((r) => {
            const n = people.get(r.key) ?? 0
            const edited = Boolean(r.shape)
            return (
              <li key={r.key} className="gen-item">
                <div className="row">
                  <span className="gen-seal"><GenerationSeals generation={r.name} size={72} /></span>
                  <span className="grow">
                    <strong>{r.name}</strong>
                    <small className="muted"> · {n === 0 ? 'nadie todavía' : n === 1 ? '1 persona' : `${n} personas`} · {edited ? 'sello editado' : r.kind ? 'sello de siempre' : 'sin sello todavía'}</small>
                  </span>
                  <label className="inline-field">
                    Entró en
                    <input defaultValue={r.term ?? ''} inputMode="numeric" maxLength={4} placeholder="2710" aria-label={`Semestre de entrada de ${r.name}`} disabled={busy} onBlur={(e) => e.target.value.trim() !== (r.term ?? '') && setTerm(r, e.target.value.trim())} />
                  </label>
                  <Link className="btn-like" to={workshopLink('generation', null, r.key)}>{edited ? 'Cambiar el sello' : r.kind ? 'Cambiar el de siempre' : 'Crear el sello'}</Link>
                  {n === 0 && <button type="button" className="ghost danger" disabled={busy} onClick={() => void remove(r)}>Borrar</button>}
                </div>
              </li>
            )
          })}
          {rows.length === 0 && !missing && <li className="muted">Cargando…</li>}
        </ul>
      </section>

      <form className="card add-person" onSubmit={add}>
        <h2>Agregar una generación</h2>
        <p className="muted">Cuando entre una generación nueva, se agrega aquí una sola vez; luego se elige en cada persona. Su nombre no se puede cambiar después.</p>
        <div className="row">
          <label className="inline-field">Nombre<input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={30} placeholder="Mariposas" required /></label>
          <label className="inline-field">Entró en<input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} inputMode="numeric" maxLength={4} placeholder="2810" /></label>
          <button disabled={busy}><Plus size={16} aria-hidden="true" /> Agregar</button>
        </div>
      </form>
    </>
  )
}
