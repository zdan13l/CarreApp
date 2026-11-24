import { airportCode, type JourneyMatch } from '../lib/flight'
import { stampTime } from '../lib/stamp'

// Passport Verification: one cell per destination of each flight, with the state of its stamp. A stamp is earned when the base
// has scored the three stages (the match is finished). The same data the runners see in their passports.
export default function PassportMatrix({
  teams,
  matches,
  baseName,
  codes,
}: {
  teams: { id: string; name: string }[]
  matches: JourneyMatch[]
  baseName: Map<string, string>
  codes: Map<string, string>
}) {
  const total = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const rounds = Array.from({ length: total }, (_, i) => i + 1)
  if (rounds.length === 0) return null
  return (
    <section className="card">
      <header className="board-head">
        <div>
          <h2>Verificación de sellos</h2>
        </div>
      </header>
      <p className="muted">Un sello se gana cuando la base califica las tres etapas del destino. Cada celda es un destino de la ronda; son los mismos datos que ven los corredores en su pasaporte.</p>
      <div className="verify">
        <table>
          <thead>
            <tr>
              <th>Vuelo</th>
              {rounds.map((r) => (
                <th key={r}>R{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td className="v-team">
                  <strong>{t.name}</strong>
                  <span>{codes.get(t.id)}</span>
                </td>
                {rounds.map((r) => {
                  const m = matches.find((x) => x.round_number === r && (x.team_a === t.id || x.team_b === t.id))
                  if (!m) return <td key={r}><div className="v-cell rest" title="Descansa">—</div></td>
                  const base = baseName.get(m.base_id) ?? ''
                  const state = m.status === 'finished' ? 'done' : m.arrived_at || m.status === 'in_progress' ? 'current' : ''
                  return (
                    <td key={r}>
                      <div className={`v-cell ${state}`} title={`${base}: ${state === 'done' ? 'sello obtenido' : state === 'current' ? 'en puerta' : 'pendiente'}`}>
                        <span>{airportCode(base)}</span>
                        <small>{state === 'done' ? stampTime(m.finished_at) : state === 'current' ? 'puerta' : ''}</small>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="verify-legend">
        <span><i className="done" />Sello obtenido</span>
        <span><i className="current" />En puerta</span>
        <span><i />Pendiente</span>
      </p>
    </section>
  )
}
