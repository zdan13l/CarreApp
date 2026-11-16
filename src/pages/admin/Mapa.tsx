import { useCallback, useEffect, useMemo, useState } from 'react'
import DelaysPanel from '../../components/DelaysPanel'
import LazyMap, { type MapMarker } from '../../components/LazyMap'
import type { TimedMatch } from '../../lib/delays'
import { timeAgo } from '../../lib/geo'
import { useRealtimeReload } from '../../lib/realtime'
import { photoUrl } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { useAdmin } from './AdminContext'

interface BasePoint {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

interface TeamInfo {
  id: string
  name: string
  photo_path: string | null
}

interface TeamLocation {
  team_id: string
  lat: number
  lng: number
  accuracy: number | null
  updated_at: string
}

const STALE_MS = 2 * 60 * 1000 // no signal for 2 minutes

export default function Mapa() {
  const { event } = useAdmin()
  const [bases, setBases] = useState<BasePoint[]>([])
  const [teams, setTeams] = useState<TeamInfo[]>([])
  const [locations, setLocations] = useState<TeamLocation[]>([])
  const [matches, setMatches] = useState<TimedMatch[]>([])
  const [now, setNow] = useState(() => Date.now())

  const eventId = event?.id

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [b, t, l, m] = await Promise.all([
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', eventId).order('sort_order'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', eventId).order('sort_order'),
      supabase.from('team_locations').select('team_id, lat, lng, accuracy, updated_at'),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at')
        .eq('event_id', eventId),
    ])
    setMatches((m.data ?? []) as TimedMatch[])
    setBases(b.data ?? [])
    setTeams(t.data ?? [])
    setLocations(l.data ?? [])
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  // Live: every position update from the runners moves the marker.
  useRealtimeReload(['team_locations', 'bases', 'matches'], load)

  // Re-evaluate "no signal" and "x min ago" every 15 s.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [])

  const locationByTeam = useMemo(() => new Map(locations.map((l) => [l.team_id, l])), [locations])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    for (const b of bases) {
      if (b.lat !== null && b.lng !== null) list.push({ id: `b-${b.id}`, lng: b.lng, lat: b.lat, label: b.name, kind: 'base' })
    }
    for (const t of teams) {
      const loc = locationByTeam.get(t.id)
      if (loc) {
        list.push({
          id: `t-${t.id}`,
          lng: loc.lng,
          lat: loc.lat,
          label: t.name,
          kind: 'team',
          photo: photoUrl(t.photo_path),
          stale: now - new Date(loc.updated_at).getTime() > STALE_MS,
        })
      }
    }
    return list
  }, [bases, teams, locationByTeam, now])

  if (!event) return <p className="warn">Primero crea una Carrera en "Resumen".</p>

  const withoutLocation = bases.filter((b) => b.lat === null || b.lng === null)

  return (
    <>
      <h1>Mapa en vivo</h1>
      <p className="muted">
        Cada grupo aparece con la ubicación del corredor designado para el GPS. Se actualiza solo.
      </p>

      <section className="card map-card">
        <LazyMap markers={markers} height="min(70vh, 560px)" lightPreset="dusk" />
      </section>

      <DelaysPanel
        eventId={event.id}
        matches={matches}
        maxMinutes={event.max_travel_minutes}
        teamName={new Map(teams.map((t) => [t.id, t.name]))}
        baseName={new Map(bases.map((b) => [b.id, b.name]))}
        baseCoords={new Map(bases.filter((b) => b.lat !== null && b.lng !== null).map((b) => [b.id, [b.lng!, b.lat!] as [number, number]]))}
        teamCoords={new Map(locations.map((l) => [l.team_id, [l.lng, l.lat] as [number, number]]))}
      />

      {withoutLocation.length > 0 && (
        <p className="warn">
          Bases sin ubicación en el mapa: {withoutLocation.map((b) => b.name).join(', ')}. Se marcan en la pestaña Bases.
        </p>
      )}

      <section className="card">
        <h2>Grupos</h2>
        <ul className="list">
          {teams.map((t) => {
            const loc = locationByTeam.get(t.id)
            const stale = loc ? now - new Date(loc.updated_at).getTime() > STALE_MS : false
            return (
              <li key={t.id}>
                <span className="grow">{t.name}</span>
                {!loc ? (
                  <span className="chip">Sin señal</span>
                ) : (
                  <span className={`chip ${stale ? 'lose' : 'win'}`}>{timeAgo(loc.updated_at)}</span>
                )}
              </li>
            )
          })}
        </ul>
        <p className="muted">
          "Sin señal": el corredor designado aún no activó su ubicación. En rojo: más de 2 minutos sin actualizar
          (app cerrada, pantalla apagada o sin datos).
        </p>
      </section>
    </>
  )
}
