import { MapPin, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import BaseLocationEditor from '../../components/BaseLocationEditor'
import PhotoField from '../../components/PhotoField'
import Stamp from '../../components/Stamp'
import { airportCode } from '../../lib/flight'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { registerSealRoster } from '../../lib/seals'
import { supabase } from '../../lib/supabase'
import { infoOf, MAX_QUESTIONS, MIN_QUESTIONS, type BaseRow, type Profile } from '../../types'
import { errMsg, useAdmin } from './AdminContext'
import { confirmDialog } from '../../lib/dialog'

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
    const sb = supabase
    const readBases = (withAnswers: boolean) =>
      withAnswers
        ? sb
            .from('bases')
            .select('id, name, location_photo_path, lat, lng, sort_order, base_details(info), base_questions(position, question, answer), base_staff(user_id)')
            .eq('event_id', eventId)
            .order('sort_order')
            .order('name')
        : sb
            .from('bases')
            .select('id, name, location_photo_path, lat, lng, sort_order, base_details(info), base_questions(position, question), base_staff(user_id)')
            .eq('event_id', eventId)
            .order('sort_order')
            .order('name')
    const [first, p] = await Promise.all([
      readBases(true),
      supabase.from('profiles').select('id, username, full_name, role').eq('role', 'base').eq('event_id', eventId).order('full_name'),
    ])
    const b = first.error && /answer|column|schema cache/i.test(first.error.message) ? await readBases(false) : first // migration 0030 is not applied yet
    registerSealRoster((b.data ?? []).map((x) => x.id))
    setBases(b.data ?? [])
    setStaff(p.data ?? [])
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  if (!event) return <p className="warn">Primero crea una carrera en la pestaña "Carrera".</p>

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
      <p className="eyebrow">Gate Management</p>
      <h1>Puertas</h1>
      <p className="muted">{bases.length} bases (destinos) en {event.name}. Cada una tiene su código de aeropuerto y su propio sello.</p>

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
  const savedQuestions = [...base.base_questions].sort((x, y) => x.position - y.position).map((q) => ({ question: q.question, answer: q.answer ?? '' }))
  const initialQuestions = [...savedQuestions, ...Array.from({ length: Math.max(0, MIN_QUESTIONS - savedQuestions.length) }, () => ({ question: '', answer: '' }))]
  const [name, setName] = useState(base.name)
  const [info, setInfo] = useState(infoOf(base.base_details) ?? '')
  const [questions, setQuestions] = useState<{ question: string; answer: string }[]>(initialQuestions)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showMap, setShowMap] = useState(false) // a Mapbox map per card would exhaust the browser's WebGL contexts

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
      for (let i = 0; i < MAX_QUESTIONS; i++) {
        const position = i + 1
        const text = questions[i]?.question.trim() ?? ''
        const answer = questions[i]?.answer.trim() || null
        let res = text
          ? await sb.from('base_questions').upsert({ base_id: base.id, position, question: text, answer }, { onConflict: 'base_id,position' })
          : await sb.from('base_questions').delete().eq('base_id', base.id).eq('position', position)
        if (res.error && text && /answer|column|schema cache/i.test(res.error.message)) {
          res = await sb.from('base_questions').upsert({ base_id: base.id, position, question: text }, { onConflict: 'base_id,position' }) // migration 0030 is not applied yet
        }
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

  const remove = async () => {
    if (!(await confirmDialog({ title: `¿Eliminar la base "${base.name}"?`, message: 'Se borran también sus cruces y los puntos registrados.', confirmLabel: 'Eliminar base', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      const { error: err } = await sb.from('bases').delete().eq('id', base.id)
      if (err) throw new Error('No se pudo eliminar la base.')
      await deletePhoto(base.location_photo_path)
    })
  }

  const available = staff.filter((p) => !taken.has(p.id))

  return (
    <section className="card">
      <div className="base-stamp">
        <Stamp seed={base.id} name={base.name} photoPath={base.location_photo_path} round={0} state="stamped" size={84} straight />
        <p>
          <strong>Destino <span className="mono gate-code">{airportCode(base.name)}</span></strong>
          Así es su sello en el pasaporte de los grupos. Sale de la foto del lugar.
        </p>
      </div>
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
          <legend>Posibles preguntas (mínimo {MIN_QUESTIONS}, cada una con su respuesta)</legend>
          {questions.map((q, i) => (
            <div key={i} className="question-pair">
              <input
                value={q.question}
                placeholder={`Pregunta ${i + 1}`}
                maxLength={300}
                aria-label={`Pregunta ${i + 1}`}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
              />
              <input
                value={q.answer}
                placeholder={`Respuesta a la pregunta ${i + 1}`}
                maxLength={600}
                aria-label={`Respuesta a la pregunta ${i + 1}`}
                onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              />
            </div>
          ))}
          {questions.length < MAX_QUESTIONS && (
            <button className="ghost" type="button" onClick={() => setQuestions([...questions, { question: '', answer: '' }])}>
              Agregar una pregunta
            </button>
          )}
          {questions.filter((q) => q.question.trim() && q.answer.trim()).length < MIN_QUESTIONS && (
            <p className="muted">Faltan {MIN_QUESTIONS - questions.filter((q) => q.question.trim() && q.answer.trim()).length} preguntas con su respuesta para poder activar la carrera.</p>
          )}
        </fieldset>
        <button disabled={busy || !name.trim()} onClick={() => void save()}>Guardar base</button>
        {saved && <p className="ok-text">Guardado.</p>}
      </div>

      <h3>Ubicación en el mapa</h3>
      <p className="muted">{base.lat !== null && base.lng !== null ? 'Ubicación marcada.' : 'Todavía sin ubicación.'}</p>
      <button className="ghost" type="button" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
        <MapPin size={18} aria-hidden="true" />
        {showMap ? 'Ocultar el mapa' : base.lat !== null ? 'Ver o cambiar en el mapa' : 'Marcar en el mapa'}
      </button>
      {showMap && <BaseLocationEditor compact baseId={base.id} name={base.name} lat={base.lat} lng={base.lng} onSaved={onChange} />}

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
