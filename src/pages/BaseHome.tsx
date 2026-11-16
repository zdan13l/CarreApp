import { Ban, BellRing, Check, Flag, MapPin, Send, Trophy, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { AlertBanner } from '../components/Alerts'
import { sendMatchAlert } from '../components/DelaysPanel'
import BaseLocationEditor from '../components/BaseLocationEditor'
import BottomNav, { type NavTab } from '../components/BottomNav'
import Crest from '../components/Crest'
import PhotoField from '../components/PhotoField'
import Ranking from '../components/Ranking'
import { useAuth } from '../lib/auth'
import { useNow } from '../lib/alerts'
import { lateTeams, type TimedMatch } from '../lib/delays'
import { useTravelTimes } from '../lib/travel'
import { useRealtimeReload } from '../lib/realtime'
import { uploadPhoto } from '../lib/storage'
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
  type StandingRow,
} from '../types'

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

export default function BaseHome() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('ronda')
  const [base, setBase] = useState<MyBase | null>(null)
  const [matches, setMatches] = useState<BaseMatch[]>([])
  const [teams, setTeams] = useState<Map<string, Team>>(new Map())
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [eventMatches, setEventMatches] = useState<TimedMatch[]>([]) // every match, to know when teams left their previous base
  const [loading, setLoading] = useState(true)

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The base this inductor staffs in the ACTIVE Carrera.
    const { data: b } = await supabase
      .from('bases')
      .select(
        'id, name, location_photo_path, lat, lng, event_id, base_details(info), base_questions(position, question), base_staff!inner(user_id), events!inner(is_active, max_travel_minutes)',
      )
      .eq('base_staff.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    setBase((b as MyBase | null) ?? null)
    if (!b) return
    const [m, t, st, all] = await Promise.all([
      supabase
        .from('matches')
        .select('id, round_number, team_a, team_b, status, arrived_at, match_scores(item, winner_team_id, voided)')
        .eq('base_id', b.id)
        .order('round_number'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', b.event_id),
      supabase.from('team_standings').select('team_id, name, photo_path, points').eq('event_id', b.event_id),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at')
        .eq('event_id', b.event_id),
    ])
    setEventMatches((all.data ?? []) as TimedMatch[])
    setStandings(((st.data ?? []) as StandingRow[]).map((r) => ({ ...r, points: Number(r.points) })))
    setMatches((m.data ?? []) as BaseMatch[])
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x])))
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live refresh when scores change (another inductor of the same base, or a correction).
  useRealtimeReload(['match_scores', 'matches', 'bases', 'events'], load)

  const current = useMemo(() => matches.find((m) => m.status !== 'finished'), [matches])
  const next = current ? matches.find((m) => m.round_number > current.round_number && m.status !== 'finished') : undefined
  const finished = matches.filter((m) => m.status === 'finished')

  const events = base?.events
  const maxMinutes = (Array.isArray(events) ? events[0]?.max_travel_minutes : events?.max_travel_minutes) ?? 10
  const now = useNow()
  const myMatchIds = new Set(matches.map((m) => m.id))
  const travel = useTravelTimes(base?.event_id)
  const late = lateTeams(eventMatches, maxMinutes, now, travel).filter((l) => myMatchIds.has(l.matchId))

  return (
    <AppShell title={base?.name ?? 'Mi base'}>
      {loading ? (
        <p className="loading">Cargando…</p>
      ) : !base ? (
        <section className="card">
          <p>Todavía no tienes una base asignada en la Carrera activa. Avísale al coordinador.</p>
        </section>
      ) : (
        <>
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

          {tab === 'ronda' && (
            <>
              {matches.length === 0 && <p className="warn">El coordinador aún no ha programado cruces para tu base.</p>}
              {current && <MatchCard key={current.id} match={current} teams={teams} onSent={load} eventId={base.event_id} />}
              {next && (
                <section className="card next">
                  <h3>Próxima ronda · R{next.round_number}</h3>
                  <div className="versus small">
                    <TeamFace team={teams.get(next.team_a)} />
                    <span className="vs dim">VS</span>
                    <TeamFace team={teams.get(next.team_b)} />
                  </div>
                </section>
              )}
              {current === undefined && matches.length > 0 && <p className="ok-box">Todos los cruces de tu base terminaron. ¡Gracias!</p>}
              <BaseGuide info={infoOf(base.base_details)} questions={base.base_questions} />
            </>
          )}

          {tab === 'resultados' && (
            <>
              <section className="card">
                <h2>Top equipos</h2>
                <Ranking rows={standings} />
              </section>
              <section className="card">
                <h2>Cruces de tu base ({finished.length})</h2>
                {finished.length === 0 && <p className="muted">Todavía no has terminado ningún cruce.</p>}
                <ul className="list">
                  {finished.map((m) => (
                    <li key={m.id}>
                      <span className="round-tag">R{m.round_number}</span>
                      <span className="grow">
                        {teams.get(m.team_a)?.name} <span className="muted">vs</span> {teams.get(m.team_b)?.name}
                      </span>
                      <strong className="num">
                        {m.match_scores.filter((x) => x.winner_team_id === m.team_a).length}–
                        {m.match_scores.filter((x) => x.winner_team_id === m.team_b).length}
                      </strong>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {tab === 'base' && <BaseInfoCard base={base} onChanged={load} />}

          <BottomNav tabs={TABS} active={tab} onChange={setTab} />
        </>
      )}
    </AppShell>
  )
}

function BaseInfoCard({ base, onChanged }: { base: MyBase; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <>
      <section className="card">
        <h2>Dónde queda</h2>
        <PhotoField path={base.location_photo_path} label={`Dónde queda ${base.name}`} busy={busy} onPick={(f) => void changePhoto(f)} />
        <p className="muted">¿La base se movió? Cambia la foto y la ubicación en el mapa para que los grupos la encuentren.</p>
        {error && <p className="error">{error}</p>}
        <BaseLocationEditor baseId={base.id} name={base.name} lat={base.lat} lng={base.lng} onSaved={onChanged} />
      </section>
    </>
  )
}

// What the inductor needs at hand while running the match: what to explain and the possible questions.
export function BaseGuide({ info, questions: raw }: { info: string | null; questions: BaseQuestion[] }) {
  const questions = [...raw].sort((a, b) => a.position - b.position)
  return (
    <details className="card guide">
      <summary>Guía de la base: información y preguntas</summary>
      <h3>Lo que se explica en la base</h3>
      <p className="pre">{info ?? 'Sin información.'}</p>
      <h3>Posibles preguntas</h3>
      {questions.length === 0 ? (
        <p className="muted">Sin preguntas.</p>
      ) : (
        <ol className="questions">
          {questions.map((q) => <li key={q.position}>{q.question}</li>)}
        </ol>
      )}
    </details>
  )
}

export function TeamFace({ team }: { team?: Team }) {
  return (
    <div className="face">
      <Crest name={team?.name} photoPath={team?.photo_path} size="lg" />
      <strong>{team?.name ?? '—'}</strong>
    </div>
  )
}

type Pick = string // team id

export function MatchCard({
  match,
  teams,
  onSent,
  eventId,
}: {
  match: BaseMatch
  teams: Map<string, Team>
  onSent: () => Promise<void>
  eventId?: string // when given, the base can send an alert to the groups of this match
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

  async function confirmArrival() {
    if (!supabase) return
    if (!window.confirm(`¿Ya llegaron los dos grupos?\n\n${a?.name} y ${b?.name}`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_arrival', { p_match: match.id })
    if (err) setError('No se pudo confirmar. Revisa tu conexión e inténtalo de nuevo.')
    await onSent()
    setBusy(false)
  }

  // The base can hurry the groups: they get the message (and a notification) on their phones.
  async function hurry() {
    if (!eventId) return
    const message = window.prompt('Mensaje para los dos grupos:', 'Apúrense: la base los está esperando.')
    if (!message?.trim()) return
    setError(null)
    setNotice(null)
    const err = await sendMatchAlert(eventId, match.id, message)
    if (err) setError(err)
    else setNotice('Aviso enviado a los dos grupos.')
  }

  async function send() {
    if (!supabase || toSend.length === 0) return
    const summary = toSend.map((i) => `${ITEM_LABEL[i]}: ${label(picks[i])}`).join('\n')
    if (!window.confirm(`Una vez enviado solo el coordinador puede corregirlo.\n\n${summary}\n\n¿Enviar?`)) return
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
            : 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.',
      )
    } else {
      setPicks({})
    }
    await onSent()
    setBusy(false)
  }

  return (
    <section className="card match">
      <div className="match-head">
        <span className="round-tag">Ronda {match.round_number}</span>
        <span className={`badge ${match.status === 'in_progress' ? 'ok live' : match.status === 'finished' ? 'ok' : ''}`}>
          {STATUS_LABEL[match.status]}
        </span>
      </div>
      <div className="versus">
        <TeamFace team={a} />
        <span className="vs num">{points(match.team_a)}–{points(match.team_b)}</span>
        <TeamFace team={b} />
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
        SCORE_ITEMS.map((item) => {
          const row = scored.get(item)
          return (
            <div key={item} className="item">
              <h3>{ITEM_LABEL[item]}</h3>
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
