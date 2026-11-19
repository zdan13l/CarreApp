import { Ban, BellRing, BookOpen, Check, CircleHelp, ClipboardCheck, Flag, MapPin, Send, Trophy, Users, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import AppShell from '../components/AppShell'
import { AlertBanner, AlertBell } from '../components/Alerts'
import { sendMatchAlert } from '../components/DelaysPanel'
import BaseLocationEditor from '../components/BaseLocationEditor'
import BottomNav, { type NavTab } from '../components/BottomNav'
import Crest from '../components/Crest'
import Stamp from '../components/Stamp'
import PhotoField from '../components/PhotoField'
import NoActiveCarrera from '../components/NoActiveCarrera'
import TeamNames from '../components/TeamNames'
import { useAuth } from '../lib/auth'
import { useManualAlerts, useNow } from '../lib/alerts'
import { lateTeams, type TimedMatch } from '../lib/delays'
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
import { confirmDialog, promptDialog } from '../lib/dialog'

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
  const [loading, setLoading] = useState(true)

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The base this inductor staffs in the ACTIVE Carrera.
    const { data: b, error: baseErr } = await supabase
      .from('bases')
      .select(
        'id, name, location_photo_path, lat, lng, event_id, base_details(info), base_questions(position, question), base_staff!inner(user_id), events!inner(is_active, max_travel_minutes)',
      )
      .eq('base_staff.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    if (baseErr) return // a network error is not "no active Carrera": keep what is on screen until the next refresh
    setBase((b as MyBase | null) ?? null)
    if (!b) return
    const [m, t, all] = await Promise.all([
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
    ])
    if (m.error || t.error || all.error) return // keep what is on screen on a failed request
    setEventMatches((all.data ?? []) as TimedMatch[])
    setMatches((m.data ?? []) as BaseMatch[])
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x])))
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live refresh when scores change (another inductor of the same base, or a correction).
  useRealtimeReload(['match_scores', 'matches', 'bases', 'events'], load, 1500)

  const current = useMemo(() => matches.find((m) => m.status !== 'finished'), [matches])
  const next = current ? matches.find((m) => m.round_number > current.round_number && m.status !== 'finished') : undefined
  const finished = matches.filter((m) => m.status === 'finished')
  const codes = useMemo(() => flightCodes([...teams.values()]), [teams]) // the "flight" of each group, as the runners see it

  const events = base?.events
  const maxMinutes = (Array.isArray(events) ? events[0]?.max_travel_minutes : events?.max_travel_minutes) ?? 10
  const now = useNow()
  const myMatchIds = new Set(matches.map((m) => m.id))
  const travel = useTravelTimes(base?.event_id)
  const late = lateTeams(eventMatches, maxMinutes, now, travel).filter((l) => myMatchIds.has(l.matchId))
  const fromCoordinator = useManualAlerts(matches.map((m) => m.id), 'base') // rings the phone while it is fresh

  return (
    <AppShell
      title={tab === 'ronda' ? 'Mi base' : TABS.find((t) => t.id === tab)?.label ?? 'Mi base'}
      showTitle={tab === 'ronda'}
      topActions={base && <AlertBell />}
    >
      {loading ? (
        <p className="loading">Cargando…</p>
      ) : !base ? (
        <NoActiveCarrera role="base" />
      ) : (
        <div className="base-view" style={inkStyle(base.id)}>
          {fromCoordinator.alerts.map((a) => (
            <AlertBanner key={a.id} title="Aviso del coordinador" onDismiss={() => fromCoordinator.dismiss(a.id)}>
              {a.message}
            </AlertBanner>
          ))}
          {[...new Set(late.map((l) => l.matchId))].map((matchId) => {
            const m = matches.find((x) => x.id === matchId)
            const names = late
              .filter((l) => l.matchId === matchId)
              .map((l) => teams.get(l.teamId)?.name)
              .join(' y ')
            const minutes = Math.max(...late.filter((l) => l.matchId === matchId).map((l) => l.elapsedMin))
            return (
              <AlertBanner key={matchId} title={`Ronda ${m?.round_number}: grupos en demora`}>
                {names} llevan {minutes} min en el traslado (máximo {Math.min(...late.filter((l) => l.matchId === matchId).map((l) => l.maxMin))} min). Usa "Apurar a los grupos" para avisarles.
              </AlertBanner>
            )
          })}

          <div key={tab} className={`tab-view ${dir}`}>
            {tab === 'ronda' && (
              <>
                <BaseTicket name={base.name} photoPath={base.location_photo_path} sealed={finished.length} />
                {matches.length === 0 && <p className="warn">El coordinador aún no ha programado cruces para tu base.</p>}
                {current && <MatchCard key={current.id} match={current} teams={teams} onSent={load} eventId={base.event_id} base={base} codes={codes} />}
                {next && <NextRound match={next} teams={teams} />}
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
                    <TeamNames teams={[...teams.values()]} />
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
        <div className="base-stamp">
          <Stamp seed={base.id} name={base.name} photoPath={base.location_photo_path} round={0} state="stamped" size={104} straight />
          <p>
            <strong>Este es el sello de tu base</strong>
            Cada grupo lo recibe en su pasaporte cuando confirmas su llegada. Se imprime con tu foto: mientras mejor se vea el lugar, mejor el sello.
          </p>
        </div>
        <PhotoField path={base.location_photo_path} label={`Dónde queda ${base.name}`} busy={busy} onPick={(f) => void changePhoto(f)} />
        {error && <p className="error">{error}</p>}
        {hasLocation && !editing ? (
          <div className="location-saved">
            <p className="ok-text"><MapPin size={16} aria-hidden="true" /> Ubicación guardada en el mapa.</p>
            <button className="ghost" type="button" onClick={() => setEditing(true)}>Cambiar ubicación</button>
          </div>
        ) : (
          <>
            {hasLocation && <p className="muted">¿La base se movió? Marca el nuevo punto y guárdalo.</p>}
            <BaseLocationEditor
              baseId={base.id}
              name={base.name}
              lat={base.lat}
              lng={base.lng}
              onSaved={async () => {
                await onChanged()
                setEditing(false)
              }}
            />
            {hasLocation && (
              <div className="row">
                <button className="ghost" type="button" onClick={() => setEditing(false)}>Cancelar</button>
              </div>
            )}
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
              {questions.map((q) => <li key={q.position}>{q.question}</li>)}
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
}: {
  match: BaseMatch
  teams: Map<string, Team>
  onSent: () => Promise<void>
  eventId?: string // when given, the base can send an alert to the groups of this match
  base?: { id: string; name: string; location_photo_path: string | null } // when given, the card carries the stamp of the base
  codes?: Map<string, string> // flight code of each group
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
  const arrived = match.arrived_at !== null || match.status !== 'pending'
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
  async function hurry() {
    if (!eventId) return
    const message = await promptDialog({ title: 'Apurar a los grupos', message: 'Les llega como notificación y les suena el teléfono.', label: 'Mensaje', defaultValue: 'Apúrense: la base los está esperando.', confirmLabel: 'Enviar aviso', icon: 'bell' })
    if (!message) return
    setError(null)
    setNotice(null)
    const err = await sendMatchAlert(eventId, match.id, message)
    if (err) setError(err)
    else setNotice('Aviso enviado a los dos grupos.')
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
        /ronda anterior/i.test(err.message)
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
        <span className={`badge ${match.status === 'in_progress' ? 'ok live' : match.status === 'finished' ? 'ok' : ''}`}>
          {STATUS_LABEL[match.status]}
        </span>
        {base && (
          <span className="desk-seal" aria-hidden="true">
            <Stamp seed={base.id} name={base.name} photoPath={base.location_photo_path} round={0} state="stamped" size={58} straight />
          </span>
        )}
      </div>

      <DeskFlow arrived={arrived} scored={scored.size} total={SCORE_ITEMS.length} />

      <div className="versus">
        <TeamFace team={a} code={codes?.get(match.team_a)} state={paxState} />
        <span className="vs num">{points(match.team_a)}–{points(match.team_b)}</span>
        <TeamFace team={b} code={codes?.get(match.team_b)} state={paxState} />
      </div>

      {!arrived && (
        <>
          <p className="muted">Cuando estén los dos grupos en tu base, confírmalo. Así el coordinador sabe que ya pueden jugar.</p>
          {error && <p className="error">{error}</p>}
          <button className="btn-block" disabled={busy} onClick={() => void confirmArrival()}>
            <UsersRound size={20} aria-hidden="true" />
            {busy ? 'Confirmando…' : 'Ya llegaron ambos grupos'}
          </button>
          {eventId && (
            <button className="ghost btn-block hurry" disabled={busy} onClick={() => void hurry()}>
              <BellRing size={19} aria-hidden="true" />
              Apurar a los grupos
            </button>
          )}
          {notice && <p className="ok-text">{notice}</p>}
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
