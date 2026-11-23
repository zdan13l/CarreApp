import { Ban, BookMarked, Check, LocateFixed, MapPin, Stamp as StampIcon, Trophy, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import BottomNav, { type NavTab } from '../components/BottomNav'
import Crest from '../components/Crest'
import Passport from '../components/Passport'
import Stamp from '../components/Stamp'
import StampMoment from '../components/StampMoment'
import LocationShare from '../components/LocationShare'
import TeamNames from '../components/TeamNames'
import TeamDialog from '../components/TeamDialog'
import NoActiveCarrera from '../components/NoActiveCarrera'
import LoadFailed from '../components/LoadFailed'
import { AlertBanner } from '../components/Alerts'
import PhaseBanner from '../components/PhaseBanner'
import Tutorial from '../components/Tutorial'
import { runnerTutorial } from '../lib/tutorials'
import { useAuth } from '../lib/auth'
import { disableSound, useManualAlerts, useNow, useRepeatingAlert } from '../lib/alerts'
import { disablePush } from '../lib/push'
import { lateTeams } from '../lib/delays'
import { useTravelTimes } from '../lib/travel'
import { useRotationTimes } from '../lib/rotations'
import type { EventPhase } from '../types'
import { useRealtimeReload } from '../lib/realtime'
import { photoUrl } from '../lib/storage'
import { registerSealRoster } from '../lib/seals'
import { airportCode, flightCodes, stageStates } from '../lib/flight'
import { stampTime } from '../lib/stamp'
import { supabase } from '../lib/supabase'
import {
  ITEM_LABEL,
  type MatchScore,
  type MatchStatus,
} from '../types'

// Name and picture of a group. The runner never loads the points of the other groups: nobody knows who leads
// until it is announced.
export interface TeamLite {
  team_id: string
  name: string
  photo_path: string | null
}

interface MyTeam {
  id: string
  name: string
  photo_path: string | null
  event_id: string
  team_runners: { is_gps_tracker: boolean }[] // only this runner's own row
  events: RunnerEvent | RunnerEvent[]
}
interface RunnerEvent {
  max_travel_minutes: number
  phase: EventPhase
  started_at: string | null
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

type Tab = 'ronda' | 'ubicacion' | 'ruta' | 'top'
const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const
const TABS: NavTab<Tab>[] = [
  { id: 'ronda', label: 'Visado', icon: <StampIcon {...ICON} /> },
  { id: 'ruta', label: 'Pasaporte', icon: <BookMarked {...ICON} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ICON} /> },
]
// Only the group's designated runner shares the location (the group's shared user), so only they get this tab.
const LOCATION_TAB: NavTab<Tab> = { id: 'ubicacion', label: 'Ubicación', icon: <LocateFixed {...ICON} /> }

export default function RunnerHome() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('ronda')
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd') // which way the page slides when the tab changes
  const [tour, setTour] = useState<{ from: Tab } | null>(null) // the tutorial is open (and the tab to come back to)
  const [locationOpened, setLocationOpened] = useState(false) // keep the map (and GPS sharing) alive once opened
  const [team, setTeam] = useState<MyTeam | null>(null)
  const [matches, setMatches] = useState<RouteMatch[]>([])
  const [teams, setTeams] = useState<TeamLite[]>([])
  const [bases, setBases] = useState<{ id: string; name: string; lat: number | null; lng: number | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false) // the last request failed (network), which is not the same as having no Carrera
  const [moment, setMoment] = useState<RouteMatch | null>(null) // the stamp that has just been earned
  const [contacts, setContacts] = useState<Map<string, string[]>>(new Map()) // team -> the @ of its runners (migration 0021)
  const [viewTeam, setViewTeam] = useState<string | null>(null) // the group whose card is open
  const seen = useRef<Set<string> | null>(null) // matches already finished when the screen opened

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The team this runner belongs to in the ACTIVE Carrera.
    const { data: t, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, photo_path, event_id, team_runners!inner(user_id, is_gps_tracker), events!inner(is_active, max_travel_minutes, phase, started_at)')
      .eq('team_runners.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    if (teamErr) {
      setLoadFailed(true) // a network error is not "no active Carrera": say so (or keep what is on screen) until the next refresh
      return
    }
    setLoadFailed(false)
    setTeam((t as MyTeam | null) ?? null)
    if (!t) return
    const [m, tm, bs, ct] = await Promise.all([
      supabase
        .from('matches')
        .select(
          'id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at, bases(name, location_photo_path, lat, lng), match_scores(item, winner_team_id, voided)',
        )
        .eq('event_id', t.event_id)
        .order('round_number'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', t.event_id),
      supabase.from('bases').select('id, name, lat, lng').eq('event_id', t.event_id),
      supabase.rpc('team_contacts'),
    ])
    if (m.error || tm.error || bs.error) return // keep what is on screen: an empty list would look like no rounds
    setMatches((m.data ?? []) as unknown as RouteMatch[])
    setTeams((tm.data ?? []).map((x) => ({ team_id: x.id, name: x.name, photo_path: x.photo_path })))
    registerSealRoster((bs.data ?? []).map((x) => x.id), t.event_id)
    setBases(bs.data ?? [])
    if (!ct.error) {
      const byTeam = new Map<string, string[]>()
      for (const row of (ct.data ?? []) as { team_id: string; username: string }[]) byTeam.set(row.team_id, [...(byTeam.get(row.team_id) ?? []), row.username])
      setContacts(byTeam) // without the migration the card simply has no @
    }
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live: scores, matches and bases (photo) refresh the screen by themselves.
  useRealtimeReload(['match_scores', 'matches', 'bases', 'events'], load, 1500)

  const teamById = new Map(teams.map((r) => [r.team_id, r]))
  const mine = matches.filter((m) => m.team_a === team?.id || m.team_b === team?.id)
  const next = mine.find((m) => m.status !== 'finished')
  const upcoming = mine.filter((m) => m.status !== 'finished')
  const after = upcoming[1] // the match that follows the current one
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  // The group's own points, counted from its own matches (the database shows a runner no other score).
  const myPoints = mine.reduce((n, m) => n + m.match_scores.filter((x) => x.winner_team_id === team?.id).length, 0)
  const isTracker = Boolean(team?.team_runners.some((r) => r.is_gps_tracker))
  const events = team?.events
  const ev = Array.isArray(events) ? events[0] : events
  const maxMinutes = ev?.max_travel_minutes ?? 10
  const phase: EventPhase = ev?.phase ?? 'started'
  // when the Carrera is over the sound and the notifications of this phone are turned off (nothing odd rings afterwards)
  useEffect(() => {
    if (phase !== 'finished') return
    disableSound()
    void disablePush().catch(() => {})
  }, [phase])
  const now = useNow()
  const travel = useTravelTimes(team?.event_id)
  const rotations = useRotationTimes(team?.event_id)
  const myLate = team && phase === 'started' ? lateTeams(matches, maxMinutes, now, travel, rotations).filter((l) => l.teamId === team.id) : []
  const manual = useManualAlerts(mine.map((m) => m.id), 'groups', team?.id, phase === 'started')
  useRepeatingAlert(myLate.length > 0) // every 30 s while the delay lasts
  const closeMoment = useCallback(() => setMoment(null), [])
  const flight = team ? flightCodes(teams.map((t) => ({ id: t.team_id, name: t.name }))).get(team.id) ?? 'JV 200' : ''

  // The base scores the third stage of a match -> a new stamp. The first load only records what was already stamped.
  useEffect(() => {
    if (!team || matches.length === 0) return
    const mineNow = matches.filter((m) => m.team_a === team.id || m.team_b === team.id)
    const ids = new Set(mineNow.filter((m) => m.status === 'finished').map((m) => m.id))
    if (seen.current === null) {
      seen.current = ids
      return
    }
    const fresh = mineNow.filter((m) => m.status === 'finished' && !seen.current!.has(m.id))
    seen.current = ids
    if (fresh.length > 0) setMoment(fresh[fresh.length - 1])
  }, [team, matches])

  const goTab = (t: Tab) => {
    if (t === 'ubicacion') setLocationOpened(true)
    const order = (isTracker ? [TABS[0], LOCATION_TAB, TABS[1], TABS[2]] : TABS).map((x) => x.id)
    setDir(order.indexOf(t) >= order.indexOf(tab) ? 'fwd' : 'back')
    setTab(t)
  }

  return (
    <AppShell
      title={tab === 'ronda' ? 'Mi grupo' : TABS.concat(LOCATION_TAB).find((t) => t.id === tab)?.label ?? 'Mi grupo'}
      showTitle={tab === 'ronda'}
      alerts={Boolean(team)}
    >
      {loading ? (
        <p className="loading">Cargando…</p>
      ) : !team ? (
        loadFailed ? <LoadFailed onRetry={() => void load()} /> : <NoActiveCarrera role="runner" />
      ) : (
        <>
          <PhaseBanner phase={phase} onTutorial={() => setTour({ from: tab })} />
          {manual.alerts.map((a) => (
            <AlertBanner key={a.id} title="Aviso del coordi" onDismiss={() => manual.dismiss(a.id)}>
              {a.message}
            </AlertBanner>
          ))}
          {myLate.map((l) => (
            <AlertBanner key={l.matchId} title={`Llevas ${l.elapsedMin} min en el traslado`}>
              El máximo para este tramo es {l.maxMin} min. ¡Apúrate hacia {matches.find((m) => m.id === l.matchId)?.bases?.name}! Si ya
              llegaste, avísale a la base.
            </AlertBanner>
          ))}

          {tab !== 'ubicacion' && (
          <div key={tab} className={`tab-view ${dir}`}>
          {tab === 'ronda' && (
            <>
              {/* Only in Visado: who we are and the group's own points (nobody sees who leads) */}
              <StatusBar name={team.name} photoPath={team.photo_path} points={myPoints} />
              {mine.length === 0 && <p className="warn">El coordi aún no ha programado tus cruces.</p>}
              {next && <CurrentRound match={next} myId={team.id} teams={teamById} totalRounds={totalRounds} />}
              {!next && mine.length > 0 && (
                <FinishedCard
                  team={team.name}
                  matches={mine}
                  onPassport={() => {
                    setDir('fwd')
                    setTab('ruta')
                    window.scrollTo({ top: 0 })
                  }}
                />
              )}
              {after && (
                <AfterCard match={after} myId={team.id} teams={teamById} />
              )}
            </>
          )}

          {tab === 'ruta' && (
            <Passport
              team={team.name}
              flight={flight}
              mine={mine}
              totalRounds={totalRounds}
              nextId={next?.id}
              newId={moment?.id}
              detail={(m) => <ItemResults match={mine.find((x) => x.id === m.id) ?? mine[0]} teams={teamById} />}
            />
          )}

          {tab === 'top' && <TopTab teamId={team.id} points={myPoints} teams={teams} onSelect={setViewTeam} />}
          </div>
          )}
          {/* Mounted after the first visit and only hidden afterwards, so GPS sharing keeps running. */}
          {isTracker && (locationOpened || tab === 'ubicacion') && (
            <div hidden={tab !== 'ubicacion'} className={`tab-view ${dir}`}>
              <LocationShare teamId={team.id} bases={bases} />
            </div>
          )}


          <BottomNav
            tabs={isTracker ? [TABS[0], LOCATION_TAB, TABS[1], TABS[2]] : TABS}
            active={tab}
            transition={false}
            onChange={goTab}
          />
          {tour && (
            <Tutorial
              steps={runnerTutorial(isTracker)}
              onTab={(t) => goTab(t as Tab)}
              onClose={() => {
                goTab(tour.from)
                setTour(null)
              }}
            />
          )}
          {viewTeam && teamById.get(viewTeam) && (
            <TeamDialog
              name={teamById.get(viewTeam)!.name}
              photoPath={teamById.get(viewTeam)!.photo_path}
              usernames={contacts.get(viewTeam) ?? []}
              onClose={() => setViewTeam(null)}
            />
          )}
          {moment && (
            <StampMoment
              seed={moment.base_id}
              name={moment.bases?.name ?? 'Base'}
              photoPath={moment.bases?.location_photo_path ?? null}
              round={moment.round_number}
              time={stampTime(moment.finished_at)}
              onClose={closeMoment}
            />
          )}
        </>
      )}
    </AppShell>
  )
}

const rivalId = (m: RouteMatch, myId: string) => (m.team_a === myId ? m.team_b : m.team_a)

// "Próximo destino": the match after the current one, as a boarding pass in the navy blue. On the left the destination (its picture, name and
// gate) and the rival; on the stub the airport code of the destination.
export function AfterCard({ match, myId, teams }: { match: RouteMatch; myId: string; teams: Map<string, TeamLite> }) {
  const rival = teams.get(rivalId(match, myId))
  const url = photoUrl(match.bases?.location_photo_path ?? null)
  const name = match.bases?.name ?? 'Base'
  return (
    <div className="tc-wrap">
      <section className="tc next-ticket" aria-label={`Próximo destino: ${name}`}>
        <div className="tc-main">
          <p className="tc-kicker">Próximo destino · Puerta {match.round_number}</p>
          <strong className="tc-name">{name}</strong>
          <div className="nt-row">
            {url ? (
              <img className="nt-photo" src={url} alt={`Dónde queda ${name}`} loading="lazy" decoding="async" />
            ) : (
              <span className="nt-photo empty" aria-hidden="true">
                <MapPin size={26} />
              </span>
            )}
            <div className="nt-rival">
              <small>Tu rival</small>
              <span>
                <Crest name={rival?.name} photoPath={rival?.photo_path} size="sm" />
                <strong>{rival?.name ?? '—'}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="tc-stub" aria-hidden="true">
          <span className="tc-code">{airportCode(name)}</span>
          <small>Destino</small>
        </div>
      </section>
    </div>
  )
}

// The whole route is done: a celebration with the stamps earned and a way to the passport.
export function FinishedCard({ team, matches, onPassport }: { team: string; matches: RouteMatch[]; onPassport: () => void }) {
  return (
    <section className="finish" aria-label="Recorrido completo">
      <Trophy className="finish-trophy" size={34} aria-hidden="true" />
      <p className="finish-kicker">Carrera 2710</p>
      <h2>¡Recorrido completo!</h2>
      <p className="finish-sub">{team} pasó por todas sus bases.</p>
      <div className="finish-stamps">
        {matches.map((m, i) => (
          <span key={m.id} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
            <Stamp seed={m.base_id} name={m.bases?.name ?? `Ronda ${m.round_number}`} photoPath={m.bases?.location_photo_path} round={m.round_number} state="done" size={74} straight />
          </span>
        ))}
      </div>
      <p className="finish-count num">
        {matches.length}
        <small>{matches.length === 1 ? 'sello' : 'sellos'}</small>
      </p>
      <button type="button" className="finish-btn" onClick={onPassport}>
        <BookMarked size={18} aria-hidden="true" />
        Ver mi pasaporte
      </button>
    </section>
  )
}
const scoreOf = (m: RouteMatch, teamId: string) => m.match_scores.filter((s) => s.winner_team_id === teamId).length

export function StatusBar({ name, photoPath, points }: { name: string; photoPath: string | null; points?: number }) {
  return (
    <div className="tc-wrap">
      <section className="tc status-ticket" role="status" aria-label={`Pasajero ${name}`}>
        <div className="tc-main">
          <p className="tc-kicker">Pasajero</p>
          <div className="tc-row">
            <Crest name={name} photoPath={photoPath} size="lg" />
            <div className="tc-info">
              <strong className="tc-name">{name}</strong>
              <span className="tc-chips">
                <span className="live-label">En vivo</span>
              </span>
            </div>
          </div>
        </div>
        {points !== undefined && (
          <div className="tc-stub" aria-label={`${points} ${points === 1 ? 'punto' : 'puntos'}`}>
            <span className="tc-code num">{points}</span>
            <small>{points === 1 ? 'punto' : 'puntos'}</small>
          </div>
        )}
      </section>
    </div>
  )
}

// "Top": the same passenger ticket as Visado (name, live, points) and, under a white title card, the OTHER groups of the Carrera by name
// and picture (no points and no order of merit).
export function TopTab({ teamId, points, teams, onSelect }: { teamId: string; points: number; teams: TeamLite[]; onSelect?: (id: string) => void }) {
  const mine = teams.find((t) => t.team_id === teamId)
  const others = teams.filter((t) => t.team_id !== teamId)
  return (
    <div className="top-view">
      <StatusBar name={mine?.name ?? '—'} photoPath={mine?.photo_path ?? null} points={points} />
      {others.length > 0 && (
        <section className="top-others" aria-label="Los demás equipos">
          <h2 className="title-tag">
            <Users size={18} aria-hidden="true" />
            Los demás equipos
            <b className="num">{others.length}</b>
          </h2>
          <div className="card">
            <TeamNames teams={others.map((t) => ({ id: t.team_id, name: t.name, photo_path: t.photo_path }))} onSelect={onSelect} />
          </div>
        </section>
      )}
    </div>
  )
}

// The three stages of a destination (barra, pregunta, minijuego), live: done once the base has scored it, with who won.
export function ItemResults({ match, teams, compact = false }: { match: RouteMatch; teams: Map<string, TeamLite>; compact?: boolean }) {
  const stages = stageStates(match.match_scores, Boolean(match.arrived_at) || match.status === 'in_progress')
  return (
    <ol className={`stages${compact ? ' compact' : ''}`}>
      {stages.map(({ item, state }, i) => {
        const row = match.match_scores.find((s) => s.item === item)
        return (
          <li key={item} className={`stage ${state}`}>
            <span className="stage-dot" aria-hidden="true">{state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            <span className="stage-name">{ITEM_LABEL[item]}</span>
            {!row ? (
              <span className="stage-res pending">{state === 'active' ? 'En juego' : 'Por jugar'}</span>
            ) : row.voided ? (
              <span className="stage-res pending">
                <Ban size={15} aria-hidden="true" /> Invalidado
              </span>
            ) : (
              <span className="stage-res won">Ganó {teams.get(row.winner_team_id ?? '')?.name ?? '—'}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function CurrentRound({
  match,
  myId,
  teams,
  totalRounds,
}: {
  match: RouteMatch
  myId: string
  teams: Map<string, TeamLite>
  totalRounds?: number
}) {
  const rival = teams.get(rivalId(match, myId))
  const baseUrl = photoUrl(match.bases?.location_photo_path ?? null)
  const name = match.bases?.name ?? 'Base'
  const playing = match.status === 'in_progress'
  const atGate = Boolean(match.arrived_at) || playing
  const my = scoreOf(match, myId)
  const their = match.match_scores.filter((s) => s.winner_team_id && s.winner_team_id !== myId).length
  return (
    <section className="dest">
      <div className="dest-photo">
        {baseUrl ? (
          <img src={baseUrl} alt={`Dónde queda ${name}`} decoding="async" />
        ) : (
          <span className="visa-nophoto" aria-hidden="true">
            <MapPin size={34} />
          </span>
        )}
        <div className="dest-sign">
          <span className="gate-sign">
            <small>Puerta</small>
            <b className="num">{String(match.round_number).padStart(2, '0')}</b>
          </span>
          <span className="dest-code mono">{airportCode(name)}</span>
          <span className={`flap ${playing ? 'live' : atGate ? 'gate' : 'route'}`}>{playing ? 'En juego' : atGate ? 'En puerta' : 'Disponible'}</span>
        </div>
        <div className="dest-cap">
          <span className="visa-kicker">
            Destino {match.round_number}
            {totalRounds ? ` de ${totalRounds}` : ''}
          </span>
          <h2>{name}</h2>
        </div>
      </div>
      <div className="dest-body">
        <div className="dest-vs">
          <Crest name={rival?.name} photoPath={rival?.photo_path} size="sm" />
          <span className="dest-vs-name">
            <small>Contra</small>
            <strong>{rival?.name ?? '—'}</strong>
          </span>
          {playing && (
            <b className="big-score num" aria-label={`Marcador ${my} a ${their}`}>
              {my}–{their}
            </b>
          )}
        </div>
        <ItemResults match={match} teams={teams} compact />
        <div className="visa-slot">
          <Stamp seed={match.base_id} name={name} photoPath={match.bases?.location_photo_path} round={match.round_number} state="current" atGate={atGate} size={150} />
          <p>{atGate ? 'Estás en la puerta: se sella al calificar las tres etapas.' : 'Tu sello te espera: se estampa al calificar las tres etapas.'}</p>
        </div>
      </div>
    </section>
  )
}
