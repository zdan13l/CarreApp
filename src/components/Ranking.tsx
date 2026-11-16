import type { StandingRow } from '../types'
import Crest from './Crest'

// "TOP EQUIPOS": position, crest, name and points. Teams with the same points share the position.
export default function Ranking({ rows, highlightId }: { rows: StandingRow[]; highlightId?: string }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  if (sorted.length === 0) return <p className="muted">Todavía no hay grupos.</p>
  return (
    <ol className="top-teams">
      {sorted.map((r) => {
        const position = sorted.findIndex((x) => x.points === r.points) + 1
        return (
          <li key={r.team_id} className={r.team_id === highlightId ? 'mine' : undefined}>
            <span className="pos num">{position}</span>
            <Crest name={r.name} photoPath={r.photo_path} />
            <span className="team-name">{r.name}</span>
            <span className="pts num">
              {r.points}
              <small>{r.points === 1 ? 'pt' : 'pts'}</small>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
