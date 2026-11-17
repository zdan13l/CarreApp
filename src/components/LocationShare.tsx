import { LocateFixed, Radio } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWakeLock, useWatchPosition } from '../lib/geo'
import { supabase } from '../lib/supabase'
import LazyMap, { type MapMarker } from './LazyMap'

const UPLOAD_EVERY_MS = 10000 // the designated runner sends the position at most every 10 s

// For the group's designated runner (the shared user of the pair): turns on the location that is shared with the
// coordinator. The map is only there to look at: it shows the bases and where the group is, it follows the position
// and it cannot be moved. Walking directions are not offered (the runners know where the next base is).
export default function LocationShare({
  teamId,
  bases,
}: {
  teamId: string
  bases: { id: string; name: string; lat: number | null; lng: number | null }[]
}) {
  const [enabled, setEnabled] = useState(false)
  const { position, error } = useWatchPosition(enabled)
  const [lastUpload, setLastUpload] = useState<Date | null>(null)
  const [uploadError, setUploadError] = useState(false)
  const lastSent = useRef(0)

  useWakeLock(enabled)

  useEffect(() => {
    if (!position || !supabase) return
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
  }, [position, teamId])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = bases
      .filter((b) => b.lat !== null && b.lng !== null)
      .map((b) => ({ id: `base-${b.id}`, lng: b.lng!, lat: b.lat!, label: b.name, kind: 'base' as const }))
    if (position) list.push({ id: 'me', lng: position.lng, lat: position.lat, label: 'Tu grupo', kind: 'me' })
    return list
  }, [bases, position])

  return (
    <>
      <section className="card map-card">
        <LazyMap markers={markers} height="min(55vh, 420px)" interactive={false} />
      </section>
      <section className="card">
        <h2>Ubicación del grupo</h2>
        <p className="muted">
          Eres el usuario designado para el GPS del grupo: tu ubicación se comparte con el coordinador. Deja la app abierta con la
          pantalla encendida mientras caminan.
        </p>
        {!enabled ? (
          <button className="btn-block" onClick={() => setEnabled(true)}>
            <LocateFixed size={20} aria-hidden="true" />
            Compartir mi ubicación
          </button>
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            {!position && !error && <p className="muted">Buscando tu ubicación…</p>}
            <p className={uploadError ? 'warn' : 'sharing'}>
              {uploadError ? (
                'No se pudo compartir tu ubicación con el coordinador.'
              ) : (
                <>
                  <Radio size={18} aria-hidden="true" />
                  <span>
                    {lastUpload
                      ? `Compartiendo con el coordinador · última vez ${lastUpload.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`
                      : 'Conectando con el coordinador…'}
                  </span>
                </>
              )}
            </p>
            <button className="ghost" style={{ marginTop: '.75rem' }} onClick={() => setEnabled(false)}>
              Dejar de compartir mi ubicación
            </button>
          </>
        )}
      </section>
    </>
  )
}
