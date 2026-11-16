import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { errMsg, useAdmin } from './AdminContext'

interface Counts {
  teams: number
  bases: number
  warnings: string[]
}

export default function Resumen() {
  const { events, event, selectEvent, reload } = useAdmin()
  const [problems, setProblems] = useState<string[]>([])
  const [counts, setCounts] = useState<Counts>({ teams: 0, bases: 0, warnings: [] })
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventId = event?.id

  const check = useCallback(async () => {
    if (!supabase || !eventId) return
    const [probs, teams, bases] = await Promise.all([
      supabase.rpc('event_problems', { p_event: eventId }),
      supabase.from('teams').select('name, team_runners(is_gps_tracker)').eq('event_id', eventId),
      supabase.from('bases').select('name, lat, base_staff(user_id)').eq('event_id', eventId),
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
    setCounts({ teams: teams.data?.length ?? 0, bases: bases.data?.length ?? 0, warnings })
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

  function activate() {
    if (!supabase || !event) return
    void run(async () => {
      const previous = events.find((x) => x.is_active && x.id !== event.id)
      if (previous) await supabase!.from('events').update({ is_active: false }).eq('id', previous.id)
      const { error: err } = await supabase!.from('events').update({ is_active: true }).eq('id', event.id)
      if (err) {
        if (previous) await supabase!.from('events').update({ is_active: true }).eq('id', previous.id)
        throw new Error('No se pudo activar: revisa los pendientes de la lista.')
      }
    })
  }

  function deactivate() {
    if (!supabase || !event) return
    void run(async () => {
      const { error: err } = await supabase!.from('events').update({ is_active: false }).eq('id', event.id)
      if (err) throw new Error('No se pudo desactivar la Carrera.')
    })
  }

  return (
    <>
      <h1>Resumen de la Carrera</h1>

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
            <p className="ok-box">Todo completo: fotos, 2 corredores por grupo, información y 3 preguntas por base.</p>
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

      {event && <TravelSetting key={event.id} eventId={event.id} minutes={event.max_travel_minutes} onSaved={reload} />}

      <section className="card">
        <h2>{event ? 'Nueva Carrera' : 'Crea tu primera Carrera'}</h2>
        <form className="form" onSubmit={createEvent}>
          <label>
            Nombre (por ejemplo "Carrera 2027-2")
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
          </label>
          <button type="submit" disabled={busy || !newName.trim()}>Crear Carrera</button>
        </form>
      </section>
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
      <h2>Alertas de demora</h2>
      <p className="muted">
        Si un grupo pasa más de este tiempo entre que termina una base y llega a la siguiente, suena una alerta a sus
        corredores, a la base y a ti (en Cruces y en Mapa), y puedes avisarles con un botón.
      </p>
      <div className="row">
        <label className="inline-field grow">
          Tiempo máximo de traslado (minutos)
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
