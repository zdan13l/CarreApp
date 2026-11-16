import { BellRing, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DelaysPanel, { sendMatchAlert } from '../../components/DelaysPanel'
import Kpi from '../../components/Kpi'
import Ranking from '../../components/Ranking'
import { useNow } from '../../lib/alerts'
import { DEFAULT_ALERT_MESSAGE, lateTeams } from '../../lib/delays'
import { useRealtimeReload } from '../../lib/realtime'
import { currentRound, formatTime } from '../../lib/schedule'
import { supabase } from '../../lib/supabase'
import { useTravelTimes } from '../../lib/travel'
import { STATUS_LABEL, type MatchScore, type MatchStatus, type StandingRow } from '../../types'
import { useAdmin } from './AdminContext'

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
  const { event } = useAdmin()
  const [teams, setTeams] = useState<Named[]>([])
  const [bases, setBases] = useState<BasePoint[]>([])
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [pending, setPending] = useState(0) // what still prevents activating a draft Carrera
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(15000)

  const eventId = event?.id
  const active = event?.is_active ?? false
  const travel = useTravelTimes(eventId)

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [t, b, m, s, p] = await Promise.all([
      supabase.from('teams').select('id, name').eq('event_id', eventId).order('sort_order'),
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', eventId).order('sort_order'),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at, match_scores(item, winner_team_id, voided)')
        .eq('event_id', eventId)
        .order('round_number'),
      supabase.from('team_standings').select('team_id, name, photo_path, points').eq('event_id', eventId),
      active ? Promise.resolve(null) : supabase.rpc('event_problems', { p_event: eventId }),
    ])
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

  useRealtimeReload(['matches', 'match_scores', 'bases'], load)
  useRealtimeReload(['team_locations'], loadPositions)

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const baseName = useMemo(() => new Map(bases.map((b) => [b.id, b.name])), [bases])

  if (!event) return <p className="warn">Primero crea una Carrera en la pestaña "Carrera".</p>

  const round = currentRound(matches)
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const inRound = matches.filter((m) => m.round_number === round)
  const finished = matches.filter((m) => m.status === 'finished').length
  const sharing = positions.filter((p) => teams.some((t) => t.id === p.team_id) && now - new Date(p.updated_at).getTime() < NO_SIGNAL_MS)
  const wins = (m: LiveMatch, id: string) => m.match_scores.filter((s) => s.winner_team_id === id).length

  async function hurry(m: LiveMatch) {
    const message = window.prompt('Mensaje para los grupos y la base de este cruce:', DEFAULT_ALERT_MESSAGE)
    if (!message?.trim()) return
    setError(null)
    setNotice(null)
    const err = await sendMatchAlert(event!.id, m.id, message)
    if (err) setError(err)
    else setNotice('Aviso enviado a los grupos y a la base.')
  }

  const late = active ? lateTeams(matches, event.max_travel_minutes, now, travel).length : 0

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{event.name}</p>
          <h1>En vivo</h1>
        </div>
        <div className="head-meta">
          <span className={`badge ${active ? 'ok live' : ''}`}>{active ? 'Activa' : 'Borrador'}</span>
          {matches.length > 0 && <span>Ronda {round} de {totalRounds}</span>}
        </div>
      </header>

      {!active && (
        <div className="warn">
          <strong>Esta Carrera está en borrador.</strong>{' '}
          {pending > 0 ? `Faltan ${pending} cosas para poder activarla.` : 'Ya está completa: puedes activarla.'}{' '}
          <Link to="/admin/carrera">Ir a Carrera</Link>
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
          <Kpi label="Cruces" value={`${finished}/${matches.length}`} sub="terminados en la Carrera" to="/admin/cruces" />
          <Kpi tone={late > 0 ? 'hot' : undefined} label="Demoras" value={late} sub={late === 1 ? 'grupo tarde al traslado' : 'grupos tarde al traslado'} />
          <Kpi label="Ubicación" value={`${sharing.length}/${teams.length}`} sub="grupos compartiendo GPS" to="/admin/mapa" />
        </div>
      )}

      <div className="live-grid">
        <div>
          {inRound.length > 0 && (
            <section className="card">
              <div className="match-head">
                <h2>Ronda {round}</h2>
                <span className="chip">{inRound.filter((m) => m.status === 'finished').length} de {inRound.length} terminados</span>
              </div>
              <ul className="list">
                {inRound.map((m) => {
                  const resolved = m.match_scores.length
                  return (
                    <li key={m.id} className="mrow">
                      <span className="mbase">
                        <strong>{baseName.get(m.base_id)}</strong>
                      </span>
                      <span className="mteams">
                        {teamName.get(m.team_a)} <span className="muted">vs</span> {teamName.get(m.team_b)}
                      </span>
                      <span className="mmeta">
                        <span className={`badge ${m.status === 'finished' ? 'ok' : m.status === 'in_progress' ? 'ok live' : ''}`}>{STATUS_LABEL[m.status]}</span>
                      </span>
                      <span className="mscore num">{resolved > 0 ? `${wins(m, m.team_a)}–${wins(m, m.team_b)}` : '–'}</span>
                      <span className="mact">
                        {m.status !== 'finished' && (
                          <button className="ghost icon-btn" onClick={() => void hurry(m)} aria-label="Enviar aviso" title="Enviar aviso a los grupos y la base">
                            <BellRing size={18} />
                          </button>
                        )}
                      </span>
                      <span className="mdetail">
                        {resolved}/3 ítems{m.arrived_at ? ` · llegaron a las ${formatTime(m.arrived_at)}` : ''}
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
            />
          )}

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
