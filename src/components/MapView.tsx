import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Box, LocateFixed, Map as MapIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CAMPUS_CENTER, MAPBOX_TOKEN, type LngLat } from '../lib/mapbox'
import { useTheme } from '../lib/theme'

export interface MapMarker {
  id: string
  lng: number
  lat: number
  label: string
  kind: 'base' | 'team' | 'me' | 'target'
  photo?: string | null
  stale?: boolean // no recent signal
  late?: boolean // walking longer than allowed to its next base
}

export interface MapViewProps {
  markers: MapMarker[]
  route?: LngLat[] | null
  onPick?: (lng: number, lat: number) => void
  height?: string
  lightPreset?: 'day' | 'dusk' | 'night' | 'dawn'
  interactive?: boolean // false: a fixed map to look at (no pan, zoom or rotation)
  recenter?: boolean // a button that brings the view back to the campus (the bases) after the map was moved
}

// Mapbox paints with WebGL and cannot read CSS variables, so the route takes its colours from them.
const cssColor = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Glyphs (Lucide paths) drawn inside the markers.
const GLYPH = {
  base: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" fill="currentColor"/><line x1="4" x2="4" y1="22" y2="15"/>',
  target:
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
} as const

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}

function buildElement(m: MapMarker): HTMLElement {
  const el = document.createElement('div')
  el.className = `mk mk-${m.kind}${m.stale ? ' stale' : ''}${m.late ? ' late' : ''}`
  const pin = document.createElement('span')
  pin.className = 'mk-pin'
  if (m.kind === 'base' || m.kind === 'target') {
    pin.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${GLYPH[m.kind]}</svg>`
  } else if (m.kind === 'team') {
    if (m.photo) pin.style.backgroundImage = `url("${m.photo}")`
    else pin.textContent = initialsOf(m.label)
  }
  const label = document.createElement('span')
  label.className = 'mk-label'
  label.textContent = m.label
  el.append(pin, label)
  return el
}

// Mapbox GL map in 3D (Standard style: buildings, terrain and landmarks), tilted by default.
// Labels that would sit on top of each other: the one that matters most keeps its text, the others hide theirs
// (the pins stay). Runs after the map moves, so zooming in brings the hidden names back.
const LABEL_PRIORITY: Record<MapMarker['kind'], number> = { me: 0, target: 1, team: 2, base: 3 }
function declutterLabels(markers: Map<string, mapboxgl.Marker>) {
  const els = [...markers.values()].map((m) => m.getElement())
  els.forEach((el) => el.classList.remove('hide-label'))
  const items = els
    .map((el) => ({ el, rect: el.querySelector('.mk-label')?.getBoundingClientRect(), p: LABEL_PRIORITY[(el.className.match(/mk-(\w+)/)?.[1] ?? 'base') as MapMarker['kind']] ?? 9 }))
    .filter((x): x is { el: HTMLElement; rect: DOMRect; p: number } => Boolean(x.rect))
    .sort((a, b) => a.p - b.p)
  const kept: DOMRect[] = []
  for (const it of items) {
    const clash = kept.some((r) => it.rect.left < r.right + 4 && it.rect.right > r.left - 4 && it.rect.top < r.bottom + 2 && it.rect.bottom > r.top - 2)
    if (clash) it.el.classList.add('hide-label')
    else kept.push(it.rect)
  }
}

export default function MapView({ markers, route, onPick, height = '360px', lightPreset = 'day', interactive = true, recenter = false }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loaded = useRef(false)
  const domMarkers = useRef(new Map<string, mapboxgl.Marker>())
  const routeRef = useRef<LngLat[] | null | undefined>(route)
  const onPickRef = useRef(onPick)
  const lastFit = useRef('')
  const markersRef = useRef(markers)
  useEffect(() => {
    markersRef.current = markers
  })

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
      interactive,
    })
    mapRef.current = map
    if (interactive) map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')
    const declutter = () => declutterLabels(domMarkers.current)
    map.on('idle', declutter)
    map.on('zoomend', declutter)
    map.on('moveend', declutter)

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
        paint: { 'line-color': cssColor('--bg'), 'line-width': 11, 'line-emissive-strength': 1 },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        slot: 'middle',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': cssColor('--gold'), 'line-width': 6, 'line-emissive-strength': 1 },
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
    // The map is created once; the light preset is applied at load time (and `interactive` never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Light preset of the basemap and route colours follow the app theme / the requested preset.
  const [theme] = useTheme()
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded.current) return
    try {
      map.setConfigProperty('basemap', 'lightPreset', lightPreset)
      map.setPaintProperty('route-casing', 'line-color', cssColor('--bg'))
      map.setPaintProperty('route-line', 'line-color', cssColor('--gold'))
    } catch {
      // style not ready or without the basemap import
    }
  }, [lightPreset, theme])

  // Keep the markers in sync (rebuilt when label, photo or stale state change).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const seen = new Set<string>()
    for (const m of markers) {
      seen.add(m.id)
      const existing = domMarkers.current.get(m.id)
      const signature = `${m.label}|${m.photo ?? ''}|${m.stale ? 1 : 0}|${m.late ? 1 : 0}|${m.kind}`
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
    requestAnimationFrame(() => declutterLabels(domMarkers.current))
  }, [markers, route])

  // Draw the route.
  useEffect(() => {
    routeRef.current = route
    const map = mapRef.current
    if (!map || !loaded.current) return
    const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined
    source?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route ?? [] } })
  }, [route])

  // Seen from above (flat, north up) or in 3D (tilted, the way it opens).
  const [flat, setFlat] = useState(false)
  const toggleView = () => {
    const map = mapRef.current
    if (!map) return
    const next = !flat
    setFlat(next)
    map.easeTo({ pitch: next ? 0 : 62, bearing: next ? 0 : -18, duration: 700 })
  }

  // Back to the campus: the view of the beginning, framing the bases (or the campus centre when there are none).
  const centre = () => {
    const map = mapRef.current
    if (!map) return
    const bases = markersRef.current.filter((m) => m.kind === 'base')
    if (bases.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      bases.forEach((m) => bounds.extend([m.lng, m.lat]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 17.5, pitch: flat ? 0 : 62, bearing: flat ? 0 : -18, duration: 900 })
    } else {
      map.easeTo({ center: CAMPUS_CENTER, zoom: 16.2, pitch: flat ? 0 : 62, bearing: flat ? 0 : -18, duration: 900 })
    }
  }

  return (
    <div className="map-wrap">
      <div ref={container} className="map" style={{ height }} />
      {recenter && (
        <div className="map-tools">
          <button type="button" className="ghost map-recenter" onClick={toggleView} aria-pressed={flat} aria-label={flat ? 'Ver el mapa en 3D' : 'Ver el mapa desde arriba'}>
            {flat ? <Box size={18} aria-hidden="true" /> : <MapIcon size={18} aria-hidden="true" />}
            {flat ? 'Vista 3D' : 'Desde arriba'}
          </button>
          <button type="button" className="ghost map-recenter icon" onClick={centre} aria-label="Centrar el mapa en la Javeriana" title="Centrar en la Javeriana">
            <LocateFixed size={20} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
