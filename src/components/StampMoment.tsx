import { useEffect } from 'react'
import Stamp from './Stamp'

// The moment the base scores the third stage of the match: the stamp lands on the screen, the phone vibrates once. Tapping closes it;
// otherwise it closes by itself. With "reduce motion" it simply appears (the animations are switched off in index.css).
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
    const t = window.setTimeout(onClose, 4200)
    return () => window.clearTimeout(t)
  }, [onClose])

  return (
    <div className="moment" role="dialog" aria-modal="true" aria-label={`Sello conseguido: ${name}`} onClick={onClose}>
      <div className="moment-card">
        <p className="moment-kicker">Destino completado</p>
        <Stamp seed={seed} name={name} photoPath={photoPath} round={round} time={time} state="stamped" size={228} pop straight />
        <h2>{name}</h2>
        <p className="moment-sub">Sello {round} en tu pasaporte</p>
        <button type="button" className="ghost moment-close" onClick={onClose}>
          Seguir
        </button>
      </div>
    </div>
  )
}
