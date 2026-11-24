import { PHASE_LABEL } from '../lib/phase'
import type { EventPhase } from '../types'

// The head of a carrera, as the boarding pass the runners and the bases already know: the name and its state on the left, the code (the flight
// number of the stub) on the right. The line above the name is data, not decoration: where the carrera is.
export default function CarreraTicket({
  name,
  code,
  isTest,
  phase,
  line,
  onExport,
}: {
  name: string
  code: string | null
  isTest: boolean
  phase: EventPhase
  line: string
  onExport?: () => void
}) {
  const stub = isTest ? 'PRUEBA' : (code ?? '—')
  return (
    <div className="tc-wrap carrera-ticket">
      <div className="tc">
        <div className="tc-main">
          <p className="tc-kicker">{line}</p>
          <span className="tc-name">{isTest ? 'Carrera de prueba' : name}</span>
          <div className="tc-chips">
            {phase === 'started' ? <span className="live-label">{PHASE_LABEL[phase]}</span> : <span className={`badge${phase === 'enabled' ? ' ok' : ''}`}>{PHASE_LABEL[phase]}</span>}
          </div>
          {onExport && (
            <div className="tc-actions">
              <button type="button" className="ghost" onClick={onExport}>Descargar resultados</button>
            </div>
          )}
        </div>
        <div className="tc-stub">
          <span className={`tc-code${stub.length > 5 ? ' long' : ''}`}>{stub}</span>
          <small>carrera</small>
        </div>
      </div>
    </div>
  )
}
