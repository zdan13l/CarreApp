import Crest from './Crest'

// Every group of the Carrera by name and picture (alphabetical): no scores and no order of merit, so nobody on a phone
// can tell who is ahead before the coordinator announces it.
export default function TeamNames({ teams, highlightId }: { teams: { id: string; name: string; photo_path: string | null }[]; highlightId?: string }) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <ul className="team-names">
      {sorted.map((t) => (
        <li key={t.id} className={t.id === highlightId ? 'mine' : undefined}>
          <Crest name={t.name} photoPath={t.photo_path} />
          <span className="team-name">{t.name}</span>
        </li>
      ))}
    </ul>
  )
}
