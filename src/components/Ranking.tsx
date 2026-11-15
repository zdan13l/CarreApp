import '../ranking.css'
import { photoUrl } from '../lib/storage'
import type { StandingRow } from '../types'

// "TOP EQUIPOS": position, photo, name and points. Teams with the same points share the position.
export default function Ranking({ rows, highlightId }: { rows: StandingRow[]; highlightId?: string }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  return (
    <ol className="top-teams">
      {sorted.map((r) => {
        const position = sorted.findIndex((x) => x.points === r.points) + 1
        const url = photoUrl(r.photo_path)
        return (
          <li key={r.team_id} className={r.team_id === highlightId ? 'mine' : undefined}>
            <span className="pos">{position}</span>
            {url ? <img src={url} alt="" /> : <span className="noimg" aria-hidden="true">👥</span>}
            <span className="grow">{r.name}</span>
            <strong>{r.points} {r.points === 1 ? 'pt' : 'pts'}</strong>
          </li>
        )
      })}
    </ol>
  )
}
