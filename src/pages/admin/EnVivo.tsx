import { BellRing, ChevronRight, Flag } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DelaysPanel, { sendMatchAlert } from '../../components/DelaysPanel'
import FlightBoard from '../../components/FlightBoard'
import OpsLog, { buildOpEvents } from '../../components/OpsLog'
import Kpi from '../../components/Kpi'
import RotationPanel from '../../components/RotationPanel'
import Ranking from '../../components/Ranking'
import { useNow } from '../../lib/alerts'
import { airportCode, flightCodes, flightOf } from '../../lib/flight'
import { DEFAULT_ALERT_MESSAGE, lateTeams } from '../../lib/delays'
import { useRealtimeReload } from '../../lib/realtime'
import { currentRound, formatTime } from '../../lib/schedule'
import { supabase } from '../../lib/supabase'
import { useTravelTimes } from '../../lib/travel'
import { useRotationTimes } from '../../lib/rotations'
import { STATUS_LABEL, type MatchScore, type MatchStatus, type StandingRow } from '../../types'
import { useAdmin } from './AdminContext'
import { promptDialog } from '../../lib/dialog'
import { exportResults } from '../../lib/results'
import PhaseControl from './PhaseControl'
import { PHASE_LABEL } from '../../lib/phase'

interface Named {
  id: string
  name: string
}
interface BasePoint extends Named {
  lat: number | null
  lng: number | null
}
interface LiveMatch {
  id: string
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  finished_at: string | null
  match_scores: MatchScore[]
}
interface Position {
  team_id: string
  lat: number
  lng: number
  updated_at: string
}

const NO_SIGNAL_MS = 2 * 60 * 1000

// The coordinator's control centre while the Carrera runs: what is happening now (current round),
// who is late, who is winning and who is sharing their location. Everything updates by itself.
// Preparing the Carrera is in "Carrera", "Grupos", "Bases", "Cruces" and "Usuarios".
export default function EnVivo() {
  const { event, reload, setMode } = useAdmin()
  const [teams, setTeams] = useState<Named[]>([])
  const [bases, setBases] = useState<BasePoint[]>([])
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [alerts, setAlerts] = useState<{ id: string; match_id: string; message: string; created_at: string }[]>([])
  const [pending, setPending] = useState(0) // what still prevents activating a draft Carrera
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(15000)

  const eventId = event?.id
  const active = event?.is_active ?? false
  const travel = useTravelTimes(eventId)
  const rotations = useRotationTimes(eventId)

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [t, b, m, s, p, al] = await Promise.all([
      supabase.from('teams').select('id, name').eq('event_id', eventId).order('sort_order'),
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', eventId).order('sort_order'),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at, match_scores(item, winner_team_id, voided)')
        .eq('event_id', eventId)
        .order('round_number'),
      supabase.from('team_standings').select('team_id, name, photo_path, points').eq('event_id', eventId),
      active ? Promise.resolve(null) : supabase.rpc('event_problems', { p_event: eventId }),
      supabase.from('alerts').select('id, match_id, message, created_at').eq('event_id', eventId).order('created_at', { ascending: false }).limit(20),
    ])
    setAlerts(al.data ?? [])
    setTeams(t.data ?? [])
    setBases(b.data ?? [])
    setMatches((m.data ?? []) as LiveMatch[])
    setStandings(((s.data ?? []) as StandingRow[]).map((r) => ({ ...r, points: Number(r.points) })))
    setPending(((p?.data as string[] | null) ?? []).length)
  }, [eventId, active])

  // GPS positions have their own light reload: they arrive every few seconds.
  const loadPositions = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('team_locations').select('team_id, lat, lng, updated_at')
    setPositions(data ?? [])
  }, [])

  useEffect(() => {
    void load()
    void loadPositions()
  }, [load, loadPositions])

  useRealtimeReload(['matches', 'match_scores', 'bases', 'alerts'], load)
  useRealtimeReload(['team_locations'], loadPositions)

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const baseName = useMemo(() => new Map(bases.map((b) => [b.id, b.name])), [bases])

  if (!event) return <p className="warn">Primero crea una carrera en la pestaña "Carrera".</p>

  const round = currentRound(matches)
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const inRound = matches.filter((m) => m.round_number === round)
  const sharing = positions.filter((p) => teams.some((t) => t.id === p.team_id) && now - new Date(p.updated_at).getTime() < NO_SIGNAL_MS)
  const wins = (m: LiveMatch, id: string) => m.match_scores.filter((s) => s.winner_team_id === id).length

  // The coordinator can hurry the two groups of a match, or the BASE (e.g. it is taking too long in a game):
  // either gets a notification and the phone rings.
  async function hurry(m: LiveMatch, target: 'groups' | 'base') {
    const message = await promptDialog({
      title: target === 'base' ? 'Avisar a la base' : 'Avisar a los dos grupos',
      message: 'Les llega como notificación y les suena el teléfono.',
      label: 'Mensaje',
      defaultValue: target === 'base' ? 'Apúrense con el juego: el siguiente cruce está esperando.' : DEFAULT_ALERT_MESSAGE,
      confirmLabel: 'Enviar aviso',
      icon: 'bell',
    })
    if (!message) return
    setError(null)
    setNotice(null)
    const err = await sendMatchAlert(event!.id, m.id, message, target)
    if (err) setError(err)
    else setNotice(target === 'base' ? 'Aviso enviado a la base.' : 'Aviso enviado a los dos grupos.')
  }

  // Ends the Carrera: it is switched off and its progress is reset (the database does it), keeping what was prepared.
  const lateList = event.phase === 'started' ? lateTeams(matches, event.max_travel_minutes, now, travel, rotations) : []
  const late = lateList.length
  const lateIds = new Set(lateList.map((l) => l.teamId))
  const codes = flightCodes(teams)
  const flights = teams.map((t) => flightOf(t.id, matches))
  const enRuta = flights.filter((f) => f.state === 'en-ruta').length
  const enPuerta = flights.filter((f) => f.state === 'en-puerta').length
  const aterrizados = flights.filter((f) => f.state === 'aterrizado').length

  // Operations Log: only things that really happened (a base confirming an arrival, a match finished, an alert sent).
  const sign = (id: string) => codes.get(id) ?? teamName.get(id) ?? '—'
  const ops = buildOpEvents({ matches, alerts, baseName, teamName, codes })

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Live Monitoring · {event.name}</p>
          <h1>Control de vuelos</h1>
        </div>
        <div className="head-meta">
          <span className={`badge ${event.phase === 'started' ? 'ok live' : ''}`}>{active ? PHASE_LABEL[event.phase] : 'Borrador'}</span>
          {matches.length > 0 && <span>Ronda {round} de {totalRounds}</span>}
          {matches.length > 0 && <button className="ghost" onClick={() => void exportResults(event.id, event.name)}>Descargar resultados</button>}
        </div>
      </header>

      {active && <PhaseControl key={`p-${event.id}`} event={event} onChanged={reload} />}

      {!active && (
        <div className="warn">
          <strong>Esta Carrera está en borrador.</strong>{' '}
          {pending > 0 ? `Faltan ${pending} cosas para poder habilitarla.` : 'Ya está completa: puedes habilitarla.'}{' '}
          <button className="ghost" onClick={() => setMode('setup')}>Ir a Preparación</button>
        </div>
      )}
      {matches.length === 0 && (
        <div className="warn">
          Todavía no hay cruces. Arma el cronograma en <Link to="/admin/cruces">Cruces</Link>.
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok-text">{notice}</p>}

      {matches.length > 0 && (
        <div className="kpis">
          <Kpi tone="accent" label="Ronda en curso" value={`${round}/${totalRounds}`} sub={`${inRound.filter((m) => m.status === 'finished').length} de ${inRound.length} cruces terminados`} />
          <Kpi label="En ruta" value={enRuta} sub={enRuta === 1 ? 'vuelo hacia su destino' : 'vuelos hacia su destino'} />
          <Kpi label="En puerta" value={enPuerta} sub="la base confirmó su llegada" />
          <Kpi label="Aterrizados" value={`${aterrizados}/${teams.length}`} sub="con todos sus sellos" />
          <Kpi tone={late > 0 ? 'hot' : undefined} label="Demoras" value={late} sub={late === 1 ? 'vuelo tarde al traslado' : 'vuelos tarde al traslado'} />
          <Kpi label="Radar" value={`${sharing.length}/${teams.length}`} sub="vuelos con GPS" to="/admin/mapa" />
        </div>
      )}

      {matches.length > 0 && <FlightBoard teams={teams} matches={matches} baseName={baseName} codes={codes} lateIds={lateIds} />}
      {active && matches.length > 0 && <RotationPanel eventId={event.id} round={round} matches={matches} baseName={baseName} />}

      <div className="live-grid">
        <div>
          {inRound.length > 0 && (
            <section className="card">
              <div className="match-head">
                <div>
                  <p className="eyebrow">Gate Management</p>
                  <h2>Puertas · Ronda {round}</h2>
                </div>
                <span className="chip">{inRound.filter((m) => m.status === 'finished').length} de {inRound.length} terminados</span>
              </div>
              <ul className="list">
                {inRound.map((m) => {
                  const resolved = m.match_scores.length
                  return (
                    <li key={m.id} className="mrow">
                      <span className="mbase">
                        <b className="mono gate-code">{airportCode(baseName.get(m.base_id) ?? '')}</b>
                        <strong>{baseName.get(m.base_id)}</strong>
                      </span>
                      <span className="mteams">
                        {teamName.get(m.team_a)} <span className="muted mono">{sign(m.team_a)}</span> <span className="muted">vs</span> {teamName.get(m.team_b)} <span className="muted mono">{sign(m.team_b)}</span>
                      </span>
                      <span className="mmeta">
                        <span className={`badge ${m.status === 'finished' ? 'ok' : m.status === 'in_progress' ? 'ok live' : ''}`}>{STATUS_LABEL[m.status]}</span>
                      </span>
                      <span className="mscore num">{resolved > 0 ? `${wins(m, m.team_a)}–${wins(m, m.team_b)}` : '–'}</span>
                      <span className="mact">
                        {m.status !== 'finished' && (
                          <>
                            <button className="ghost icon-btn" onClick={() => void hurry(m, 'groups')} aria-label="Avisar a los grupos" title="Avisar a los dos grupos">
                              <BellRing size={18} />
                            </button>
                            <button className="ghost icon-btn" onClick={() => void hurry(m, 'base')} aria-label="Avisar a la base" title="Avisar a la base">
                              <Flag size={18} />
                            </button>
                          </>
                        )}
                      </span>
                      <span className="mdetail">
                        {resolved}/3 etapas{m.arrived_at ? ` · en puerta desde las ${formatTime(m.arrived_at)}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div className="row">
                <Link className="btn-like" to="/admin/cruces">Cronograma completo <ChevronRight size={16} aria-hidden="true" /></Link>
              </div>
            </section>
          )}
        </div>

        <div>
          {active && matches.length > 0 && (
            <DelaysPanel
              eventId={event.id}
              matches={matches}
              maxMinutes={event.max_travel_minutes}
              teamName={teamName}
              baseName={baseName}
              baseCoords={new Map(bases.filter((b) => b.lat !== null && b.lng !== null).map((b) => [b.id, [b.lng!, b.lat!] as [number, number]]))}
              teamCoords={new Map(positions.map((p) => [p.team_id, [p.lng, p.lat] as [number, number]]))}
              travel={travel}
              rotations={rotations}
            />
          )}

          <OpsLog events={ops.slice(0, 14)} />

          <section className="card">
            <h2>Top equipos</h2>
            <Ranking rows={[...standings].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, 3)} />
            <div className="row">
              <Link className="btn-like" to="/admin/puntajes">Ranking y puntajes <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
