import { useCallback, useEffect, useMemo, useState } from 'react'
import LazyMap, { type MapMarker } from '../../components/LazyMap'
import { lateTeams, type TimedMatch } from '../../lib/delays'
import { isLocationFresh, timeAgo } from '../../lib/geo'
import { useTravelTimes } from '../../lib/travel'
import { useRotationTimes } from '../../lib/rotations'
import { useRealtimeReload } from '../../lib/realtime'
import { photoUrl } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { useAdmin } from './AdminContext'
import { serverNow } from '../../lib/clock'
import { airportCode, flightCodes } from '../../lib/flight'

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
  const [now, setNow] = useState(() => serverNow())

  const eventId = event?.id
  const travel = useTravelTimes(eventId)
  const rotations = useRotationTimes(eventId)

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [b, t, m] = await Promise.all([
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', eventId).order('sort_order'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', eventId).order('sort_order'),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at')
        .eq('event_id', eventId),
    ])
    setMatches((m.data ?? []) as TimedMatch[])
    setBases(b.data ?? [])
    setTeams(t.data ?? [])
  }, [eventId])

  // Positions arrive every few seconds: they have their own light reload instead of the whole screen.
  const loadPositions = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('team_locations').select('team_id, lat, lng, accuracy, updated_at')
    setLocations(data ?? [])
  }, [])

  useEffect(() => {
    void load()
    void loadPositions()
  }, [load, loadPositions])

  // Live: every position update from the runners moves the marker.
  useRealtimeReload(['bases', 'matches'], load)
  useRealtimeReload(['team_locations'], loadPositions)

  // Re-evaluate "no signal" and "x min ago" every 15 s.
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 15000)
    return () => clearInterval(id)
  }, [])

  // Positions older than an hour are not shown at all (neither marker nor "hace x h"): the group reads "Sin señal".
  const locationByTeam = useMemo(
    () => new Map(locations.filter((l) => isLocationFresh(l.updated_at, now)).map((l) => [l.team_id, l])),
    [locations, now],
  )

  // Groups that are walking longer than allowed (the full list with the "Avisar" button is in "En vivo").
  const lateIds = useMemo(
    () => new Set(lateTeams(matches, event?.max_travel_minutes ?? 10, now, travel, rotations).map((l) => l.teamId)),
    [matches, event?.max_travel_minutes, now, travel, rotations],
  )

  const codes = useMemo(() => flightCodes(teams), [teams])

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    for (const b of bases) {
      if (b.lat !== null && b.lng !== null) list.push({ id: `b-${b.id}`, lng: b.lng, lat: b.lat, label: `${airportCode(b.name)} · ${b.name}`, kind: 'base' })
    }
    for (const t of teams) {
      const loc = locationByTeam.get(t.id)
      if (loc) {
        list.push({
          id: `t-${t.id}`,
          lng: loc.lng,
          lat: loc.lat,
          label: `${codes.get(t.id) ?? ''} · ${t.name}`,
          kind: 'team',
          photo: photoUrl(t.photo_path),
          stale: now - new Date(loc.updated_at).getTime() > STALE_MS,
          late: lateIds.has(t.id),
        })
      }
    }
    return list
  }, [bases, teams, locationByTeam, now, lateIds, codes])

  if (!event) return <p className="warn">Primero crea una carrera en la pestaña "Carrera".</p>

  const withoutLocation = bases.filter((b) => b.lat === null || b.lng === null)

  return (
    <>
      <p className="eyebrow">Flight Radar</p>
      <h1>Radar de vuelos</h1>
      <p className="muted">
        Cada vuelo (grupo) aparece con la ubicación del corredor designado para el GPS. Se actualiza solo.
      </p>

      <section className="card map-card">
        <div className="radar-frame">
          <LazyMap markers={markers} height="min(70vh, 560px)" lightPreset="night" />
          <div className="radar-sweep" aria-hidden="true" />
        </div>
      </section>

      {withoutLocation.length > 0 && (
        <p className="warn">
          Bases sin ubicación en el mapa: {withoutLocation.map((b) => b.name).join(', ')}. Se marcan en la pestaña Bases.
        </p>
      )}

      <section className="card">
        <p className="eyebrow">Vuelos</p>
        <h2>Señal de cada vuelo</h2>
        <ul className="list radar-list">
          {teams.map((t) => {
            const loc = locationByTeam.get(t.id)
            const stale = loc ? now - new Date(loc.updated_at).getTime() > STALE_MS : false
            return (
              <li key={t.id}>
                <span className="fl-code mono">{codes.get(t.id)}</span>
                <span className="grow">{t.name}</span>
                {lateIds.has(t.id) && <span className="chip lose">En demora</span>}
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
          (app cerrada, pantalla apagada o sin datos). "En demora": el grupo lleva más del tiempo permitido caminando
          hacia su siguiente base; el detalle y el botón para avisarles están en "En vivo".
        </p>
      </section>
    </>
  )
}
