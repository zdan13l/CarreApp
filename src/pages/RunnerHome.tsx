import { Ban, Bell, Check, ChevronDown, Compass, Flag, Route, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import BottomNav, { type NavTab } from '../components/BottomNav'
import Crest from '../components/Crest'
import Ranking from '../components/Ranking'
import RunnerMap from '../components/RunnerMap'
import { AlertBanner, AlertSettings } from '../components/Alerts'
import { useAuth } from '../lib/auth'
import { soundEnabled, useManualAlerts, useNow, useRepeatingAlert } from '../lib/alerts'
import { lateTeams } from '../lib/delays'
import { useTravelTimes } from '../lib/travel'
import { useRealtimeReload } from '../lib/realtime'
import { photoUrl } from '../lib/storage'
import { supabase } from '../lib/supabase'
import {
  ITEM_LABEL,
  SCORE_ITEMS,
  STATUS_LABEL,
  type MatchScore,
  type MatchStatus,
  type StandingRow,
} from '../types'

interface MyTeam {
  id: string
  name: string
  photo_path: string | null
  event_id: string
  team_runners: { is_gps_tracker: boolean }[] // only this runner's own row
  events: { max_travel_minutes: number } | { max_travel_minutes: number }[]
}

// Only name and photo of the base: its information and questions are private to the base.
export interface RouteMatch {
  id: string
  round_number: number
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  finished_at: string | null
  base_id: string
  bases: { name: string; location_photo_path: string | null; lat: number | null; lng: number | null } | null
  match_scores: MatchScore[]
}

type Tab = 'ronda' | 'mapa' | 'ruta' | 'top'
const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const
const TABS: NavTab<Tab>[] = [
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ICON} /> },
  { id: 'mapa', label: 'Mapa', icon: <Compass {...ICON} /> },
  { id: 'ruta', label: 'Ruta', icon: <Route {...ICON} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ICON} /> },
]

export default function RunnerHome() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('ronda')
  const [showAlerts, setShowAlerts] = useState(false) // sound and notification settings
  const [mapOpened, setMapOpened] = useState(false) // keep the map (and GPS sharing) alive once opened
  const [team, setTeam] = useState<MyTeam | null>(null)
  const [matches, setMatches] = useState<RouteMatch[]>([])
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The team this runner belongs to in the ACTIVE Carrera.
    const { data: t, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, photo_path, event_id, team_runners!inner(user_id, is_gps_tracker), events!inner(is_active, max_travel_minutes)')
      .eq('team_runners.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    if (teamErr) return // a network error is not "no active Carrera": keep what is on screen until the next refresh
    setTeam((t as MyTeam | null) ?? null)
    if (!t) return
    const [m, s] = await Promise.all([
      supabase
        .from('matches')
        .select(
          'id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at, bases(name, location_photo_path, lat, lng), match_scores(item, winner_team_id, voided)',
        )
        .eq('event_id', t.event_id)
        .order('round_number'),
      supabase.from('team_standings').select('team_id, name, photo_path, points').eq('event_id', t.event_id),
    ])
    if (m.error || s.error) return // keep what is on screen: an empty list would look like no rounds
    setMatches((m.data ?? []) as unknown as RouteMatch[])
    setStandings(((s.data ?? []) as StandingRow[]).map((r) => ({ ...r, points: Number(r.points) })))
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live: scores, matches and bases (photo) refresh the screen by themselves.
  useRealtimeReload(['match_scores', 'matches', 'bases', 'events'], load, 1500)

  const teamById = new Map(standings.map((r) => [r.team_id, r]))
  const mine = matches.filter((m) => m.team_a === team?.id || m.team_b === team?.id)
  const next = mine.find((m) => m.status !== 'finished')
  const upcoming = mine.filter((m) => m.status !== 'finished')
  const after = upcoming[1] // the match that follows the current one
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const myRow = standings.find((r) => r.team_id === team?.id)
  const events = team?.events
  const maxMinutes = (Array.isArray(events) ? events[0]?.max_travel_minutes : events?.max_travel_minutes) ?? 10
  const now = useNow()
  const travel = useTravelTimes(team?.event_id)
  const myLate = team ? lateTeams(matches, maxMinutes, now, travel).filter((l) => l.teamId === team.id) : []
  const manual = useManualAlerts(mine.map((m) => m.id))
  useRepeatingAlert(myLate.length > 0) // every 30 s while the delay lasts
  const position = myRow ? standings.filter((r) => r.points > myRow.points).length + 1 : null

  return (
    <AppShell
      title="Mi grupo"
      topActions={
        team && (
          <button
            className="ghost icon-btn bell"
            onClick={() => setShowAlerts((v) => !v)}
            aria-label="Ajustes de alertas"
            aria-expanded={showAlerts}
            title="Ajustes de alertas"
          >
            <Bell size={20} />
            {!soundEnabled() && <span className="dot" aria-hidden="true" />}
          </button>
        )
      }
    >
      {loading ? (
        <p className="loading">Cargando…</p>
      ) : !team ? (
        <section className="card">
          <p>Todavía no estás en un grupo de la Carrera activa. Avísale al coordinador.</p>
        </section>
      ) : (
        <>
          {/* Always visible and live: position and points */}
          <StatusBar name={team.name} photoPath={team.photo_path} position={position} points={myRow?.points ?? 0} />

          {showAlerts && (
            <section className="card">
              <h2>Alertas</h2>
              <p className="muted">
                Para que te avisemos cuando vayas tarde a la siguiente base: con el sonido activado suena cada 30
                segundos mientras dure la demora; con las notificaciones te llega aunque el teléfono esté bloqueado.
              </p>
              <AlertSettings />
            </section>
          )}
          {manual.alerts.map((a) => (
            <AlertBanner key={a.id} title="Aviso del coordinador" onDismiss={() => manual.dismiss(a.id)}>
              {a.message}
            </AlertBanner>
          ))}
          {myLate.map((l) => (
            <AlertBanner key={l.matchId} title={`Llevas ${l.elapsedMin} min en el traslado`}>
              El máximo para este tramo es {l.maxMin} min. ¡Apúrate hacia {matches.find((m) => m.id === l.matchId)?.bases?.name}! Si ya
              llegaste, avísale a la base.
            </AlertBanner>
          ))}

          {tab === 'ronda' && (
            <>
              {mine.length === 0 && <p className="warn">El coordinador aún no ha programado tus cruces.</p>}
              {next && <CurrentRound match={next} myId={team.id} teams={teamById} />}
              {!next && mine.length > 0 && <p className="ok-box">Terminaste todos tus cruces. ¡Buen trabajo!</p>}
              {after && (
                <section className="card next">
                  <h3>Después · Ronda {after.round_number}</h3>
                  <p>
                    <strong>{after.bases?.name}</strong>
                    <span className="muted"> contra </span>
                    <strong>{teamById.get(rivalId(after, team.id))?.name ?? '—'}</strong>
                  </p>
                </section>
              )}
            </>
          )}

          {/* Mounted after the first visit and only hidden afterwards, so GPS sharing keeps running. */}
          {(mapOpened || tab === 'mapa') && (
            <div hidden={tab !== 'mapa'}>
              <RunnerMap
                teamId={team.id}
                isTracker={team.team_runners.some((r) => r.is_gps_tracker)}
                target={next?.bases ? { name: next.bases.name, lat: next.bases.lat, lng: next.bases.lng } : null}
              />
            </div>
          )}

          {tab === 'ruta' && (
            <section className="card">
              <h2>Tu ruta</h2>
              <RouteList mine={mine} totalRounds={totalRounds} myId={team.id} nextId={next?.id} teams={teamById} />
            </section>
          )}

          {tab === 'top' && (
            <section className="card">
              <h2>Top equipos</h2>
              <Ranking rows={standings} highlightId={team.id} />
            </section>
          )}

          <BottomNav
            tabs={TABS}
            active={tab}
            onChange={(t) => {
              if (t === 'mapa') setMapOpened(true)
              setTab(t)
            }}
          />
        </>
      )}
    </AppShell>
  )
}

const rivalId = (m: RouteMatch, myId: string) => (m.team_a === myId ? m.team_b : m.team_a)
const scoreOf = (m: RouteMatch, teamId: string) => m.match_scores.filter((s) => s.winner_team_id === teamId).length

export function StatusBar({
  name,
  photoPath,
  position,
  points,
}: {
  name: string
  photoPath: string | null
  position: number | null
  points: number
}) {
  return (
    <div className="status-bar" role="status">
      <Crest name={name} photoPath={photoPath} />
      <div className="who">
        <strong>{name}</strong>
        <span className="live-label">En vivo</span>
      </div>
      <div className="stat">
        <span className="stat-label">Puesto</span>
        <span className="stat-value num">{position ?? '–'}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Pts</span>
        <span className="stat-value num">{points}</span>
      </div>
    </div>
  )
}

// What the base has scored so far in this match (live).
export function ItemResults({ match, teams }: { match: RouteMatch; teams: Map<string, StandingRow> }) {
  return (
    <ul className="item-results">
      {SCORE_ITEMS.map((item) => {
        const row = match.match_scores.find((s) => s.item === item)
        return (
          <li key={item}>
            <span>{ITEM_LABEL[item]}</span>
            {!row ? (
              <span className="pending">Por jugar</span>
            ) : row.voided ? (
              <span className="pending won">
                <Ban size={15} aria-hidden="true" /> Invalidado
              </span>
            ) : (
              <span className="won">
                <Check size={16} aria-hidden="true" /> Ganó {teams.get(row.winner_team_id ?? '')?.name ?? '—'}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function CurrentRound({
  match,
  myId,
  teams,
}: {
  match: RouteMatch
  myId: string
  teams: Map<string, StandingRow>
}) {
  const rival = teams.get(rivalId(match, myId))
  const baseUrl = photoUrl(match.bases?.location_photo_path ?? null)
  const playing = match.status === 'in_progress'
  const my = scoreOf(match, myId)
  const their = match.match_scores.filter((s) => s.winner_team_id && s.winner_team_id !== myId).length
  return (
    <section className="card next-base">
      <div className="match-head">
        <span className="round-tag">Ronda {match.round_number}</span>
        <span className={`badge ${playing ? 'ok live' : ''}`}>{playing ? 'En juego' : 'Dirígete a la base'}</span>
      </div>
      <h2>{match.bases?.name}</h2>
      {baseUrl && (
        <div className="photo-box">
          <img src={baseUrl} alt={`Dónde queda ${match.bases?.name}`} />
        </div>
      )}
      <h3>Tu rival</h3>
      <div className="rival">
        <Crest name={rival?.name} photoPath={rival?.photo_path} size="lg" />
        <p className="grow">
          <strong>{rival?.name ?? '—'}</strong>
        </p>
        {playing && (
          <span className="big-score num" aria-label={`Marcador ${my} a ${their}`}>
            {my}–{their}
          </span>
        )}
      </div>
      <h3>Resultados de la base</h3>
      <ItemResults match={match} teams={teams} />
    </section>
  )
}

// Every round of the group: base, rival and result. A finished round opens to show what the base
// scored item by item (this is where the results of past rounds live).
export function RouteList({
  mine,
  totalRounds,
  myId,
  nextId,
  teams,
}: {
  mine: RouteMatch[]
  totalRounds: number
  myId: string
  nextId?: string
  teams: Map<string, StandingRow>
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  if (totalRounds === 0) return <p className="muted">Todavía no hay rondas programadas.</p>
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  return (
    <ul className="route">
      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
        const m = mine.find((x) => x.round_number === round)
        if (!m) {
          return (
            <li key={round} className="rest">
              <div className="route-row">
                <span className="round num">R{round}</span>
                <span className="muted">Descansas</span>
                <span />
              </div>
            </li>
          )
        }
        const my = scoreOf(m, myId)
        const their = scoreOf(m, rivalId(m, myId))
        const done = m.status === 'finished'
        const chip = done
          ? { text: `${my}–${their} ${my > their ? 'Ganaron' : my < their ? 'Perdieron' : 'Igual'}`, cls: my > their ? 'win' : my < their ? 'lose' : '' }
          : { text: STATUS_LABEL[m.status], cls: m.status === 'in_progress' ? 'win' : '' }
        const row = (
          <>
            <span className="round num">R{round}</span>
            <span>
              <strong>{m.bases?.name}</strong>
              <small className="muted">vs {teams.get(rivalId(m, myId))?.name}</small>
            </span>
            <span className={`chip ${chip.cls}`}>
              {chip.text}
              {done && <ChevronDown size={14} aria-hidden="true" className={open.has(m.id) ? 'flip' : undefined} />}
            </span>
          </>
        )
        return (
          <li key={round} className={m.id === nextId ? 'now' : undefined}>
            {done ? (
              <button type="button" className="route-row" aria-expanded={open.has(m.id)} onClick={() => toggle(m.id)}>
                {row}
              </button>
            ) : (
              <div className="route-row">{row}</div>
            )}
            {done && open.has(m.id) && <ItemResults match={m} teams={teams} />}
          </li>
        )
      })}
    </ul>
  )
}
