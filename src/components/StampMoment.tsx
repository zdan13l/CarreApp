import { useEffect } from 'react'
import Stamp from './Stamp'

// The moment the base scores the third stage of the match: the stamp lands on the screen, the phone vibrates once. It stays until the
// person taps "Seguir", so they are sure to see it. With "reduce motion" it simply appears (the animations are switched off in index.css).
export default function StampMoment({
  seed,
  name,
  photoPath,
  round,
  time,
  onClose,
}: {
  seed: string
  name: string
  photoPath: string | null
  round: number
  time: string
  onClose: () => void
}) {
  useEffect(() => {
    try {
      navigator.vibrate?.(35)
    } catch {
      /* not every phone can vibrate */
    }
  }, [])

  return (
    <div className="moment" role="dialog" aria-modal="true" aria-label={`Sello conseguido: ${name}`}>
      <div className="moment-card">
        <p className="moment-kicker">Destino completado</p>
        <Stamp seed={seed} name={name} photoPath={photoPath} round={round} time={time} state="stamped" size={228} pop straight />
        <h2>{name}</h2>
        <p className="moment-sub">Sello {round} en tu pasaporte</p>
        <button type="button" className="moment-close" onClick={onClose} autoFocus>
          Seguir
        </button>
      </div>
    </div>
  )
}
