import { ChevronRight } from 'lucide-react'
import Crest from './Crest'

// Every group of the Carrera by name and picture (alphabetical): no scores and no order of merit, so nobody on a phone
// can tell who is ahead before the coordinator announces it.
export default function TeamNames({ teams, highlightId, onSelect }: { teams: { id: string; name: string; photo_path: string | null }[]; highlightId?: string; onSelect?: (id: string) => void }) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <ul className="team-names">
      {sorted.map((t) => (
        <li key={t.id} className={t.id === highlightId ? 'mine' : undefined}>
          {onSelect ? (
            <button type="button" className="team-row" onClick={() => onSelect(t.id)} aria-haspopup="dialog" aria-label={`Ver al equipo ${t.name}`}>
              <Crest name={t.name} photoPath={t.photo_path} />
              <span className="team-name">{t.name}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <>
              <Crest name={t.name} photoPath={t.photo_path} />
              <span className="team-name">{t.name}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
