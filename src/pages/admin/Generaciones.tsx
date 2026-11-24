import { Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import EventSealView from '../../components/EventSealView'
import GenerationSeals from '../../components/GenerationSeal'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { hslToHex } from '../../lib/color'
import { pictureToInk } from '../../lib/customSeals'
import { confirmDialog } from '../../lib/dialog'
import { SHAPES, SHAPE_LABEL, type SealShape } from '../../lib/eventSeals'
import { generationKeyOf, type GenerationRow } from '../../lib/seals'
import { deletePhoto, photoUrl } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

type Row = GenerationRow

const COLUMNS = 'key, name, term, sort_order, kind, ink, source_file, shape, color, image_path'

// GLOBAL: the generations (Champiñones, Peluches, Barbies, Minichips, Textiles…) are permanent and belong to ALL the inducciones. Each one has a
// seal that can be edited here (shape, colour, picture) and that every passport shows; a person is placed in a generation by CHOOSING it in
// Inductores, never by writing it.
export default function Generaciones() {
  useCatalogVersion()
  const [rows, setRows] = useState<Row[]>([])
  const [people, setPeople] = useState<Map<string, number>>(new Map())
  const [open, setOpen] = useState<string | null>(null)
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
          <p className="eyebrow">Administración global</p>
          <h1>Generaciones</h1>
        </div>
        <p className="head-meta">Son permanentes y de todas las inducciones. Cada una tiene su sello (se puede cambiar) y a cada persona se le elige su generación en Inductores.</p>
      </header>
      {missing && <p className="error">Falta aplicar la migración 0039 (Generaciones) en Supabase.</p>}
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Las generaciones</h2>
        <ul className="list gen-list">
          {rows.map((r, i) => {
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
                  <button type="button" className="ghost" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>{open === r.key ? 'Cerrar' : 'Editar el sello'}</button>
                  {n === 0 && <button type="button" className="ghost danger" disabled={busy} onClick={() => void remove(r)}>Borrar</button>}
                </div>
                {open === r.key && (
                  <SealEditor
                    key={r.key}
                    row={r}
                    defaultColor={hslToHex((i * 53 + 15) % 360, 62, 40)}
                    onDone={async (msg) => {
                      setError(msg)
                      if (!msg) setOpen(null)
                      await refresh()
                    }}
                  />
                )}
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

// Edits the seal of one generation: shape, colour and picture. Without an edit the app's own seal stays. Saving keeps the picture the app brings
// when none is uploaded.
function SealEditor({ row, defaultColor, onDone }: { row: Row; defaultColor: string; onDone: (error: string | null) => Promise<void> }) {
  const [shape, setShape] = useState<SealShape>((row.shape as SealShape | null) ?? 'circle')
  const [color, setColor] = useState(row.color ?? defaultColor)
  const [file, setFile] = useState<File | null>(null)
  const [invert, setInvert] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    if (!file) {
      setPreview(null)
      return
    }
    void pictureToInk(file, invert, 256)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => setPreview(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, invert])

  const ownImage = row.image_path ? photoUrl(row.image_path) : null
  const shownImage = preview ?? (removeImage ? null : (ownImage ?? (row.source_file || null)))

  async function save() {
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    let uploaded: string | null = null
    try {
      let image_path = row.image_path
      if (file) {
        const blob = await pictureToInk(file, invert)
        const path = `generations/${crypto.randomUUID()}.png`
        const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/png', cacheControl: '31536000' })
        if (up.error) throw new Error('No se pudo subir la imagen (máximo 2 MB).')
        image_path = path
        uploaded = path
      } else if (removeImage) image_path = null
      const { error } = await supabase.from('generations').update({ shape, color, image_path }).eq('key', row.key)
      if (error) throw new Error('No se pudo guardar el sello.')
      if (row.image_path && row.image_path !== image_path) await deletePhoto(row.image_path)
      await onDone(null)
    } catch (e) {
      if (uploaded) await deletePhoto(uploaded)
      setMsg(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  async function reset() {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Volver al sello de siempre de ${row.name}?`, message: 'Se descarta la forma, el color y la imagen que le pusiste.', confirmLabel: 'Volver al de siempre', tone: 'danger', icon: 'trash' }))) return
    setBusy(true)
    const { error } = await supabase.from('generations').update({ shape: null, color: null, image_path: null }).eq('key', row.key)
    if (!error) await deletePhoto(row.image_path)
    setBusy(false)
    await onDone(error ? 'No se pudo volver al sello de siempre.' : null)
  }

  return (
    <div className="seal-editor">
      <EventSealView shape={shape} color={color} imageUrl={shownImage} initial={row.name} size={132} label="Previsualización del sello" />
      <div className="seal-fields">
        <label className="inline-field">
          Forma
          <select value={shape} onChange={(e) => setShape(e.target.value as SealShape)}>
            {SHAPES.map((s) => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="btn-like">
          <Upload size={16} aria-hidden="true" /> {file ? file.name : row.image_path ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false) }} />
        </label>
        {(file || row.image_path) && (
          <>
            <label className="inline-field"><span><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Dibujo claro sobre fondo oscuro (invertir)</span></label>
            <button type="button" className="ghost" onClick={() => { setFile(null); setRemoveImage(true) }}>Quitar imagen</button>
          </>
        )}
        {msg && <p className="error">{msg}</p>}
        <div className="row">
          <button disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar sello'}</button>
          {row.shape && <button type="button" className="ghost danger" disabled={busy} onClick={() => void reset()}>Volver al de siempre</button>}
        </div>
      </div>
    </div>
  )
}
