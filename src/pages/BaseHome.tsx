import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/AppShell'
import { useAuth } from '../lib/auth'
import { photoUrl } from '../lib/storage'
import { supabase } from '../lib/supabase'
import {
  ITEM_LABEL,
  SCORE_ITEMS,
  STATUS_LABEL,
  type BaseQuestion,
  type MatchScore,
  type MatchStatus,
  type ScoreItem,
} from '../types'

interface MyBase {
  id: string
  name: string
  location_photo_path: string | null
  info: string | null
  event_id: string
  base_questions: BaseQuestion[]
}

interface BaseMatch {
  id: string
  round_number: number
  team_a: string
  team_b: string
  status: MatchStatus
  match_scores: MatchScore[]
}

interface Team {
  id: string
  name: string
  photo_path: string | null
}

export default function BaseHome() {
  const { profile } = useAuth()
  const [base, setBase] = useState<MyBase | null>(null)
  const [matches, setMatches] = useState<BaseMatch[]>([])
  const [teams, setTeams] = useState<Map<string, Team>>(new Map())
  const [loading, setLoading] = useState(true)

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The base this inductor staffs in the ACTIVE Carrera.
    const { data: b } = await supabase
      .from('bases')
      .select(
        'id, name, location_photo_path, info, event_id, base_questions(position, question), base_staff!inner(user_id), events!inner(is_active)',
      )
      .eq('base_staff.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    setBase((b as MyBase | null) ?? null)
    if (!b) return
    const [m, t] = await Promise.all([
      supabase
        .from('matches')
        .select('id, round_number, team_a, team_b, status, match_scores(item, winner_team_id)')
        .eq('base_id', b.id)
        .order('round_number'),
      supabase.from('teams').select('id, name, photo_path').eq('event_id', b.event_id),
    ])
    setMatches((m.data ?? []) as BaseMatch[])
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x])))
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live refresh when scores change (e.g. another inductor of the same base, or a correction).
  useEffect(() => {
    if (!supabase || !base) return
    const channel = supabase
      .channel(`base-${base.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_scores' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => void load())
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [base, load])

  const current = useMemo(() => matches.find((m) => m.status !== 'finished'), [matches])
  const others = matches.filter((m) => m.id !== current?.id)

  return (
    <AppShell title="Mi base">
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : !base ? (
        <section className="card">
          <p>Todavía no tienes una base asignada en la Carrera activa. Avísale al coordinador.</p>
        </section>
      ) : (
        <>
          <BaseInfoCard base={base} />
          <h2 className="section-title">{current ? `Ronda ${current.round_number}: ahora` : 'Cruces'}</h2>
          {matches.length === 0 && <p className="warn">El coordinador aún no ha programado cruces para tu base.</p>}
          {current && <MatchCard key={current.id} match={current} teams={teams} onSent={load} />}
          {current === undefined && matches.length > 0 && <p className="ok-box">Todos los cruces de tu base terminaron. ¡Gracias!</p>}
          {others.length > 0 && <h2 className="section-title">Demás rondas</h2>}
          {others.map((m) => (
            <MatchCard key={m.id} match={m} teams={teams} onSent={load} compact />
          ))}
        </>
      )}
    </AppShell>
  )
}

function BaseInfoCard({ base }: { base: MyBase }) {
  const url = photoUrl(base.location_photo_path)
  const questions = [...base.base_questions].sort((a, b) => a.position - b.position)
  return (
    <section className="card">
      <h2>{base.name}</h2>
      {url && <div className="photo-box"><img src={url} alt={`Dónde queda ${base.name}`} /></div>}
      <details>
        <summary>Información y preguntas</summary>
        <p className="pre">{base.info}</p>
        <ol>
          {questions.map((q) => <li key={q.position}>{q.question}</li>)}
        </ol>
      </details>
    </section>
  )
}

function TeamFace({ team }: { team?: Team }) {
  const url = photoUrl(team?.photo_path ?? null)
  return (
    <div className="face">
      {url ? <img src={url} alt="" /> : <span aria-hidden="true">👥</span>}
      <strong>{team?.name ?? '—'}</strong>
    </div>
  )
}

type Pick = string | 'tie' // team id or tie

function MatchCard({
  match,
  teams,
  onSent,
  compact = false,
}: {
  match: BaseMatch
  teams: Map<string, Team>
  onSent: () => Promise<void>
  compact?: boolean
}) {
  const [picks, setPicks] = useState<Partial<Record<ScoreItem, Pick>>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const a = teams.get(match.team_a)
  const b = teams.get(match.team_b)
  const scored = new Map(match.match_scores.map((s) => [s.item, s.winner_team_id]))
  const pendingItems = SCORE_ITEMS.filter((i) => !scored.has(i))
  const toSend = pendingItems.filter((i) => picks[i])
  const points = (teamId: string) => match.match_scores.filter((s) => s.winner_team_id === teamId).length

  const label = (pick: Pick | null | undefined) =>
    pick === undefined ? '' : pick === null || pick === 'tie' ? 'Empate' : teams.get(pick)?.name ?? '?'

  async function send() {
    if (!supabase || toSend.length === 0) return
    const summary = toSend.map((i) => `${ITEM_LABEL[i]}: ${label(picks[i])}`).join('\n')
    if (!window.confirm(`Una vez enviado solo el coordinador puede corregirlo.\n\n${summary}\n\n¿Enviar?`)) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('match_scores').insert(
      toSend.map((i) => ({
        match_id: match.id,
        item: i,
        winner_team_id: picks[i] === 'tie' ? null : (picks[i] as string),
      })),
    )
    if (err) {
      setError(
        /duplicate|unique/i.test(err.message)
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
    <section className={`card match${compact ? ' compact' : ''}`}>
      <div className="match-head">
        <span>Ronda {match.round_number}</span>
        <span className={`badge ${match.status === 'finished' ? 'ok' : 'idle'}`}>{STATUS_LABEL[match.status]}</span>
      </div>
      <div className="versus">
        <TeamFace team={a} />
        <span className="vs">{points(match.team_a)} – {points(match.team_b)}</span>
        <TeamFace team={b} />
      </div>

      {SCORE_ITEMS.map((item) => {
        const done = scored.has(item)
        return (
          <div key={item} className="item">
            <h3>{ITEM_LABEL[item]}</h3>
            {done ? (
              <p className="result">✔ {label(scored.get(item))}</p>
            ) : (
              <div className="choices">
                {([match.team_a, match.team_b] as Pick[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`choice${picks[item] === value ? ' on' : ''}`}
                    aria-pressed={picks[item] === value}
                    disabled={busy}
                    onClick={() => setPicks({ ...picks, [item]: picks[item] === value ? undefined : value })}
                  >
                    {teams.get(value)?.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {error && <p className="error">{error}</p>}
      {pendingItems.length > 0 && (
        <button disabled={busy || toSend.length === 0} onClick={() => void send()}>
          {busy ? 'Enviando…' : toSend.length ? `Enviar ${toSend.length} ${toSend.length === 1 ? 'ítem' : 'ítems'}` : 'Elige un ganador'}
        </button>
      )}
    </section>
  )
}
