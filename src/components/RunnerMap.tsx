import { LocateFixed, Navigation, Radio } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { distanceMeters, useWakeLock, useWatchPosition } from '../lib/geo'
import { fetchWalkingRoute, formatDistance, formatDuration, type LngLat, type WalkingRoute } from '../lib/mapbox'
import { supabase } from '../lib/supabase'
import LazyMap, { type MapMarker } from './LazyMap'

export interface MapTarget {
  name: string
  lat: number | null
  lng: number | null
}

const UPLOAD_EVERY_MS = 10000 // the designated runner sends the position at most every 10 s
const REROUTE_EVERY_MS = 20000
const REROUTE_MIN_METERS = 30
const ARRIVED_METERS = 30

// 3D map with the way to the next base. Everyone can use it for navigation (the position stays
// on their phone); only the runner designated for the GPS also shares it with the coordinator.
export default function RunnerMap({
  teamId,
  isTracker,
  target,
}: {
  teamId: string
  isTracker: boolean
  target: MapTarget | null
}) {
  const [enabled, setEnabled] = useState(false)
  const { position, error } = useWatchPosition(enabled)
  const [route, setRoute] = useState<WalkingRoute | null>(null)
  const [routeError, setRouteError] = useState(false)
  const [lastUpload, setLastUpload] = useState<Date | null>(null)
  const [uploadError, setUploadError] = useState(false)
  const lastRoute = useRef<{ at: number; from: LngLat; to: string } | null>(null)
  const lastSent = useRef(0)

  useWakeLock(enabled)

  const targetPoint: LngLat | null = target && target.lat !== null && target.lng !== null ? [target.lng, target.lat] : null
  const targetKey = targetPoint ? targetPoint.join(',') : ''

  // Walking route from here to the next base (refreshed while walking, not on every GPS tick).
  useEffect(() => {
    if (!position || !targetPoint) return
    const from: LngLat = [position.lng, position.lat]
    const prev = lastRoute.current
    const targetChanged = !prev || prev.to !== targetKey
    const due = prev && Date.now() - prev.at > REROUTE_EVERY_MS && distanceMeters(prev.from, from) > REROUTE_MIN_METERS
    if (!targetChanged && !due) return
    lastRoute.current = { at: Date.now(), from, to: targetKey }
    let cancelled = false
    void fetchWalkingRoute(from, targetPoint).then((r) => {
      if (cancelled) return
      setRoute(r)
      setRouteError(r === null)
    })
    return () => {
      cancelled = true
    }
    // targetPoint is derived from targetKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, targetKey])

  // The designated runner shares the position with the coordinator.
  useEffect(() => {
    if (!isTracker || !position || !supabase) return
    if (Date.now() - lastSent.current < UPLOAD_EVERY_MS) return
    lastSent.current = Date.now()
    void supabase
      .from('team_locations')
      .upsert({
        team_id: teamId,
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
      })
      .then(({ error: err }) => {
        setUploadError(Boolean(err))
        if (!err) setLastUpload(new Date())
      })
  }, [isTracker, position, teamId])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    if (targetPoint && target) list.push({ id: 'target', lng: targetPoint[0], lat: targetPoint[1], label: target.name, kind: 'target' })
    if (position) list.push({ id: 'me', lng: position.lng, lat: position.lat, label: 'Tú', kind: 'me' })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, targetKey, target?.name])

  if (!target) return <p className="warn">Cuando tengas una siguiente base, aquí verás cómo llegar.</p>
  if (!targetPoint) {
    return <p className="warn">La base "{target.name}" aún no tiene ubicación en el mapa. Pregúntale al coordinador.</p>
  }

  const remaining = position ? distanceMeters([position.lng, position.lat], targetPoint) : null
  const arrived = remaining !== null && remaining < ARRIVED_METERS
  const firstStep = route?.steps[0]

  return (
    <>
      <section className="card map-card">
        <LazyMap markers={markers} route={route?.coordinates ?? null} height="min(55vh, 420px)" />
      </section>

      {!enabled ? (
        <section className="card">
          <h2>Cómo llegar a {target.name}</h2>
          <p>Activa tu ubicación para ver la ruta a pie hasta la base.</p>
          {isTracker && (
            <p className="muted">
              Eres el corredor designado para el GPS: tu ubicación también se comparte con el coordinador. Deja la
              app abierta con la pantalla encendida.
            </p>
          )}
          <button className="btn-block" onClick={() => setEnabled(true)}>
            <LocateFixed size={20} aria-hidden="true" />
            Activar mi ubicación
          </button>
        </section>
      ) : (
        <section className="card">
          <h2>Cómo llegar a {target.name}</h2>
          {error && <p className="error">{error}</p>}
          {!position && !error && <p className="muted">Buscando tu ubicación…</p>}
          {arrived && <p className="ok-box">¡Llegaste a la base!</p>}
          {!arrived && route && (
            <>
              <p className="route-summary">
                <strong>{formatDistance(route.distance)}</strong> · {formatDuration(route.duration)} a pie
              </p>
              {firstStep && (
                <p className="next-step">
                  <Navigation size={22} aria-hidden="true" />
                  <span>
                    {firstStep.instruction}
                    <small className="muted"> · {formatDistance(firstStep.distance)}</small>
                  </span>
                </p>
              )}
              <details>
                <summary>Todas las indicaciones</summary>
                <ol className="steps">
                  {route.steps.map((s, i) => (
                    <li key={i}>
                      {s.instruction} <small className="muted">({formatDistance(s.distance)})</small>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
          {routeError && !route && <p className="warn">No se pudo calcular la ruta. Revisa tu conexión.</p>}

          {isTracker && (
            <p className={uploadError ? 'warn' : 'sharing'}>
              {uploadError ? (
                'No se pudo compartir tu ubicación con el coordinador.'
              ) : (
                <>
                  <Radio size={18} aria-hidden="true" />
                  <span>
                    {lastUpload
                      ? `Compartiendo con el coordinador · última vez ${lastUpload.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Deja la app abierta y la pantalla encendida.`
                      : 'Conectando con el coordinador…'}
                  </span>
                </>
              )}
            </p>
          )}
          <button className="ghost" style={{ marginTop: '.75rem' }} onClick={() => setEnabled(false)}>
            {isTracker ? 'Dejar de compartir mi ubicación' : 'Desactivar ubicación'}
          </button>
        </section>
      )}
    </>
  )
}
