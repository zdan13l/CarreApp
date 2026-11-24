import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdmin } from './AdminContext'
import BulkImport from './BulkImport'
import TravelTimes from './TravelTimes'
import { PHASE_LABEL } from '../../lib/phase'

export interface Counts {
  teams: number
  bases: number
  users: number
  matches: number
  warnings: string[]
}

// Settings of ONE carrera (the one open in the address): its state and checklist, loading it from a file and the delay times. What happens
// DURING the race lives in "Resumen y control". Creating a carrera is done in "Todas las carreras"; carreras are never deleted.
export default function Carrera() {
  const { event, reload } = useAdmin()
  const [problems, setProblems] = useState<string[]>([])
  const [counts, setCounts] = useState<Counts>({ teams: 0, bases: 0, users: 0, matches: 0, warnings: [] })
  const [error] = useState<string | null>(null)

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

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Esta carrera</p>
          <h1>Configuración</h1>
        </div>
        <p className="head-meta">Estado, lista de pendientes, carga desde un archivo y tiempos de traslado.</p>
      </header>
      <div className="live-grid">
      <div>
      {event && <PrepSteps eventId={event.id} counts={counts} problems={problems} active={event.is_active} />}
      {event && (
        <section className="card">
          <h2>{event.name}</h2>
          <p>
            Estado: <span className={`badge ${event.is_active ? 'ok' : 'idle'}`}>{event.is_active ? PHASE_LABEL[event.phase] : 'Borrador'}</span>
          </p>
          <p className="muted">{counts.teams} grupos · {counts.bases} bases</p>

          {problems.length === 0 ? (
            <p className="ok-box">Todo completo: fotos, un usuario por grupo, información y 3 preguntas por base.</p>
          ) : (
            <div className="fail-box">
              <strong>{event.is_active ? 'Pendientes de la carrera activa:' : 'Falta para poder habilitar la carrera:'}</strong>
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
        </section>
      )}
      {event && <p className="muted">El estado de la carrera (habilitar, iniciar, terminar, finalizar, reiniciar) se controla en <Link to={`/admin/carreras/${event.id}`}>Resumen y control</Link>.</p>}

      <BulkImport />
      </div>

      <div>
      {event && <h2 className="section-title">Alertas de demora</h2>}
      {event && <TravelSetting key={event.id} eventId={event.id} minutes={event.max_travel_minutes} onSaved={reload} />}
      {event && <TravelTimes key={`t-${event.id}`} eventId={event.id} defaultMinutes={event.max_travel_minutes} />}

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

// "Preparación": the steps to create a Carrera, in order, each with its state and a link to the screen where it is done.
export function PrepSteps({ eventId, counts, problems, active }: { eventId: string; counts: Counts; problems: string[]; active: boolean }) {
  const has = (re: RegExp) => problems.some((p) => re.test(p))
  const steps = [
    { to: `/admin/carreras/${eventId}/grupos`, title: 'Grupos', sub: `${counts.teams} grupos con su foto`, done: counts.teams >= 2 && !has(/^El grupo ".*" no tiene foto/) },
    { to: `/admin/carreras/${eventId}/bases`, title: 'Bases', sub: `${counts.bases} bases con foto, información y 3 preguntas`, done: counts.bases >= 1 && !has(/^La base /) },
    { to: `/admin/carreras/${eventId}/usuarios`, title: 'Usuarios', sub: `${counts.users} corredores e inductores, asignados a su grupo o base`, done: counts.users > 0 && !has(/ningún corredor/) },
    { to: `/admin/carreras/${eventId}/cruces`, title: 'Cruces', sub: counts.matches > 0 ? `${counts.matches} cruces armados` : 'El cronograma, ronda por ronda', done: counts.matches > 0 },
  ]
  const ready = problems.length === 0
  return (
    <section className="card prep-steps">
      <h2>Pasos para crear la carrera</h2>
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
