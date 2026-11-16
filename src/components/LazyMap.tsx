import { lazy, Suspense } from 'react'
import { isMapboxConfigured } from '../lib/mapbox'
import type { MapViewProps } from './MapView'

// Mapbox is heavy (~1.5 MB): it only loads when a screen actually shows a map.
const MapView = lazy(() => import('./MapView'))

export type { MapMarker } from './MapView'

export default function LazyMap(props: MapViewProps) {
  if (!isMapboxConfigured) {
    return <p className="warn">El mapa no está configurado todavía (falta el token de Mapbox).</p>
  }
  return (
    <Suspense fallback={<p className="muted">Cargando mapa…</p>}>
      <MapView {...props} />
    </Suspense>
  )
}
