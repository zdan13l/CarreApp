import { ChevronLeft, ChevronRight } from 'lucide-react'

// Round-by-round navigation so the coordinator focuses on one round at a time during the Carrera.
export default function RoundPager({
  round,
  total,
  matches,
  finished,
  onChange,
  showAll,
  onToggleAll,
}: {
  round: number
  total: number
  matches: number
  finished: number
  onChange: (round: number) => void
  showAll: boolean
  onToggleAll: (v: boolean) => void
}) {
  return (
    <div className="pager card">
      {!showAll && (
        <div className="pager-nav">
          <button className="ghost" disabled={round <= 1} onClick={() => onChange(round - 1)}>
            <ChevronLeft size={18} aria-hidden="true" />
            Anterior
          </button>
          <div className="pager-title">
            <strong>Ronda {round} de {total}</strong>
            <small className="muted">{matches === 0 ? 'Sin cruces' : `${finished} de ${matches} cruces terminados`}</small>
          </div>
          <button disabled={round >= total} onClick={() => onChange(round + 1)}>
            Siguiente
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={showAll} onChange={(e) => onToggleAll(e.target.checked)} />
        Ver todas las rondas
      </label>
    </div>
  )
}
