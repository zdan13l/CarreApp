import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { deletePhotos } from '../../lib/storage'
import { deleteUser } from '../../lib/usersApi'
import { errMsg, useAdmin } from './AdminContext'
import BulkImport from './BulkImport'
import TravelTimes from './TravelTimes'
import { confirmDialog } from '../../lib/dialog'
import { exportResults } from '../../lib/results'

export interface Counts {
  teams: number
  bases: number
  users: number
  matches: number
  warnings: string[]
}

// Setup of the Carrera: its state and activation checklist, loading it from a file, the delay times
// and creating a new edition. What happens DURING the race lives in "En vivo".
export default function Carrera() {
  const { events, event, selectEvent, reload } = useAdmin()
  const [problems, setProblems] = useState<string[]>([])
  const [counts, setCounts] = useState<Counts>({ teams: 0, bases: 0, users: 0, matches: 0, warnings: [] })
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const eventId = event?.id

  const check = useCallback(async () => {
    if (!supabase || !eventId) return
    const [probs, teams, bases, users, matches] = await Promise.all([
      supabase.rpc('event_problems', { p_event: eventId }),
      supabase.from('teams').select('name, team_runners(is_gps_tracker)').eq('event_id', eventId),
      supabase.from('bases').select('name, lat, base_staff(user_id)').eq('event_id', eventId),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('event_id', eventId).neq('role', 'admin'),
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ])
    setProblems((probs.data as string[] | null) ?? [])
    const warnings: string[] = []
    for (const t of teams.data ?? []) {
      if (t.team_runners.length === 0) warnings.push(`El grupo "${t.name}" no tiene corredores.`)
      else if (!t.team_runners.some((r) => r.is_gps_tracker))
        warnings.push(`El grupo "${t.name}" no tiene corredor designado para el GPS.`)
    }
    for (const b of bases.data ?? []) {
      if (b.base_staff.length === 0) warnings.push(`La base "${b.name}" no tiene inductores asignados.`)
      if (b.lat === null) warnings.push(`La base "${b.name}" no tiene ubicación en el mapa.`)
    }
    setCounts({ teams: teams.data?.length ?? 0, bases: bases.data?.length ?? 0, users: users.count ?? 0, matches: matches.count ?? 0, warnings })
  }, [eventId])

  useEffect(() => {
    void check()
  }, [check])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await reload()
      await check()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  function createEvent(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || !supabase) return
    void run(async () => {
      const { data, error: err } = await supabase!.from('events').insert({ name }).select('id').single()
      if (err) throw new Error(err.message.includes('duplicate') ? 'Ya existe esa Carrera.' : 'No se pudo crear la Carrera.')
      selectEvent(data.id)
      setNewName('')
    })
  }

  async function activate() {
    if (!supabase || !event) return
    const previous = events.find((x) => x.is_active && x.id !== event.id)
    const msg = previous
      ? `Se desactivará "${previous.name}" y todos los teléfonos pasarán a la nueva Carrera.`
      : 'Los corredores y las bases la verán de inmediato.'
    if (!(await confirmDialog({ title: `¿Activar "${event.name}"?`, message: msg, confirmLabel: 'Activar Carrera', icon: 'check' }))) return
    void run(async () => {
      if (previous) await supabase!.from('events').update({ is_active: false }).eq('id', previous.id)
      const { error: err } = await supabase!.from('events').update({ is_active: true }).eq('id', event.id)
      if (err) {
        if (previous) await supabase!.from('events').update({ is_active: true }).eq('id', previous.id)
        throw new Error('No se pudo activar: revisa los pendientes de la lista.')
      }
    })
  }

  async function deactivate() {
    if (!supabase || !event) return
    if (!(await confirmDialog({ title: `¿Desactivar "${event.name}"?`, message: 'Los corredores y las bases dejarán de verla de inmediato y se REINICIA todo su avance: puntajes, llegadas, avisos, ubicaciones y registro de cambios. Se conservan grupos, bases, usuarios y el cronograma. Antes se descargan los resultados en un archivo.', confirmLabel: 'Descargar y desactivar', tone: 'danger', icon: 'warning' }))) return
    void run(async () => {
      if (!(await exportResults(event.id, event.name)) && !(await confirmDialog({ title: 'No se pudieron descargar los resultados', message: 'Si sigues, el avance se borra sin copia. ¿Continuar de todos modos?', confirmLabel: 'Continuar sin copia', tone: 'danger', icon: 'warning' }))) return
      const { error: err } = await supabase!.from('events').update({ is_active: false }).eq('id', event.id)
      if (err) throw new Error('No se pudo desactivar la Carrera.')
    })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Preparación</p>
          <h1>Carrera</h1>
        </div>
        <p className="head-meta">Estado y activación, carga desde un archivo, tiempos de traslado y nuevas ediciones.</p>
      </header>
      {notice && <p className="ok-box">{notice}</p>}

      <div className="live-grid">
      <div>
      {event && <PrepSteps counts={counts} problems={problems} active={event.is_active} />}
      {event && (
        <section className="card">
          <h2>{event.name}</h2>
          {events.length > 1 && (
            <label className="inline-field">
              Carrera que estás editando
              <select value={event.id} onChange={(e) => selectEvent(e.target.value)}>
                {events.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}{x.is_active ? ' (activa)' : ''}</option>
                ))}
              </select>
            </label>
          )}
          <p>
            Estado: <span className={`badge ${event.is_active ? 'ok' : 'idle'}`}>{event.is_active ? 'Activa' : 'Borrador'}</span>
          </p>
          <p className="muted">{counts.teams} grupos · {counts.bases} bases</p>

          {problems.length === 0 ? (
            <p className="ok-box">Todo completo: fotos, un usuario por grupo, información y 3 preguntas por base.</p>
          ) : (
            <div className="fail-box">
              <strong>{event.is_active ? 'Pendientes de la Carrera activa:' : 'Falta para poder activar la Carrera:'}</strong>
              <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}

          {counts.warnings.length > 0 && (
            <div className="warn">
              <strong>Recomendado revisar (no bloquea):</strong>
              <ul>{counts.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <div className="row">
            {event.is_active ? (
              <button className="ghost" disabled={busy} onClick={deactivate}>Desactivar Carrera</button>
            ) : (
              <button disabled={busy || problems.length > 0} onClick={activate}>Activar Carrera</button>
            )}
          </div>
        </section>
      )}

      <BulkImport />
      </div>

      <div>
      {event && <h2 className="section-title">Alertas de demora</h2>}
      {event && <TravelSetting key={event.id} eventId={event.id} minutes={event.max_travel_minutes} onSaved={reload} />}
      {event && <TravelTimes key={`t-${event.id}`} eventId={event.id} defaultMinutes={event.max_travel_minutes} />}

      {event && <DeleteEvent key={`d-${event.id}`} eventId={event.id} name={event.name} active={event.is_active} onDone={async (msg) => { setNotice(msg); await reload() }} />}

      <section className="card">
        <h2>{event ? 'Nueva edición de la Carrera' : 'Crea tu primera Carrera'}</h2>
        <form className="form" onSubmit={createEvent}>
          <label>
            Nombre (por ejemplo "Carrera 2027-2")
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          </label>
          <button type="submit" disabled={busy || !newName.trim()}>Crear Carrera</button>
        </form>
      </section>
      </div>
      </div>
    </>
  )
}

// Maximum time a group may take between two bases before the alerts go off.
function TravelSetting({ eventId, minutes, onSaved }: { eventId: string; minutes: number; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState(String(minutes))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const parsed = Number(value)
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 120

  async function save() {
    if (!supabase || !valid) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const { error: err } = await supabase.from('events').update({ max_travel_minutes: parsed }).eq('id', eventId)
    if (err) setError('No se pudo guardar.')
    else {
      setMessage('Guardado.')
      await onSaved()
    }
    setBusy(false)
  }

  return (
    <section className="card">
      <h2>Tiempo general de traslado</h2>
      <p className="muted">
        Si un grupo pasa más de este tiempo entre que termina una base y llega a la siguiente, suena una alerta a sus
        corredores (sonido cada 30 segundos mientras siga la demora y notificación al teléfono) y la ves en "En vivo".
        Este tiempo vale para los tramos que no tengan el suyo (abajo).
      </p>
      <div className="row">
        <label className="inline-field grow">
          Tiempo máximo general (minutos)
          <input type="number" inputMode="numeric" min={1} max={120} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        <button disabled={busy || !valid || parsed === minutes} onClick={() => void save()}>Guardar</button>
      </div>
      {!valid && <p className="error">Escribe un número entero entre 1 y 120.</p>}
      {message && <p className="ok-text">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}

// Deletes a Carrera with EVERYTHING that belongs to it, so nothing is left behind: groups, bases, schedule, scores, the
// score log, alerts, locations, times, the photos in storage and its users (runners and inductors). The database only
// accepts it when the Carrera is deactivated. It cannot be undone.
function DeleteEvent({ eventId, name, active, onDone }: { eventId: string; name: string; active: boolean; onDone: (message: string) => Promise<void> }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase()

  async function remove() {
    if (!supabase || !matches || active) return
    setBusy(true)
    setError(null)
    try {
      // Everything that points to the Carrera is listed BEFORE deleting: afterwards nothing links to it any more.
      const [people, teams, bases] = await Promise.all([
        supabase.from('profiles').select('id, photo_path').eq('event_id', eventId).neq('role', 'admin'),
        supabase.from('teams').select('photo_path').eq('event_id', eventId),
        supabase.from('bases').select('location_photo_path').eq('event_id', eventId),
      ])
      const { error: err } = await supabase.from('events').delete().eq('id', eventId)
      if (err) throw new Error(/Desactiva/.test(err.message) ? 'Desactiva la Carrera antes de eliminarla.' : 'No se pudo eliminar la Carrera.')
      let failed = 0
      for (const p of people.data ?? []) {
        try {
          await deleteUser(p.id)
        } catch {
          failed++
        }
      }
      await deletePhotos([
        ...(teams.data ?? []).map((t) => t.photo_path),
        ...(bases.data ?? []).map((b) => b.location_photo_path),
        ...(people.data ?? []).map((p) => (p as { photo_path?: string | null }).photo_path),
      ])
      setTyped('')
      await onDone(
        failed === 0
          ? `Carrera eliminada con todo lo suyo: ${people.data?.length ?? 0} usuarios y sus fotos.`
          : `Carrera eliminada. ${failed} usuarios no se pudieron eliminar: quedan en Usuarios, "Sin Carrera asignada".`,
      )
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card danger-zone">
      <h2>Eliminar esta Carrera</h2>
      {active ? (
        <p className="muted">Está activa: desactívala primero para poder eliminarla.</p>
      ) : (
        <>
          <p className="muted">
            Borra "{name}" con TODO lo suyo: grupos, bases, cruces, puntajes, registro de cambios, avisos, ubicaciones, tiempos, fotos y sus
            usuarios (corredores e inductores). No se puede deshacer.
          </p>
          <label>
            Para confirmar, escribe el nombre de la Carrera
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={name} autoComplete="off" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="ghost danger" disabled={busy || !matches} onClick={() => void remove()}>
            {busy ? 'Eliminando…' : 'Eliminar Carrera'}
          </button>
        </>
      )}
    </section>
  )
}

// "Preparación": the steps to create a Carrera, in order, each with its state and a link to the screen where it is done.
export function PrepSteps({ counts, problems, active }: { counts: Counts; problems: string[]; active: boolean }) {
  const has = (re: RegExp) => problems.some((p) => re.test(p))
  const steps = [
    { to: '/admin/grupos', title: 'Grupos', sub: `${counts.teams} grupos con su foto`, done: counts.teams >= 2 && !has(/^El grupo ".*" no tiene foto/) },
    { to: '/admin/bases', title: 'Bases', sub: `${counts.bases} bases con foto, información y 3 preguntas`, done: counts.bases >= 1 && !has(/^La base /) },
    { to: '/admin/usuarios', title: 'Usuarios', sub: `${counts.users} corredores e inductores, asignados a su grupo o base`, done: counts.users > 0 && !has(/ningún corredor/) },
    { to: '/admin/cruces', title: 'Cruces', sub: counts.matches > 0 ? `${counts.matches} cruces armados` : 'El cronograma, ronda por ronda', done: counts.matches > 0 },
  ]
  const ready = problems.length === 0
  return (
    <section className="card prep-steps">
      <h2>Pasos para crear la Carrera</h2>
      <p className="muted">Sigue el orden. Cuando todo esté completo, actívala aquí abajo y el panel pasa a <strong>En carrera</strong>.</p>
      <ol>
        {steps.map((st, i) => (
          <li key={st.to}>
            <Link to={st.to} className="prep-step">
              <span className={`prep-mark${st.done ? ' done' : ''}`}>{st.done ? <CheckCircle2 size={22} aria-label="Listo" /> : <Circle size={22} aria-label="Pendiente" />}</span>
              <span className="grow">
                <strong>{i + 1}. {st.title}</strong>
                <small className="muted">{st.sub}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <div className="prep-step">
            <span className={`prep-mark${active ? ' done' : ''}`}>{active ? <CheckCircle2 size={22} aria-label="Listo" /> : <Circle size={22} aria-label="Pendiente" />}</span>
            <span className="grow">
              <strong>5. Activar</strong>
              <small className="muted">{active ? 'La Carrera está en curso.' : ready ? 'Todo listo: ya puedes activarla.' : `Faltan ${problems.length} cosas (abajo).`}</small>
            </span>
          </div>
        </li>
      </ol>
    </section>
  )
}
