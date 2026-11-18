import { airportCode, FLIGHT_LABEL, flightOf, type Flight, type JourneyMatch } from '../lib/flight'
import { stampTime } from '../lib/stamp'

// Flight Control: every group is a flight with a call sign, a destination (the base it is heading to or playing at), a gate
// (the round) and a status that comes from its matches: en ruta, en puerta (the base confirmed the arrival), aterrizado (all
// matches done) or demora (the group is taking longer than allowed to walk to its base). Nothing here is stored or invented.
export interface BoardTeam {
  id: string
  name: string
}

const ORDER: Record<string, number> = { demora: 0, 'en-puerta': 1, 'en-ruta': 2, aterrizado: 3, 'sin-itinerario': 4 }

export function boardRows(teams: BoardTeam[], matches: JourneyMatch[], lateIds: Set<string>): (Flight & { late: boolean; name: string })[] {
  return teams.map((t) => {
    const f = flightOf(t.id, matches)
    return { ...f, late: f.state === 'en-ruta' && lateIds.has(t.id), name: t.name }
  })
}

export default function FlightBoard({
  teams,
  matches,
  baseName,
  codes,
  lateIds,
}: {
  teams: BoardTeam[]
  matches: JourneyMatch[]
  baseName: Map<string, string>
  codes: Map<string, string>
  lateIds: Set<string>
}) {
  const rows = boardRows(teams, matches, lateIds).sort(
    (a, b) => ORDER[a.late ? 'demora' : a.state] - ORDER[b.late ? 'demora' : b.state] || (codes.get(a.teamId) ?? '').localeCompare(codes.get(b.teamId) ?? ''),
  )
  return (
    <section className="card board">
      <header className="board-head">
        <div>
          <p className="eyebrow">Flight Control</p>
          <h2>Vuelos</h2>
        </div>
        <span className="chip">{rows.length} vuelos</span>
      </header>
      {rows.length === 0 ? (
        <p className="muted">Todavía no hay grupos en esta Carrera.</p>
      ) : (
        <ul className="flights">
          <li className="flight head" aria-hidden="true">
            <span>Vuelo</span>
            <span>Grupo</span>
            <span>Destino</span>
            <span>Puerta</span>
            <span>Estado</span>
            <span>Sellos</span>
            <span>Último</span>
          </li>
          {rows.map((r) => {
            const state = r.late ? 'demora' : r.state
            const name = r.current ? baseName.get(r.current.base_id) ?? '—' : ''
            const stages = r.current ? r.current.match_scores?.length ?? 0 : 0
            return (
              <li key={r.teamId} className={`flight st-${state}`}>
                <span className="fl-code mono">{codes.get(r.teamId) ?? '—'}</span>
                <span className="fl-team">{r.name}</span>
                <span className="fl-dest">
                  {r.current ? (
                    <>
                      <b className="mono">{airportCode(name)}</b> {name}
                      {r.state === 'en-puerta' && <small> · etapa {Math.min(stages + 1, 3)} de 3</small>}
                    </>
                  ) : r.state === 'aterrizado' ? (
                    <span className="muted">Itinerario completo</span>
                  ) : (
                    <span className="muted">Sin cruces</span>
                  )}
                </span>
                <span className="fl-gate num">{r.current ? String(r.current.round_number).padStart(2, '0') : '—'}</span>
                <span className={`fl-state st-${state}`}>{FLIGHT_LABEL[state]}</span>
                <span className="fl-prog" aria-label={`${r.completed} de ${r.total} destinos completados`}>
                  {Array.from({ length: r.total }, (_, i) => (
                    <i key={i} className={i < r.completed ? 'on' : undefined} />
                  ))}
                </span>
                <span className="fl-last mono">{stampTime(r.lastStamp) || '—'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
