import { Compass, Lock } from 'lucide-react'
import type { EventPhase } from '../types'

// What a base or a runner sees on top of the screen while the Carrera is not Iniciada: why the buttons are off, and (when it is only
// Habilitada) the way into the tutorial.
export default function PhaseBanner({ phase, onTutorial }: { phase: EventPhase; onTutorial?: () => void }) {
  if (phase !== 'enabled' && phase !== 'finished') return null
  const enabled = phase === 'enabled'
  return (
    <div className={`phase-banner ${phase}`} role="status">
      <Lock size={22} aria-hidden="true" />
      <div className="grow">
        <strong>{enabled ? 'La Carrera aún no empieza' : 'La Carrera terminó'}</strong>
        <p>
          {enabled
            ? 'Puedes mirar cada pantalla. Los botones se activan cuando el coordinador inicie la Carrera.'
            : 'El coordinador está validando los resultados. Los botones están bloqueados.'}
        </p>
        {enabled && onTutorial && (
          <button type="button" className="ghost phase-tutorial" onClick={onTutorial}>
            <Compass size={18} aria-hidden="true" />
            Ver tutorial
          </button>
        )}
      </div>
    </div>
  )
}
