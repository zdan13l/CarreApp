import { Plane, PlaneLanding, Radio } from 'lucide-react'
import type { ReactNode } from 'react'
import { airportCode, type JourneyMatch } from '../lib/flight'
import { stampTime } from '../lib/stamp'

// Operations Log: what has happened in the Carrera, most recent first. Every line is a real record: a base confirming the
// arrival of a match, a match finished (its three stages scored) or an alert sent by the coordinator or a base.
export interface OpEvent {
  id: string
  at: string
  kind: 'arrival' | 'finished' | 'alert'
  text: ReactNode
}

// The records of the Carrera, newest first. Scores are counted from the three stages of each match.
export function buildOpEvents({
  matches,
  alerts,
  baseName,
  teamName,
  codes,
}: {
  matches: JourneyMatch[]
  alerts: { id: string; match_id: string; message: string; created_at: string }[]
  baseName: Map<string, string>
  teamName: Map<string, string>
  codes: Map<string, string>
}): OpEvent[] {
  const sign = (id: string) => codes.get(id) ?? teamName.get(id) ?? '—'
  const wins = (m: JourneyMatch, id: string) => (m.match_scores ?? []).filter((s) => s.winner_team_id === id).length
  const byId = new Map(matches.map((m) => [m.id, m]))
  const events: OpEvent[] = []
  for (const m of matches) {
    const base = baseName.get(m.base_id) ?? '—'
    const where = `${airportCode(base)} · ${base}`
    if (m.arrived_at)
      events.push({ id: `a-${m.id}`, at: m.arrived_at, kind: 'arrival', text: <><strong>{sign(m.team_a)}</strong> y <strong>{sign(m.team_b)}</strong> en puerta de {where}</> })
    if (m.finished_at)
      events.push({ id: `f-${m.id}`, at: m.finished_at, kind: 'finished', text: <>{where}: {teamName.get(m.team_a)} <strong>{wins(m, m.team_a)}–{wins(m, m.team_b)}</strong> {teamName.get(m.team_b)}</> })
  }
  for (const a of alerts) {
    const m = byId.get(a.match_id)
    events.push({ id: `n-${a.id}`, at: a.created_at, kind: 'alert', text: <>{m ? `${airportCode(baseName.get(m.base_id) ?? '')}: ` : ''}{a.message}</> })
  }
  return events.sort((x, y) => y.at.localeCompare(x.at))
}

const ICON = { arrival: Plane, finished: PlaneLanding, alert: Radio }
const LABEL = { arrival: 'Llegada', finished: 'Aterrizaje', alert: 'Aviso' }

export default function OpsLog({ events }: { events: OpEvent[] }) {
  return (
    <section className="card oplog">
      <header className="board-head">
        <div>
          <p className="eyebrow">Operations Log</p>
          <h2>Registro de operaciones</h2>
        </div>
      </header>
      {events.length === 0 ? (
        <p className="muted">Todavía no ha pasado nada: aquí aparecerán las llegadas, los aterrizajes y los avisos.</p>
      ) : (
        <ol className="ops">
          {events.map((e) => {
            const Icon = ICON[e.kind]
            return (
              <li key={e.id} className={`op ${e.kind}`}>
                <time className="op-time mono" dateTime={e.at}>
                  {stampTime(e.at)}
                </time>
                <span className="op-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="op-text">
                  <small className="mono">{LABEL[e.kind]}</small>
                  {e.text}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
