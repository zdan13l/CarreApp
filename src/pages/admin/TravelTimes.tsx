import { Route, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchWalkingMatrix, isMapboxConfigured, type LngLat } from '../../lib/mapbox'
import { legKey } from '../../lib/travel'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

interface BaseInfo {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

interface Leg {
  key: string
  from: BaseInfo
  to: BaseInfo
}

// Walking time x1.5 (people do not walk at a steady pace), at least 3 minutes.
const suggest = (seconds: number) => Math.max(3, Math.ceil((seconds / 60) * 1.5))

// Maximum travel time per leg: the way from one base to the next one differs a lot, so each leg
// of the schedule can have its own time (the general maximum applies to legs left empty).
export default function TravelTimes({ eventId, defaultMinutes }: { eventId: string; defaultMinutes: number }) {
  const [legs, setLegs] = useState<Leg[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [stored, setStored] = useState<Record<string, number>>({})
  const [walking, setWalking] = useState<Record<string, number>>({}) // seconds, from the map
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const [m, b, t] = await Promise.all([
      supabase.from('matches').select('round_number, base_id, team_a, team_b').eq('event_id', eventId),
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', eventId),
      supabase.from('base_travel_times').select('from_base_id, to_base_id, minutes').eq('event_id', eventId),
    ])
    const bases = new Map<string, BaseInfo>((b.data ?? []).map((x) => [x.id, x]))
    // The legs that actually happen: for each team, one base to the next one.
    const found = new Map<string, Leg>()
    const teamIds = new Set((m.data ?? []).flatMap((x) => [x.team_a, x.team_b]))
    for (const teamId of teamIds) {
      const mine = (m.data ?? [])
        .filter((x) => x.team_a === teamId || x.team_b === teamId)
        .sort((x, y) => x.round_number - y.round_number)
      for (let i = 1; i < mine.length; i++) {
        const from = bases.get(mine[i - 1].base_id)
        const to = bases.get(mine[i].base_id)
        if (from && to && from.id !== to.id) found.set(legKey(from.id, to.id), { key: legKey(from.id, to.id), from, to })
      }
    }
    const list = [...found.values()].sort((x, y) => (x.from.name + x.to.name).localeCompare(y.from.name + y.to.name))
    const saved: Record<string, number> = {}
    for (const r of t.data ?? []) saved[legKey(r.from_base_id, r.to_base_id)] = r.minutes
    setLegs(list)
    setStored(saved)
    setValues(Object.fromEntries(list.map((l) => [l.key, saved[l.key] !== undefined ? String(saved[l.key]) : ''])))
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const missingCoords = useMemo(
    () => [...new Map(legs.flatMap((l) => [l.from, l.to]).filter((b) => b.lat === null || b.lng === null).map((b) => [b.id, b.name]))].map(([, n]) => n),
    [legs],
  )

  async function fromMap() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const involved = [...new Map(legs.flatMap((l) => [l.from, l.to]).map((b) => [b.id, b])).values()].filter(
        (b) => b.lat !== null && b.lng !== null,
      )
      if (involved.length < 2) throw new Error('Marca la ubicación de las bases en el mapa primero (pestaña Bases).')
      if (involved.length > 25) throw new Error('El mapa calcula hasta 25 bases a la vez.')
      const matrix = await fetchWalkingMatrix(involved.map((b) => [b.lng!, b.lat!] as LngLat))
      if (!matrix) throw new Error('No se pudo calcular con el mapa. Revisa tu conexión.')
      const index = new Map(involved.map((b, i) => [b.id, i]))
      const nextWalking: Record<string, number> = {}
      const next = { ...values }
      for (const l of legs) {
        const i = index.get(l.from.id)
        const j = index.get(l.to.id)
        const seconds = i !== undefined && j !== undefined ? matrix[i][j] : null
        if (seconds != null) {
          nextWalking[l.key] = seconds
          next[l.key] = String(suggest(seconds))
        }
      }
      setWalking(nextWalking)
      setValues(next)
      setMessage('Tiempos calculados con el mapa (caminando x1,5). Revísalos y guarda.')
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!supabase) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const rows: { event_id: string; from_base_id: string; to_base_id: string; minutes: number }[] = []
      const remove: Leg[] = []
      for (const l of legs) {
        const raw = values[l.key]?.trim() ?? ''
        if (raw === '') {
          if (stored[l.key] !== undefined) remove.push(l)
          continue
        }
        const minutes = Number(raw)
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
          throw new Error(`"${l.from.name} → ${l.to.name}": escribe un número entero entre 1 y 180.`)
        }
        rows.push({ event_id: eventId, from_base_id: l.from.id, to_base_id: l.to.id, minutes })
      }
      if (rows.length > 0) {
        const { error: err } = await supabase.from('base_travel_times').upsert(rows, { onConflict: 'from_base_id,to_base_id' })
        if (err) throw new Error('No se pudieron guardar los tiempos.')
      }
      for (const l of remove) {
        await supabase.from('base_travel_times').delete().eq('from_base_id', l.from.id).eq('to_base_id', l.to.id)
      }
      setMessage('Tiempos guardados.')
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Tiempo de traslado por tramo</h2>
      <p className="muted">
        Ir de una base a otra no toma lo mismo. Aquí pones el tiempo máximo de cada tramo del cronograma; los que
        dejes vacíos usan el tiempo general de arriba ({defaultMinutes} min).
      </p>
      {legs.length === 0 ? (
        <p className="warn">Cuando armes los cruces, aquí aparecen los tramos entre bases de cada grupo.</p>
      ) : (
        <>
          <ul className="list legs">
            {legs.map((l) => (
              <li key={l.key}>
                <span className="grow">
                  <strong>
                    {l.from.name} <span className="muted">→</span> {l.to.name}
                  </strong>
                  {walking[l.key] !== undefined && (
                    <small className="muted"> caminando: {Math.max(1, Math.round(walking[l.key] / 60))} min</small>
                  )}
                </span>
                <label className="leg-input">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={180}
                    placeholder={String(defaultMinutes)}
                    value={values[l.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [l.key]: e.target.value })}
                    aria-label={`Minutos de ${l.from.name} a ${l.to.name}`}
                  />
                  <span>min</span>
                </label>
              </li>
            ))}
          </ul>
          {missingCoords.length > 0 && (
            <p className="warn">Faltan ubicaciones en el mapa para calcular: {missingCoords.join(', ')}.</p>
          )}
          <div className="row">
            <button className="ghost" disabled={busy || !isMapboxConfigured} onClick={() => void fromMap()}>
              <Route size={18} aria-hidden="true" />
              Calcular con el mapa
            </button>
            <button disabled={busy} onClick={() => void save()}>
              <Save size={18} aria-hidden="true" />
              Guardar tiempos
            </button>
          </div>
        </>
      )}
      {message && <p className="ok-text">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
