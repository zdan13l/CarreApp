import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  ITEM_LABEL,
  SCORE_ITEMS,
  STATUS_LABEL,
  type MatchScore,
  type MatchStatus,
  type ScoreItem,
} from '../../types'
import { errMsg, useAdmin } from './AdminContext'

interface Named {
  id: string
  name: string
}

interface MatchWithScores {
  id: string
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  status: MatchStatus
  match_scores: MatchScore[]
}

interface AuditRow {
  id: number
  match_id: string | null
  item: ScoreItem | null
  action: string
  old_winner: string | null
  new_winner: string | null
  changed_by: string | null
  changed_at: string
}

const ACTION_LABEL: Record<string, string> = { insert: 'Registró', update: 'Corrigió', delete: 'Borró' }

export default function Puntajes() {
  const { event } = useAdmin()
  const [teams, setTeams] = useState<Named[]>([])
  const [bases, setBases] = useState<Named[]>([])
  const [matches, setMatches] = useState<MatchWithScores[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [people, setPeople] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const eventId = event?.id

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [t, b, m, a, p] = await Promise.all([
      supabase.from('teams').select('id, name').eq('event_id', eventId),
      supabase.from('bases').select('id, name').eq('event_id', eventId),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, match_scores(item, winner_team_id)')
        .eq('event_id', eventId)
        .order('round_number'),
      supabase.from('score_audit').select('*').order('changed_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, full_name'),
    ])
    setTeams(t.data ?? [])
    setBases(b.data ?? [])
    setMatches((m.data ?? []) as MatchWithScores[])
    setAudit((a.data ?? []) as AuditRow[])
    setPeople(new Map((p.data ?? []).map((x) => [x.id, x.full_name])))
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const baseName = useMemo(() => new Map(bases.map((x) => [x.id, x.name])), [bases])
  const matchById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches])

  // Standings are derived from the scores (1 point per item won; ties give nobody a point).
  const standings = useMemo(() => {
    const pts = new Map(teams.map((t) => [t.id, 0]))
    for (const m of matches) for (const s of m.match_scores) {
      if (s.winner_team_id) pts.set(s.winner_team_id, (pts.get(s.winner_team_id) ?? 0) + 1)
    }
    return [...pts.entries()].sort((x, y) => y[1] - x[1])
  }, [matches, teams])

  if (!event) return <p className="warn">Primero crea una Carrera en "Resumen".</p>

  async function setScore(m: MatchWithScores, item: ScoreItem, value: string) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    try {
      if (value === 'none') {
        const { error: err } = await supabase.from('match_scores').delete().eq('match_id', m.id).eq('item', item)
        if (err) throw new Error('No se pudo borrar el puntaje.')
      } else {
        const { error: err } = await supabase
          .from('match_scores')
          .upsert(
            { match_id: m.id, item, winner_team_id: value },
            { onConflict: 'match_id,item' },
          )
        if (err) throw new Error('No se pudo corregir el puntaje.')
      }
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const who = (id: string | null) => (id ? teamName.get(id) ?? 'grupo eliminado' : 'Empate')

  return (
    <>
      <h1>Puntajes</h1>
      <p className="muted">
        Las bases envían los puntos. Aquí el coordinador puede corregirlos o borrarlos; todo queda en el registro.
      </p>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Ranking</h2>
        <ol className="rank">
          {standings.map(([id, pts], i) => (
            <li key={id}>
              <span className="pos">{i + 1}</span>
              <span className="grow">{teamName.get(id)}</span>
              <strong>{pts} pts</strong>
            </li>
          ))}
        </ol>
        <p className="muted">Si dos grupos quedan igualados en puntos, se desempata en la vida real.</p>
      </section>

      <h2 className="section-title">Cruces</h2>
      {matches.length === 0 && <p className="warn">Aún no hay cruces programados.</p>}
      <div className="grid">
        {matches.map((m) => {
          const scored = new Map(m.match_scores.map((s) => [s.item, s.winner_team_id]))
          return (
            <section key={m.id} className="card">
              <div className="match-head">
                <strong>Ronda {m.round_number} · {baseName.get(m.base_id)}</strong>
                <span className={`badge ${m.status === 'finished' ? 'ok' : 'idle'}`}>{STATUS_LABEL[m.status]}</span>
              </div>
              <p>{teamName.get(m.team_a)} vs {teamName.get(m.team_b)}</p>
              {SCORE_ITEMS.map((item) => {
                const current = scored.has(item) ? (scored.get(item) ?? 'tie') : 'none'
                return (
                  <label key={item} className="inline-field">
                    {ITEM_LABEL[item]}
                    <select value={current} disabled={busy} onChange={(e) => void setScore(m, item, e.target.value)}>
                      <option value="none">Sin registrar</option>
                      <option value={m.team_a}>{teamName.get(m.team_a)}</option>
                      <option value={m.team_b}>{teamName.get(m.team_b)}</option>
                      {current === 'tie' && <option value="tie">Empate (anterior)</option>}
                    </select>
                  </label>
                )
              })}
            </section>
          )
        })}
      </div>

      <section className="card">
        <h2>Registro de cambios</h2>
        {audit.length === 0 && <p className="muted">Todavía no hay movimientos.</p>}
        <ul className="list">
          {audit.map((r) => {
            const m = r.match_id ? matchById.get(r.match_id) : undefined
            return (
              <li key={r.id} className="audit">
                <span className="grow">
                  <strong>{people.get(r.changed_by ?? '') ?? 'Sistema'}</strong> {ACTION_LABEL[r.action] ?? r.action}{' '}
                  {r.item ? ITEM_LABEL[r.item] : ''}
                  {m ? ` · ${teamName.get(m.team_a)} vs ${teamName.get(m.team_b)}` : ' · cruce eliminado'}
                  <br />
                  <small className="muted">
                    {r.action === 'insert' && `Ganador: ${who(r.new_winner)}`}
                    {r.action === 'update' && `${who(r.old_winner)} → ${who(r.new_winner)}`}
                    {r.action === 'delete' && `Antes: ${who(r.old_winner)}`}
                    {' · '}
                    {new Date(r.changed_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                  </small>
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
