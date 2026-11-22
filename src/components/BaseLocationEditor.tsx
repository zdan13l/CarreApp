import { LocateFixed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LngLat } from '../lib/mapbox'
import LazyMap from './LazyMap'

// Sets where a base is on the map. The coordinator and the base's own inductors can use it
// (a base can move, e.g. because of rain): tap the map or use the phone's current position.
export default function BaseLocationEditor({
  baseId,
  name,
  lat,
  lng,
  onSaved,
  onCancel,
  compact = false,
}: {
  baseId: string
  name: string
  lat: number | null
  lng: number | null
  onSaved: () => Promise<void>
  onCancel?: () => void // when the caller can leave without saving (the base changing its place)
  compact?: boolean // the caller already shows a heading
}) {
  const saved: LngLat | null = lat !== null && lng !== null ? [lng, lat] : null
  const [draft, setDraft] = useState<LngLat | null>(saved)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Follow the saved value when it changes from outside (reload, realtime).
  useEffect(() => {
    setDraft(lat !== null && lng !== null ? [lng, lat] : null)
  }, [lat, lng])

  const changed = draft !== null && (saved === null || draft[0] !== saved[0] || draft[1] !== saved[1])

  function useMyPosition() {
    setError(null)
    setMessage(null)
    if (!('geolocation' in navigator)) {
      setError('Este dispositivo no permite usar la ubicación.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDraft([p.coords.longitude, p.coords.latitude])
        setBusy(false)
      },
      () => {
        setError('No se pudo obtener tu ubicación. Revisa el permiso y el GPS.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 20000 },
    )
  }

  async function save() {
    if (!supabase || !draft) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('bases').update({ lat: draft[1], lng: draft[0] }).eq('id', baseId)
    if (err) setError('No se pudo guardar la ubicación.')
    else {
      setMessage('Ubicación guardada.')
      await onSaved()
    }
    setBusy(false)
  }

  return (
    <div className="location-editor">
      {!compact && <h3>Ubicación en el mapa</h3>}
      <LazyMap
        height="280px"
        recenter
        markers={draft ? [{ id: 'base', lng: draft[0], lat: draft[1], label: name, kind: 'base' }] : []}
        onPick={(lngPick, latPick) => {
          setMessage(null)
          setDraft([lngPick, latPick])
        }}
      />
      {!draft && <p className="muted">Toca el mapa para marcar dónde está la base.</p>}
      <div className="location-actions">
        <button className="ghost locate-btn" type="button" disabled={busy} onClick={useMyPosition}>
          <LocateFixed size={19} aria-hidden="true" />
          Usar mi ubicación
        </button>
        <div className={`location-pair${onCancel ? '' : ' single'}`}>
          {onCancel && (
            <button className="btn-danger" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
          )}
          <button type="button" disabled={busy || !changed} onClick={() => void save()}>Guardar ubicación</button>
        </div>
      </div>
      {message && <p className="ok-text">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
