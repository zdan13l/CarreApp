import { Ban, BellRing, BookOpen, Check, CircleHelp, ClipboardCheck, Flag, MapPin, Send, Trophy, Users, UsersRound, Shuffle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import AppShell from '../components/AppShell'
import { AlertBanner } from '../components/Alerts'
import { sendMatchAlert } from '../components/DelaysPanel'
import BaseLocationEditor from '../components/BaseLocationEditor'
import BottomNav, { type NavTab } from '../components/BottomNav'
import Crest from '../components/Crest'
import Stamp from '../components/Stamp'
import PhotoField from '../components/PhotoField'
import NoActiveCarrera from '../components/NoActiveCarrera'
import LoadFailed from '../components/LoadFailed'
import BaseSealCard from '../components/BaseSealCard'
import TeamDialog from '../components/TeamDialog'
import TeamNames from '../components/TeamNames'
import { useAuth } from '../lib/auth'
import { serverNow } from '../lib/clock'
import { useManualAlerts, useNow } from '../lib/alerts'
import { clockText, legInfo, legRemainingSec, type LegInfo, type TimedMatch } from '../lib/delays'
import { airportCode, flightCodes } from '../lib/flight'
import { stampLook } from '../lib/stamp'
import { useTravelTimes } from '../lib/travel'
import { useRealtimeReload } from '../lib/realtime'
import { photoUrl, uploadPhoto } from '../lib/storage'
import { supabase } from '../lib/supabase'
import {
  ITEM_LABEL,
  SCORE_ITEMS,
  STATUS_LABEL,
  infoOf,
  type BaseQuestion,
  type InfoEmbed,
  type MatchScore,
  type MatchStatus,
  type ScoreItem,
} from '../types'
import { confirmDialog } from '../lib/dialog'

interface MyBase {
  id: string
  name: string
  location_photo_path: string | null
  lat: number | null
  lng: number | null
  base_details: InfoEmbed
  event_id: string
  base_questions: BaseQuestion[]
  events: { max_travel_minutes: number } | { max_travel_minutes: number }[]
}

export interface BaseMatch {
  id: string
  round_number: number
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  match_scores: MatchScore[]
}

export interface Team {
  id: string
  name: string
  photo_path: string | null
}

type Tab = 'ronda' | 'resultados' | 'base'
const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const
const TABS: NavTab<Tab>[] = [
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ICON} /> },
  { id: 'resultados', label: 'Resultados', icon: <Trophy {...ICON} /> },
  { id: 'base', label: 'Mi base', icon: <MapPin {...ICON} /> },
]

// Every base prints its stamp in one ink (drawn from its id, like the stamp itself): that ink is the accent of the whole screen.
const inkStyle = (baseId: string) => ({ '--base-ink': `var(--ink-${stampLook(baseId).ink})` }) as CSSProperties

export default function BaseHome() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('ronda')
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd') // which way the page slides when the tab changes
  const [base, setBase] = useState<MyBase | null>(null)
  const [matches, setMatches] = useState<BaseMatch[]>([])
  const [teams, setTeams] = useState<Map<string, Team>>(new Map())
  const [eventMatches, setEventMatches] = useState<TimedMatch[]>([]) // every match, to know when teams left their previous base
  const [baseNames, setBaseNames] = useState<Map<string, string>>(new Map()) // where each group comes from
  const [loading, setLoading] = useState(true)
  const [viewTeam, setViewTeam] = useState<string | null>(null) // the group whose photo is open in big
  const [rotations, setRotations] = useState<{ id: string; round_number: number }[]>([]) // rounds the coordinator said can rotate (0029)
  const [rotated, setRotated] = useState<Set<string>>(new Set()) // the rotations this base already confirmed
  const [rotating, setRotating] = useState(false)
  const [rotationError, setRotationError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false) // the last request failed (network), which is not the same as having no Carrera

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The base this inductor staffs in the ACTIVE Carrera.
    const sb = supabase
    const readBase = (withAnswers: boolean) =>
      withAnswers
        ? sb
            .from('bases')
            .select(
              'id, name, location_photo_path, lat, lng, event_id, base_details(info), base_questions(position, question, answer), base_staff!inner(user_id), events!inner(is_active, max_travel_minutes)',
            )
            .eq('base_staff.user_id', userId)
            .eq('events.is_active', true)
            .maybeSingle()
        : sb
            .from('bases')
            .select(
              'id, name, location_photo_path, lat, lng, event_id, base_details(info), base_questions(position, question), base_staff!inner(user_id), events!inner(is_active, max_travel_minutes)',
            )
            .eq('base_staff.user_id', userId)
            .eq('events.is_active', true)
            .maybeSingle()
    let { data: b, error: baseErr } = await readBase(true)
    if (baseErr && /answer|column|schema cache/i.test(baseErr.message)) ({ data: b, error: baseErr } = await readBase(false)) // migration 0030 is not applied yet
    if (baseErr) {
      setLoadFailed(true) // a network error is not "no active Carrera": say so (or keep what is on screen) until the next refresh
      return
    }
    setLoadFailed(false)
    setBase((b as MyBase | null) ?? null)
    if (!b) return
    const [m, t, all, bs] = await Promise.all([
      supabase
        .from('matches')
        .select('id, round_number, team_a, team_b, status, arrived_at, match_scores(item, winner_team_id, voided)')
        .eq('base_id', b.id)
        .order('round_number'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', b.event_id),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at')
        .eq('event_id', b.event_id),
      supabase.from('bases').select('id, name').eq('event_id', b.event_id),
    ])
    if (m.error || t.error || all.error) return // keep what is on screen on a failed request
    setEventMatches((all.data ?? []) as TimedMatch[])
    if (!bs.error) setBaseNames(new Map((bs.data ?? []).map((x) => [x.id as string, x.name as string])))
    setMatches((m.data ?? []) as BaseMatch[])
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x])))
    const rot = await supabase.from('round_rotations').select('id, round_number').eq('event_id', b.event_id)
    if (!rot.error) {
      setRotations((rot.data ?? []) as { id: string; round_number: number }[])
      const mine = await supabase.from('rotation_acks').select('rotation_id').eq('base_id', b.id)
      if (!mine.error) setRotated(new Set((mine.data ?? []).map((x) => x.rotation_id as string)))
    }
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live refresh when scores change (another inductor of the same base, or a correction).
  useRealtimeReload(['match_scores', 'matches', 'bases', 'events', 'round_rotations', 'rotation_acks'], load, 1500)

  const current = useMemo(() => matches.find((m) => m.status !== 'finished'), [matches])
  const finished = matches.filter((m) => m.status === 'finished')
  // After scoring a match the groups rotate to their next base: it waits for the coordinator's word, then the base confirms it let them go.
  const lastFinished = finished[finished.length - 1]
  const rotation = lastFinished ? rotations.find((r) => r.round_number === lastFinished.round_number) : undefined
  // only once the three stages of that match are scored (a voided one counts: the coordinator decided it was not played)
  const showRotation = Boolean(lastFinished && lastFinished.match_scores.length >= SCORE_ITEMS.length && current && current.arrived_at === null)
  // the groups are let go once: until then the rotation button is the ONLY thing on the Ronda tab; right after, the next match starts with its clock
  const rotationPending = showRotation && !(rotation && rotated.has(rotation.id))
  const codes = useMemo(() => flightCodes([...teams.values()]), [teams]) // the "flight" of each group, as the runners see it

  const events = base?.events
  const maxMinutes = (Array.isArray(events) ? events[0]?.max_travel_minutes : events?.max_travel_minutes) ?? 10
  const travel = useTravelTimes(base?.event_id)
  const fromCoordinator = useManualAlerts(matches.map((m) => m.id), 'base') // rings the phone while it is fresh

  // Where each group of the match comes from and how long it still has to get here (its own leg time, or the Carrera's maximum).
  const legsOf = (m: BaseMatch): Record<string, LegInfo> => ({
    [m.team_a]: legInfo(eventMatches, m.id, m.team_a, maxMinutes, travel),
    [m.team_b]: legInfo(eventMatches, m.id, m.team_b, maxMinutes, travel),
  })

  async function confirmRotation() {
    if (!supabase || !base || !rotation || !lastFinished) return
    const names = [teams.get(lastFinished.team_a)?.name, teams.get(lastFinished.team_b)?.name].filter((n): n is string => Boolean(n))
    if (!(await confirmDialog({ title: '¿Ya dejaste ir a los dos grupos?', details: names, confirmLabel: 'Sí, ya se fueron', icon: 'check' }))) return
    setRotating(true)
    setRotationError(null)
    const { error: err } = await supabase.from('rotation_acks').insert({ rotation_id: rotation.id, base_id: base.id })
    if (err && !/duplicate|unique/i.test(err.message)) setRotationError(friendlyError(err.message, 'No se pudo confirmar. Revisa tu conexión e inténtalo de nuevo.'))
    await load()
    setRotating(false)
  }

  return (
    <AppShell
      title={tab === 'ronda' ? 'Mi base' : TABS.find((t) => t.id === tab)?.label ?? 'Mi base'}
      showTitle={tab === 'ronda'}
      alerts={Boolean(base)}
    >
      {loading ? (
        <p className="loading">Cargando…</p>
      ) : !base ? (
        loadFailed ? <LoadFailed onRetry={() => void load()} /> : <NoActiveCarrera role="base" />
      ) : (
        <div className="base-view" style={inkStyle(base.id)}>
          {fromCoordinator.alerts.map((a) => (
            <AlertBanner key={a.id} title="Aviso del coordinador" onDismiss={() => fromCoordinator.dismiss(a.id)}>
              {a.message}
            </AlertBanner>
          ))}
          <div key={tab} className={`tab-view ${dir}`}>
            {tab === 'ronda' && (
              <>
                <BaseTicket name={base.name} photoPath={base.location_photo_path} sealed={finished.length} />
                {matches.length === 0 && <p className="warn">El coordinador aún no ha programado cruces para tu base.</p>}
                {rotationPending && lastFinished ? (
                  <RotationCard
                    state={rotation ? 'ready' : 'waiting'}
                    names={[teams.get(lastFinished.team_a)?.name, teams.get(lastFinished.team_b)?.name].filter((n): n is string => Boolean(n))}
                    busy={rotating}
                    error={rotationError}
                    onConfirm={() => void confirmRotation()}
                  />
                ) : (
                  current && <MatchCard key={current.id} match={current} teams={teams} onSent={load} eventId={base.event_id} base={base} codes={codes} legs={legsOf(current)} baseNames={baseNames} />
                )}
                {current === undefined && matches.length > 0 && <ClosedDesk name={base.name} sealed={finished.length} />}
              </>
            )}

            {tab === 'resultados' && (
              <>
                <BaseTicket name={base.name} photoPath={base.location_photo_path} sealed={finished.length} />
                <section className="top-others" aria-label="Equipos de la Carrera">
                  <h2 className="title-tag">
                    <Users size={18} aria-hidden="true" />
                    Equipos de la Carrera
                    <b className="num">{teams.size}</b>
                  </h2>
                  <div className="card">
                    <TeamNames teams={[...teams.values()]} onSelect={setViewTeam} />
                  </div>
                </section>
                <section className="top-others" aria-label="Cruces de tu base">
                  <h2 className="title-tag">
                    <ClipboardCheck size={18} aria-hidden="true" />
                    Cruces de tu base
                    <b className="num">{finished.length}</b>
                  </h2>
                  <div className="card">
                    {finished.length === 0 && <p className="muted">Todavía no has terminado ningún cruce.</p>}
                    <ul className="list">
                      {finished.map((m) => (
                        <li key={m.id} className="with-items">
                          <span className="round-tag">R{m.round_number}</span>
                          <span className="grow">
                            {teams.get(m.team_a)?.name} <span className="muted">vs</span> {teams.get(m.team_b)?.name}
                          </span>
                          <strong className="num">
                            {m.match_scores.filter((x) => x.winner_team_id === m.team_a).length}–
                            {m.match_scores.filter((x) => x.winner_team_id === m.team_b).length}
                          </strong>
                          <WonItems match={m} teams={teams} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </>
            )}

            {tab === 'base' && <MyBaseTab base={base} onChanged={load} />}
          </div>

          {viewTeam && teams.get(viewTeam) && <TeamDialog name={teams.get(viewTeam)!.name} photoPath={teams.get(viewTeam)!.photo_path} usernames={[]} onClose={() => setViewTeam(null)} />}

          <BottomNav
            tabs={TABS}
            active={tab}
            transition={false}
            onChange={(t) => {
              setDir(TABS.findIndex((x) => x.id === t) >= TABS.findIndex((x) => x.id === tab) ? 'fwd' : 'back')
              setTab(t)
            }}
          />
        </div>
      )}
    </AppShell>
  )
}

// The inductor is the immigration officer of the Carrera: this is the counter. A boarding pass in the navy blue (the same as the runners'
// passenger ticket) with the photo and name of the base; on the stub, how many visas it has stamped so far.
export function BaseTicket({ name, photoPath, sealed }: { name: string; photoPath: string | null; sealed: number }) {
  const url = photoUrl(photoPath)
  return (
    <div className="tc-wrap">
      <section className="tc base-ticket" role="status" aria-label={`Ventanilla ${name}`}>
        <div className="tc-main">
          <p className="tc-kicker">Ventanilla de visado</p>
          <div className="tc-row">
            {url ? (
              <img className="tc-photo" src={url} alt={`Dónde queda ${name}`} decoding="async" />
            ) : (
              <span className="tc-photo empty" aria-hidden="true">
                <MapPin size={28} />
              </span>
            )}
            <div className="tc-info">
              <strong className="tc-name">{name}</strong>
              <span className="tc-chips">
                <span className="live-label">En servicio</span>
                <span className="flight-chip">{airportCode(name)}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="tc-stub" aria-label={`${sealed} ${sealed === 1 ? 'visado sellado' : 'visados sellados'}`}>
          <span className="tc-code num">{sealed}</span>
          <small>{sealed === 1 ? 'sellado' : 'sellados'}</small>
        </div>
      </section>
    </div>
  )
}

// What comes after the match in front of the officer: the two groups of the next round, as a ticket.
export function NextRound({ match, teams }: { match: BaseMatch; teams: Map<string, Team> }) {
  return (
    <div className="tc-wrap">
      <section className="tc next-ticket" aria-label={`Próxima ronda: ${match.round_number}`}>
        <div className="tc-main">
          <p className="tc-kicker">Próxima ronda · Puerta {match.round_number}</p>
          <div className="nt-rival both">
            {[match.team_a, match.team_b].map((id) => (
              <span key={id}>
                <Crest name={teams.get(id)?.name} photoPath={teams.get(id)?.photo_path} size="sm" />
                <strong>{teams.get(id)?.name ?? '—'}</strong>
              </span>
            ))}
          </div>
        </div>
        <div className="tc-stub" aria-hidden="true">
          <span className="tc-code">R{match.round_number}</span>
          <small>Siguiente</small>
        </div>
      </section>
    </div>
  )
}

// Every crossing of the base is stamped: the counter closes.
export function ClosedDesk({ name, sealed }: { name: string; sealed: number }) {
  return (
    <section className="finish" aria-label="Ventanilla cerrada">
      <Trophy className="finish-trophy" size={34} aria-hidden="true" />
      <p className="finish-kicker">{name}</p>
      <h2>Ventanilla cerrada</h2>
      <p className="finish-sub">Todos los cruces de tu base terminaron. ¡Gracias!</p>
      <p className="finish-count num">
        {sealed}
        <small>{sealed === 1 ? 'visado sellado' : 'visados sellados'}</small>
      </p>
    </section>
  )
}

// "Mi base": the informative space of the inductor. What is explained and the possible questions (to have at hand while
// running the match), then where the base is: the photo and the saved location. The map only opens when the inductor
// wants to change the location (or when none is saved yet).
function MyBaseTab({ base, onChanged }: { base: MyBase; onChanged: () => Promise<void> }) {
  return (
    <>
      <BaseSealCard id={base.id} name={base.name} />
      <BaseGuide info={infoOf(base.base_details)} questions={base.base_questions} />
      <BaseWhere base={base} onChanged={onChanged} />
    </>
  )
}

export function BaseWhere({ base, onChanged }: { base: { id: string; name: string; location_photo_path: string | null; lat: number | null; lng: number | null }; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const hasLocation = base.lat !== null && base.lng !== null

  // The base can move (e.g. because of rain): the inductor updates the photo of where it is now.
  async function changePhoto(file: File) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    try {
      const path = await uploadPhoto('bases', file)
      const { error: err } = await supabase.from('bases').update({ location_photo_path: path }).eq('id', base.id)
      if (err) throw new Error('No se pudo guardar la foto.')
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la foto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="top-others" aria-label="Dónde queda">
      <h2 className="title-tag">
        <MapPin size={18} aria-hidden="true" />
        Dónde queda
      </h2>
      <div className="card">
        <PhotoField path={base.location_photo_path} label={`Dónde queda ${base.name}`} busy={busy} onPick={(f) => void changePhoto(f)} />
        {error && <p className="error">{error}</p>}
        {hasLocation && !editing ? (
          <div className="location-saved">
            <button className="ghost" type="button" onClick={() => setEditing(true)}>Cambiar ubicación</button>
            <p className="ok-text"><MapPin size={16} aria-hidden="true" /> Ubicación guardada en el mapa.</p>
          </div>
        ) : (
          <>
            <BaseLocationEditor
              baseId={base.id}
              name={base.name}
              lat={base.lat}
              lng={base.lng}
              onSaved={async () => {
                await onChanged()
                setEditing(false)
              }}
              onCancel={hasLocation ? () => setEditing(false) : undefined}
            />
          </>
        )}
      </div>
    </section>
  )
}

// What the inductor needs at hand while running the match: what to explain and the possible questions.
export function BaseGuide({ info, questions: raw }: { info: string | null; questions: BaseQuestion[] }) {
  const questions = [...raw].sort((a, b) => a.position - b.position)
  return (
    <>
      <section className="top-others" aria-label="Lo que se explica en la base">
        <h2 className="title-tag">
          <BookOpen size={18} aria-hidden="true" />
          Lo que se explica
        </h2>
        <div className="card guide">
          <p className="pre">{info ?? 'Sin información.'}</p>
        </div>
      </section>
      <section className="top-others" aria-label="Posibles preguntas">
        <h2 className="title-tag">
          <CircleHelp size={18} aria-hidden="true" />
          Posibles preguntas
          {questions.length > 0 && <b className="num">{questions.length}</b>}
        </h2>
        <div className="card guide">
          {questions.length === 0 ? (
            <p className="muted">Sin preguntas.</p>
          ) : (
            <ol className="questions">
              {questions.map((q) => (
                <li key={q.position}>
                  {q.question}
                  {q.answer?.trim() && <p className="q-answer"><b>Respuesta:</b> {q.answer.trim()}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  )
}

// Who won each item of a finished match (what this base scored): "Barra: Dioses Griegos".
export function WonItems({ match, teams }: { match: BaseMatch; teams: Map<string, Team> }) {
  return (
    <ul className="won-items">
      {SCORE_ITEMS.map((item) => {
        const row = match.match_scores.find((x) => x.item === item)
        return (
          <li key={item}>
            <span>{ITEM_LABEL[item]}</span>
            <b>{!row ? '—' : row.voided ? 'Invalidado' : (teams.get(row.winner_team_id ?? '')?.name ?? '—')}</b>
          </li>
        )
      })}
    </ul>
  )
}

// A group at the counter: its crest, its name and its flight code (the same the runners and the coordinator see).
export function TeamFace({ team, code, state }: { team?: Team; code?: string; state?: string }) {
  return (
    <div className="face">
      <Crest name={team?.name} photoPath={team?.photo_path} size="lg" />
      <strong>{team?.name ?? '—'}</strong>
      {code && <span className="pax-code">{code}</span>}
      {state && <span className="pax-state">{state}</span>}
    </div>
  )
}

type Pick = string // team id

// The database refuses a base that acts while its Carrera is not active (row-level security): say it in plain words.
const NOT_ACTIVE = 'La Carrera no está activa para tu usuario, así que no puedes registrar nada ahora. Avísale al coordinador.'
export const friendlyError = (message: string, fallback: string) => (/row-level security|permission denied|no está asignado/i.test(message) ? NOT_ACTIVE : fallback)

const HURRY_MESSAGE = 'Apúrense: la base los está esperando.'

// Asks to confirm and alerts the groups of a match with a fixed message: both, or only `teamId` (the other may already be here).
// `warning` tells the base that the group still has travel time left before it asks to confirm.
export async function hurryGroups(
  eventId: string,
  matchId: string,
  names: string[] = [],
  opts: { teamId?: string; warning?: string } = {},
): Promise<{ sent: boolean; error?: string }> {
  const ok = await confirmDialog({
    title: opts.teamId ? '¿Apurar a este grupo?' : '¿Apurar a los grupos?',
    message: opts.warning,
    details: names,
    confirmLabel: opts.warning ? 'Apurar de todos modos' : 'Enviar aviso',
    icon: opts.warning ? 'warning' : 'bell',
  })
  if (!ok) return { sent: false } // cancelled
  const error = await sendMatchAlert(eventId, matchId, HURRY_MESSAGE, 'groups', opts.teamId)
  return error ? { sent: false, error } : { sent: true }
}

// The groups walking to this base: where each one comes from, a clock with the time it still has (the allowed time is the one the
// coordinator set for that leg), and a button per group plus one for both, because one of them may already be here.
function WalkingGroups({
  match,
  teams,
  legs,
  baseNames,
  codes,
  busy,
  canHurry,
  onHurry,
}: {
  match: BaseMatch
  teams: Map<string, Team>
  legs: Record<string, LegInfo>
  baseNames?: Map<string, string>
  codes?: Map<string, string>
  busy: boolean
  canHurry: boolean
  onHurry: (teamId?: string) => void
}) {
  const now = useNow(1000)
  return (
    <div className="walking" aria-label="Grupos en camino">
      {[match.team_a, match.team_b].map((id) => {
        const info: LegInfo = legs[id] ?? { kind: 'none' }
        const name = teams.get(id)?.name ?? '?'
        const from = 'fromBaseId' in info ? baseNames?.get(info.fromBaseId) : undefined
        const left = info.kind === 'walking' ? legRemainingSec(info, now) : null
        const blocked = info.kind === 'stay' || info.kind === 'waiting'
        return (
          <div key={id} className="walk-row">
            <Crest name={teams.get(id)?.name} photoPath={teams.get(id)?.photo_path} size="sm" />
            <div className="walk-who">
              <strong>{name}{codes?.get(id) && <span className="pax-code">{codes.get(id)}</span>}</strong>
              <small>
                {info.kind === 'stay' && 'Ya está en tu base'}
                {info.kind === 'waiting' && `Aún juega su cruce anterior${from ? ` en ${from}` : ''}`}
                {info.kind === 'walking' && `Viene de ${from ?? 'otra base'} · máximo ${info.allowedMin} min`}
                {info.kind === 'none' && 'Sin tiempo de traslado definido'}
              </small>
            </div>
            {left !== null && (
              <span className={`walk-clock num${left <= 0 ? ' over' : ''}`} role="timer" aria-label={left > 0 ? `Faltan ${clockText(left)}` : `Se pasó por ${clockText(left)}`}>
                {left > 0 ? clockText(left) : `+${clockText(left)}`}
                <small>{left > 0 ? 'faltan' : 'de más'}</small>
              </span>
            )}
            {canHurry && (
              <button type="button" className="ghost walk-hurry" disabled={busy || blocked} onClick={() => onHurry(id)} aria-label={`Apurar a ${name}`}>
                <BellRing size={17} aria-hidden="true" />
                Apurar
              </button>
            )}
          </div>
        )
      })}
      {canHurry && (
        <button className="ghost btn-block hurry" disabled={busy} onClick={() => onHurry()}>
          <BellRing size={19} aria-hidden="true" />
          Apurar a los grupos
        </button>
      )}
    </div>
  )
}

// "Equipos en rotación": once a match is scored, the groups wait for the coordinator to say every base can rotate; then the base confirms it let them go.
export function RotationCard({ state, names, busy, error, onConfirm }: { state: 'waiting' | 'ready' | 'done'; names: string[]; busy?: boolean; error?: string | null; onConfirm: () => void }) {
  return (
    <section className={`card rotation-card ${state}`} aria-label="Equipos en rotación">
      <h2>
        <Shuffle size={18} aria-hidden="true" /> Equipos en rotación
      </h2>
      {names.length > 0 && <p className="muted">{names.join(' y ')}</p>}
      {state === 'waiting' && <p className="rotation-waiting">Esperando el aviso del coordinador.</p>}
      {state === 'ready' && <p><strong>Ya pueden rotar.</strong></p>}
      {state === 'done' && <p className="ok-text"><Check size={16} aria-hidden="true" /> Confirmado: los grupos ya salieron.</p>}
      {error && <p className="error">{error}</p>}
      {state !== 'done' && (
        <button type="button" className="btn-block" disabled={state === 'waiting' || busy} onClick={onConfirm}>
          <Shuffle size={19} aria-hidden="true" />
          {busy ? 'Confirmando…' : 'Ya los dejé ir'}
        </button>
      )}
    </section>
  )
}

// The three steps of the counter: both groups arrive, the three stages are scored, the visa is stamped.
function DeskFlow({ arrived, scored, total }: { arrived: boolean; scored: number; total: number }) {
  const sealed = scored === total
  const steps = [
    { label: 'Llegada', state: arrived ? 'done' : 'active', note: arrived ? 'Lista' : 'Falta' },
    { label: 'Etapas', state: sealed ? 'done' : arrived ? 'active' : 'todo', note: `${scored} de ${total}` },
    { label: 'Sello', state: sealed ? 'done' : 'todo', note: sealed ? 'Puesto' : 'Luego' },
  ]
  return (
    <ol className="desk-flow" aria-label="Pasos de la ventanilla">
      {steps.map((s, i) => (
        <li key={s.label} className={s.state}>
          <span className="desk-dot" aria-hidden="true">{s.state === 'done' ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
          <span className="desk-step">
            <b>{s.label}</b>
            <small>{s.note}</small>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function MatchCard({
  match,
  teams,
  onSent,
  eventId,
  base,
  codes,
  legs,
  baseNames,
}: {
  match: BaseMatch
  teams: Map<string, Team>
  onSent: () => Promise<void>
  eventId?: string // when given, the base can send an alert to the groups of this match
  base?: { id: string; name: string; location_photo_path: string | null } // when given, the card carries the stamp of the base
  codes?: Map<string, string> // flight code of each group
  legs?: Record<string, LegInfo> // how each group walks to this base (origin and clock); without it the card offers one button for both
  baseNames?: Map<string, string>
}) {
  const [picks, setPicks] = useState<Partial<Record<ScoreItem, Pick>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const a = teams.get(match.team_a)
  const b = teams.get(match.team_b)
  const scored = new Map(match.match_scores.map((s) => [s.item, s]))
  const pendingItems = SCORE_ITEMS.filter((i) => !scored.has(i))
  const toSend = pendingItems.filter((i) => picks[i])
  const arrived = match.arrived_at !== null // the database refuses a score from the base before the arrival is confirmed (0022)
  const points = (teamId: string) => match.match_scores.filter((s) => s.winner_team_id === teamId).length

  const label = (id: string | null | undefined) => (id ? (teams.get(id)?.name ?? '?') : '')
  const paxState = arrived ? 'En la puerta' : 'En camino'

  async function confirmArrival() {
    if (!supabase) return
    if (!(await confirmDialog({ title: '¿Ya llegaron los dos grupos?', details: [a?.name ?? '', b?.name ?? ''].filter(Boolean), confirmLabel: 'Sí, ya llegaron', icon: 'check' }))) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_arrival', { p_match: match.id })
    if (err) setError(friendlyError(err.message, 'No se pudo confirmar. Revisa tu conexión e inténtalo de nuevo.'))
    await onSent()
    setBusy(false)
  }

  // The base can hurry the groups: they get the message (and a notification) on their phones.
  async function hurry(teamId?: string) {
    if (!eventId) return
    setError(null)
    setNotice(null)
    const chosen = teamId ? [teamId] : [match.team_a, match.team_b]
    // a group that still has travel time left: say so before the alert goes (the base may send it anyway)
    const still = legs
      ? chosen.flatMap((id) => {
          const info = legs[id]
          const left = info?.kind === 'walking' ? legRemainingSec(info, serverNow()) : 0
          return left > 0 ? [`${label(id)}: faltan ${clockText(left)}`] : []
        })
      : []
    const result = await hurryGroups(eventId, match.id, chosen.map(label).filter(Boolean), {
      teamId,
      warning: still.length > 0 ? `Todavía les queda tiempo de traslado. ${still.join(' · ')}.` : undefined,
    })
    if (result.error) setError(result.error)
    else if (result.sent) setNotice(teamId ? `Aviso enviado a ${label(teamId)}.` : 'Aviso enviado a los dos grupos.')
  }

  async function send() {
    if (!supabase || toSend.length === 0) return
    const summary = toSend.map((i) => `${ITEM_LABEL[i]}: ${label(picks[i])}`)
    if (!(await confirmDialog({ title: '¿Enviar los resultados?', message: 'Una vez enviados solo el coordinador puede corregirlos.', details: summary, confirmLabel: 'Enviar resultados', icon: 'send' }))) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('match_scores').insert(
      toSend.map((i) => ({ match_id: match.id, item: i, winner_team_id: picks[i] as string })),
    )
    if (err) {
      setError(
        /llegaron los dos grupos/i.test(err.message)
          ? 'Primero confirma que llegaron los dos grupos.'
          : /ronda anterior/i.test(err.message)
          ? 'Primero termina de calificar la ronda anterior.'
          : /duplicate|unique/i.test(err.message)
            ? 'Alguien ya registró uno de esos ítems. Se actualizó la pantalla.'
            : friendlyError(err.message, 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.'),
      )
    } else {
      setPicks({})
    }
    await onSent()
    setBusy(false)
  }

  return (
    <section className="card match desk">
      <div className="match-head desk-head">
        <span className="gate-tag">
          <small>Puerta</small>
          <b className="num">{String(match.round_number).padStart(2, '0')}</b>
        </span>
        {arrived && (
          <span className={`badge ${match.status === 'in_progress' ? 'ok live' : match.status === 'finished' ? 'ok' : ''}`}>
            {STATUS_LABEL[match.status]}
          </span>
        )}
        {base && (
          <span className="desk-seal" aria-hidden="true">
            <Stamp seed={base.id} name={base.name} photoPath={base.location_photo_path} round={0} state="stamped" size={58} straight />
          </span>
        )}
      </div>

      {!arrived ? (
        <>
          <WalkingGroups match={match} teams={teams} legs={legs ?? {}} baseNames={baseNames} codes={codes} busy={busy} canHurry={Boolean(eventId)} onHurry={(id) => void hurry(id)} />
          {notice && <p className="ok-text">{notice}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn-block" disabled={busy} onClick={() => void confirmArrival()}>
            <UsersRound size={20} aria-hidden="true" />
            {busy ? 'Confirmando…' : 'Ya llegaron ambos grupos'}
          </button>
        </>
      ) : (
        <>
          <DeskFlow arrived={arrived} scored={scored.size} total={SCORE_ITEMS.length} />
          <div className="versus">
            <TeamFace team={a} code={codes?.get(match.team_a)} state={paxState} />
            <span className="vs num">{points(match.team_a)}–{points(match.team_b)}</span>
            <TeamFace team={b} code={codes?.get(match.team_b)} state={paxState} />
          </div>
        </>
      )}

      {arrived &&
        SCORE_ITEMS.map((item, index) => {
          const row = scored.get(item)
          return (
            <div key={item} className="item">
              <h3>
                <span className="item-no num" aria-hidden="true">{index + 1}</span>
                {ITEM_LABEL[item]}
              </h3>
              {row ? (
                row.voided ? (
                  <p className="result voided">
                    <Ban size={18} aria-hidden="true" /> Invalidado por el coordinador
                  </p>
                ) : (
                  <p className="result">
                    <Check size={18} aria-hidden="true" /> {label(row.winner_team_id)}
                  </p>
                )
              ) : (
                <div className="choices">
                  {[match.team_a, match.team_b].map((id) => {
                    const on = picks[item] === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`choice${on ? ' on' : ''}`}
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => setPicks({ ...picks, [item]: on ? undefined : id })}
                      >
                        <Crest name={teams.get(id)?.name} photoPath={teams.get(id)?.photo_path} size="sm" />
                        <span className="name">{teams.get(id)?.name}</span>
                        {on && (
                          <span className="tick" aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

      {arrived && error && <p className="error">{error}</p>}
      {arrived && pendingItems.length > 0 && (
        <button className="btn-block" disabled={busy || toSend.length === 0} onClick={() => void send()}>
          <Send size={19} aria-hidden="true" />
          {busy ? 'Enviando…' : toSend.length ? `Enviar ${toSend.length} ${toSend.length === 1 ? 'ítem' : 'ítems'}` : 'Elige un ganador'}
        </button>
      )}
    </section>
  )
}
