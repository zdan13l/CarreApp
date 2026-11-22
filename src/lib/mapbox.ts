// Mapbox: 3D map and walking directions. The public token (pk.*) is meant for browsers;
// restrict it by URL in the Mapbox dashboard.
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
export const isMapboxConfigured = Boolean(MAPBOX_TOKEN)

// Pontificia Universidad Javeriana (Bogotá): default view of the campus.
// The Javeriana: calle 39 to calle 45 (south to north), carrera 7 to the Circunvalar (west to east): [[west, south], [east, north]].
export const CAMPUS_BOUNDS: [[number, number], [number, number]] = [[-74.0668, 4.6232], [-74.0598, 4.6322]]
export const CAMPUS_CENTER: [number, number] = [-74.0647, 4.6286]

export type LngLat = [number, number]

export interface RouteStep {
  instruction: string
  distance: number // meters
}

export interface WalkingRoute {
  coordinates: LngLat[]
  distance: number // meters
  duration: number // seconds
  steps: RouteStep[]
}

// Walking route from -> to, with Spanish turn-by-turn instructions.
export async function fetchWalkingRoute(from: LngLat, to: LngLat): Promise<WalkingRoute | null> {
  if (!MAPBOX_TOKEN) return null
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?geometries=geojson&overview=full&steps=true&language=es&access_token=${MAPBOX_TOKEN}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) return null
  return {
    coordinates: route.geometry.coordinates as LngLat[],
    distance: route.distance,
    duration: route.duration,
    steps: (route.legs?.[0]?.steps ?? []).map((s: { maneuver: { instruction: string }; distance: number }) => ({
      instruction: s.maneuver.instruction,
      distance: s.distance,
    })),
  }
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60))
  return `${min} min`
}

// Walking durations (seconds) between every pair of points: matrix[from][to]. Up to 25 points.
export async function fetchWalkingMatrix(points: LngLat[]): Promise<(number | null)[][] | null> {
  if (!MAPBOX_TOKEN || points.length < 2) return null
  const coords = points.map((p) => `${p[0]},${p[1]}`).join(';')
  const res = await fetch(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/walking/${coords}?annotations=duration&access_token=${MAPBOX_TOKEN}`,
  )
  if (!res.ok) return null
  const data = await res.json()
  return (data.durations as (number | null)[][] | undefined) ?? null
}
