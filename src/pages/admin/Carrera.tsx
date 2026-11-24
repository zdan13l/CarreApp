import { StepTag } from './PageTitle'
import { useAdmin } from './AdminContext'
import BulkImport from './BulkImport'
import TravelTimes from './TravelTimes'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

// Settings of ONE carrera (the one open in the address): loading it from a file and the delay times. Nothing else: the state and the list of what
// is missing live in "Resumen y control" (one place), and what happens DURING the race too. Creating a carrera is done in "Todas las carreras".
export default function Carrera() {
  const { event, reload } = useAdmin()
  return (
    <>
      <header className="page-head">
        <div className="head-title">
                    <h1>Configuración</h1>
                    <StepTag n={1} />
        </div>
        <p className="head-meta">Carga desde un archivo y tiempos de traslado de esta carrera.</p>
      </header>
      <div className="live-grid">
        <div>
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
