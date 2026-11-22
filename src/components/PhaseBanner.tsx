import { Compass, Lock } from 'lucide-react'
import type { EventPhase } from '../types'

// What a base or a runner sees on top of the screen while the Carrera is not Iniciada: why the buttons are off, and (when it is only
// Habilitada) the way into the tutorial.
export default function PhaseBanner({ phase, onTutorial, compact = false }: { phase: EventPhase; onTutorial?: () => void; compact?: boolean }) {
  if (phase !== 'enabled' && phase !== 'finished') return null
  const enabled = phase === 'enabled'
  return (
    <div className={`phase-banner ${phase}${compact ? ' compact' : ''}`} role="status">
      <Lock size={22} aria-hidden="true" />
      <div className="grow">
        <strong>{enabled ? 'La Carrera aún no empieza' : 'La Carrera terminó'}</strong>
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
