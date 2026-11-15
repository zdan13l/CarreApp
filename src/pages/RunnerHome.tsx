import '../ranking.css'
import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import Ranking from '../components/Ranking'
import { useAuth } from '../lib/auth'
import { useRealtimeReload } from '../lib/realtime'
import { photoUrl } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, type MatchScore, type MatchStatus, type StandingRow } from '../types'

interface MyTeam {
  id: string
  name: string
  photo_path: string | null
  event_id: string
}

interface RouteMatch {
  id: string
  round_number: number
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  bases: { name: string; location_photo_path: string | null; info: string | null } | null
  match_scores: MatchScore[]
}

export default function RunnerHome() {
  const { profile } = useAuth()
  const [team, setTeam] = useState<MyTeam | null>(null)
  const [matches, setMatches] = useState<RouteMatch[]>([])
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)

  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    // The team this runner belongs to in the ACTIVE Carrera.
    const { data: t } = await supabase
      .from('teams')
      .select('id, name, photo_path, event_id, team_runners!inner(user_id), events!inner(is_active)')
      .eq('team_runners.user_id', userId)
      .eq('events.is_active', true)
      .maybeSingle()
    setTeam((t as MyTeam | null) ?? null)
    if (!t) return
    const [m, s] = await Promise.all([
      supabase
        .from('matches')
        .select(
          'id, round_number, team_a, team_b, status, arrived_at, bases(name, location_photo_path, info), match_scores(item, winner_team_id, voided)',
        )
        .eq('event_id', t.event_id)
        .order('round_number'),
      supabase.from('team_standings').select('team_id, name, photo_path, points').eq('event_id', t.event_id),
    ])
    setMatches((m.data ?? []) as unknown as RouteMatch[])
    setStandings(((s.data ?? []) as StandingRow[]).map((r) => ({ ...r, points: Number(r.points) })))
  }, [userId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  // Live ranking and route: refresh when scores, matches or bases change.
  useRealtimeReload(['match_scores', 'matches', 'bases'], load)

  const teamById = new Map(standings.map((r) => [r.team_id, r]))
  const mine = matches.filter((m) => m.team_a === team?.id || m.team_b === team?.id)
  const next = mine.find((m) => m.status !== 'finished')
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const myRow = standings.find((r) => r.team_id === team?.id)
  const position = myRow ? standings.filter((r) => r.points > myRow.points).length + 1 : null

  const rivalOf = (m: RouteMatch) => teamById.get(m.team_a === team?.id ? m.team_b : m.team_a)
  const pointsOf = (m: RouteMatch, id: string) => m.match_scores.filter((s) => s.winner_team_id === id).length
  const teamPhoto = photoUrl(team?.photo_path ?? null)

  return (
    <AppShell title="Mi grupo">
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : !team ? (
        <section className="card">
          <p>Todavía no estás en un grupo de la Carrera activa. Avísale al coordinador.</p>
        </section>
      ) : (
        <>
          <section className="card hero">
            <div className="face">
              {teamPhoto ? <img src={teamPhoto} alt="" /> : <span aria-hidden="true">👥</span>}
              <h2>{team.name}</h2>
            </div>
            <p className="rank-line">
              Puesto {position} · {myRow?.points ?? 0} {myRow?.points === 1 ? 'punto' : 'puntos'}
            </p>
          </section>

          {mine.length === 0 && <p className="warn">El coordinador aún no ha programado tus cruces.</p>}

          {next && <NextBase match={next} rival={rivalOf(next)} />}
          {!next && mine.length > 0 && <p className="ok-box">Terminaste todos tus cruces. ¡Buen trabajo!</p>}

          <section className="card">
            <h2>Top equipos</h2>
            <Ranking rows={standings} highlightId={team.id} />
          </section>

          {totalRounds > 0 && (
            <section className="card">
              <h2>Tu ruta</h2>
              <ul className="route">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
                  const m = mine.find((x) => x.round_number === round)
                  if (!m) {
                    return (
                      <li key={round}>
                        <span className="round">R{round}</span>
                        <span className="grow muted">Descansas</span>
                      </li>
                    )
                  }
                  const my = pointsOf(m, team.id)
                  const their = pointsOf(m, m.team_a === team.id ? m.team_b : m.team_a)
                  const chip =
                    m.status === 'finished'
                      ? {
                          text: `${my}–${their} ${my > their ? 'Ganaron' : my < their ? 'Perdieron' : 'Igual'}`,
                          cls: my > their ? 'win' : my < their ? 'lose' : '',
                        }
                      : { text: STATUS_LABEL[m.status], cls: '' }
                  return (
                    <li key={round} className={m.id === next?.id ? 'now' : undefined}>
                      <span className="round">R{round}</span>
                      <span className="grow">
                        <strong>{m.bases?.name}</strong>
                        <br />
                        <small className="muted">vs {rivalOf(m)?.name}</small>
                      </span>
                      <span className={`chip ${chip.cls}`}>{chip.text}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}

function NextBase({ match, rival }: { match: RouteMatch; rival?: StandingRow }) {
  const baseUrl = photoUrl(match.bases?.location_photo_path ?? null)
  const rivalUrl = photoUrl(rival?.photo_path ?? null)
  return (
    <section className="card next-base">
      <div className="match-head">
        <span>Ronda {match.round_number}</span>
        <span className={`badge ${match.status === 'in_progress' ? 'ok' : 'idle'}`}>
          {match.status === 'in_progress' ? 'En juego' : 'Tu siguiente base'}
        </span>
      </div>
      <h2>{match.bases?.name}</h2>
      {baseUrl && <div className="photo-box"><img src={baseUrl} alt={`Dónde queda ${match.bases?.name}`} /></div>}
      <div className="row">
        {rivalUrl ? <img className="rival-img" src={rivalUrl} alt="" /> : null}
        <p className="grow">
          Tu rival: <strong>{rival?.name ?? '—'}</strong>
        </p>
      </div>
      {match.bases?.info && (
        <details>
          <summary>Información de la base</summary>
          <p className="pre">{match.bases.info}</p>
        </details>
      )}
    </section>
  )
}
