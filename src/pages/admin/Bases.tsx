import { Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import BaseLocationEditor from '../../components/BaseLocationEditor'
import PhotoField from '../../components/PhotoField'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { infoOf, type BaseRow, type Profile } from '../../types'
import { errMsg, useAdmin } from './AdminContext'

export default function Bases() {
  const { event } = useAdmin()
  const [bases, setBases] = useState<BaseRow[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventId = event?.id

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [b, p] = await Promise.all([
      supabase
        .from('bases')
        .select('id, name, location_photo_path, lat, lng, sort_order, base_details(info), base_questions(position, question), base_staff(user_id)')
        .eq('event_id', eventId)
        .order('sort_order')
        .order('name'),
      supabase.from('profiles').select('id, username, full_name, role').eq('role', 'base').order('full_name'),
    ])
    setBases(b.data ?? [])
    setStaff(p.data ?? [])
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  if (!event) return <p className="warn">Primero crea una Carrera en "Resumen".</p>

  async function addBase(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !eventId || !name.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('bases')
      .insert({ event_id: eventId, name: name.trim(), sort_order: bases.length })
    setBusy(false)
    if (err) {
      setError(err.message.includes('duplicate') ? 'Ya existe una base con ese nombre.' : 'No se pudo crear la base.')
      return
    }
    setName('')
    await load()
  }

  // An inductor can staff only one base per Carrera: hide those already assigned anywhere.
  const taken = new Set(bases.flatMap((b) => b.base_staff.map((s) => s.user_id)))

  return (
    <>
      <h1>Bases</h1>
      <p className="muted">{bases.length} bases en {event.name}</p>

      <section className="card">
        <h2>Agregar base</h2>
        <form className="form" onSubmit={addBase}>
          <label>
            Nombre de la base
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !name.trim()}>Agregar base</button>
        </form>
        <p className="muted">Después completa su foto, información y 3 preguntas en la tarjeta.</p>
      </section>

      <div className="grid">
        {bases.map((b) => (
          <BaseCard key={b.id} base={b} staff={staff} taken={taken} onChange={load} />
        ))}
      </div>
    </>
  )
}

export function BaseCard({
  base,
  staff,
  taken,
  onChange,
}: {
  base: BaseRow
  staff: Profile[]
  taken: Set<string>
  onChange: () => Promise<void>
}) {
  const initialQuestions = [1, 2, 3].map((n) => base.base_questions.find((q) => q.position === n)?.question ?? '')
  const [name, setName] = useState(base.name)
  const [info, setInfo] = useState(infoOf(base.base_details) ?? '')
  const [questions, setQuestions] = useState<string[]>(initialQuestions)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const sb = supabase!

  async function run(action: () => Promise<void>, keepSaved = false) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await action()
      await onChange()
      setSaved(keepSaved)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const { error: err } = await sb.from('bases').update({ name: name.trim() }).eq('id', base.id)
      if (err) throw new Error('No se pudo guardar (¿ya existe otra base con ese nombre?).')
      const details = await sb.from('base_details').upsert({ base_id: base.id, info: info.trim() || null })
      if (details.error) throw new Error('No se pudo guardar la información de la base.')
      for (let i = 0; i < 3; i++) {
        const position = i + 1
        const text = questions[i].trim()
        const res = text
          ? await sb.from('base_questions').upsert({ base_id: base.id, position, question: text }, { onConflict: 'base_id,position' })
          : await sb.from('base_questions').delete().eq('base_id', base.id).eq('position', position)
        if (res.error) throw new Error('No se pudieron guardar las preguntas.')
      }
    }, true)

  const changePhoto = (file: File) =>
    run(async () => {
      const path = await uploadPhoto('bases', file)
      const { error: err } = await sb.from('bases').update({ location_photo_path: path }).eq('id', base.id)
      if (err) {
        await deletePhoto(path)
        throw new Error('No se pudo guardar la foto.')
      }
      await deletePhoto(base.location_photo_path)
    })

  const addStaff = () =>
    run(async () => {
      if (!pick) return
      const { error: err } = await sb.from('base_staff').insert({ base_id: base.id, user_id: pick })
      if (err) throw new Error(err.message.includes('ya está asignado') ? 'Ese inductor ya está asignado a otra base.' : 'No se pudo asignar el inductor.')
      setPick('')
    })

  const removeStaff = (userId: string) =>
    run(async () => {
      const { error: err } = await sb.from('base_staff').delete().eq('base_id', base.id).eq('user_id', userId)
      if (err) throw new Error('No se pudo quitar el inductor.')
    })

  const remove = () => {
    if (!window.confirm(`¿Eliminar la base "${base.name}"? Se borran también sus cruces y puntos.`)) return
    void run(async () => {
      const { error: err } = await sb.from('bases').delete().eq('id', base.id)
      if (err) throw new Error('No se pudo eliminar la base.')
      await deletePhoto(base.location_photo_path)
    })
  }

  const available = staff.filter((p) => !taken.has(p.id))

  return (
    <section className="card">
      <PhotoField path={base.location_photo_path} label={`Dónde queda ${base.name}`} busy={busy} onPick={(f) => void changePhoto(f)} />

      <div className="form">
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <label>
          Información que se da en la base
          <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={4} maxLength={1500} />
        </label>
        <fieldset>
          <legend>3 posibles preguntas</legend>
          {questions.map((q, i) => (
            <input
              key={i}
              value={q}
              placeholder={`Pregunta ${i + 1}`}
              maxLength={300}
              aria-label={`Pregunta ${i + 1}`}
              onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
        </fieldset>
        <button disabled={busy || !name.trim()} onClick={() => void save()}>Guardar base</button>
        {saved && <p className="ok-text">Guardado.</p>}
      </div>

      <BaseLocationEditor baseId={base.id} name={base.name} lat={base.lat} lng={base.lng} onSaved={onChange} />

      <h3>Inductores de la base</h3>
      {base.base_staff.length === 0 && <p className="muted">Sin inductores asignados.</p>}
      <ul className="list">
        {base.base_staff.map((s) => {
          const p = staff.find((x) => x.id === s.user_id)
          return (
            <li key={s.user_id}>
              <span className="grow">{p ? p.full_name : 'Usuario'}</span>
              <button className="ghost icon-btn" disabled={busy} onClick={() => void removeStaff(s.user_id)} aria-label="Quitar inductor" title="Quitar inductor"><X size={18} /></button>
            </li>
          )
        })}
      </ul>
      <div className="row">
        <select className="grow" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Asignar inductor">
          <option value="">{available.length ? 'Asignar inductor…' : 'No hay inductores de base libres'}</option>
          {available.map((p) => <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>)}
        </select>
        <button disabled={busy || !pick} onClick={() => void addStaff()}>Asignar</button>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="ghost danger" disabled={busy} onClick={remove}>
        <Trash2 size={18} aria-hidden="true" />
        Eliminar base
      </button>
    </section>
  )
}
