import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useEffect, useRef } from 'react'
import { CAMPUS_CENTER, MAPBOX_TOKEN, type LngLat } from '../lib/mapbox'

export interface MapMarker {
  id: string
  lng: number
  lat: number
  label: string
  kind: 'base' | 'team' | 'me' | 'target'
  photo?: string | null
  stale?: boolean // no recent signal
}

export interface MapViewProps {
  markers: MapMarker[]
  route?: LngLat[] | null
  onPick?: (lng: number, lat: number) => void
  height?: string
  lightPreset?: 'day' | 'dusk' | 'night' | 'dawn'
}

const ICON: Record<MapMarker['kind'], string> = { base: '📍', team: '🏃', me: '🔵', target: '🏁' }

function buildElement(m: MapMarker): HTMLElement {
  const el = document.createElement('div')
  el.className = `mk mk-${m.kind}${m.stale ? ' stale' : ''}`
  const pin = document.createElement('span')
  pin.className = 'mk-pin'
  if (m.photo) pin.style.backgroundImage = `url("${m.photo}")`
  else pin.textContent = ICON[m.kind]
  const label = document.createElement('span')
  label.className = 'mk-label'
  label.textContent = m.label
  el.append(pin, label)
  return el
}

// Mapbox GL map in 3D (Standard style: buildings, terrain and landmarks), tilted by default.
export default function MapView({ markers, route, onPick, height = '360px', lightPreset = 'day' }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loaded = useRef(false)
  const domMarkers = useRef(new Map<string, mapboxgl.Marker>())
  const routeRef = useRef<LngLat[] | null | undefined>(route)
  const onPickRef = useRef(onPick)
  const lastFit = useRef('')

  useEffect(() => {
    onPickRef.current = onPick
  })

  // Create the map once.
  useEffect(() => {
    if (!container.current || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/standard',
      center: CAMPUS_CENTER,
      zoom: 16.2,
      pitch: 62,
      bearing: -18,
      antialias: true,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')

    map.on('style.load', () => {
      try {
        map.setConfigProperty('basemap', 'lightPreset', lightPreset)
      } catch {
        // style without the basemap import
      }
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeRef.current ?? [] } },
      })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        slot: 'middle',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0b0f17', 'line-width': 11, 'line-emissive-strength': 1 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        slot: 'middle',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffa94d', 'line-width': 6, 'line-emissive-strength': 1 },
      })
      loaded.current = true
    })
    map.on('click', (e) => onPickRef.current?.(e.lngLat.lng, e.lngLat.lat))

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    const markersMap = domMarkers.current

    return () => {
      observer.disconnect()
      markersMap.forEach((mk) => mk.remove())
      markersMap.clear()
      loaded.current = false
      map.remove()
      mapRef.current = null
    }
    // The map is created once; the light preset is applied at load time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the markers in sync (rebuilt when label, photo or stale state change).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const m of markers) {
      seen.add(m.id)
      const existing = domMarkers.current.get(m.id)
      const signature = `${m.label}|${m.photo ?? ''}|${m.stale ? 1 : 0}|${m.kind}`
      if (existing && existing.getElement().dataset.sig === signature) {
        existing.setLngLat([m.lng, m.lat])
        continue
      }
      existing?.remove()
      const el = buildElement(m)
      el.dataset.sig = signature
      domMarkers.current.set(m.id, new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([m.lng, m.lat]).addTo(map))
    }
    for (const [id, mk] of domMarkers.current) {
      if (!seen.has(id)) {
        mk.remove()
        domMarkers.current.delete(id)
      }
    }

    // Frame everything when the set of markers (or the route) changes, not on every GPS tick.
    const key = `${markers.map((m) => m.id).sort().join('|')}#${route && route.length > 0 ? 'r' : ''}`
    if (key !== lastFit.current && markers.length > 0) {
      lastFit.current = key
      const bounds = new mapboxgl.LngLatBounds()
      markers.forEach((m) => bounds.extend([m.lng, m.lat]))
      route?.forEach((c) => bounds.extend(c))
      if (markers.length === 1 && !route?.length) map.easeTo({ center: [markers[0].lng, markers[0].lat], zoom: 17.5, duration: 800 })
      else map.fitBounds(bounds, { padding: 70, maxZoom: 18, duration: 800 })
    }
  }, [markers, route])

  // Draw the route.
  useEffect(() => {
    routeRef.current = route
    const map = mapRef.current
    if (!map || !loaded.current) return
    const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route ?? [] } })
  }, [route])

  return <div ref={container} className="map" style={{ height }} />
}
