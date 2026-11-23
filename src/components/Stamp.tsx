import { useId, type CSSProperties } from 'react'
import { airportCode } from '../lib/flight'
import { FRAMES, sealForSeed, sealInkVar } from '../lib/seals'
import { stampLook } from '../lib/stamp'
import { MythPicture } from './InkSeals'

// A stamp of the passport. Every base has its own mythology seal (a picture turned into one ink: Zeus, Mjölnir, the dragon…), chosen from its
// id so it is the same on every screen, with a silhouette of its own (hexagon, shield, arch…), the name of the base on a band under it and
// the airport code of the place with the round. The ink and the tilt also come from the id, so two bases with the same seal still differ.
//   done     the base scored the three stages: the stamp is earned (with a gold seal)
//   stamped  the same stamp without the seal (the preview of a base's own stamp)
//   current  the destination the group is heading to: an outline waiting to be filled
//   pending  a later destination: an outline with its number
//   rest     the group does not play this round
export type StampState = 'done' | 'stamped' | 'current' | 'pending' | 'rest'

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)

export default function Stamp({
  seed,
  name,
  round,
  time,
  state = 'done',
  size = 120,
  pop = false,
  straight = false,
  atGate = false,
}: {
  seed: string // id of the base: decides the seal, the ink and the tilt
  name: string
  photoPath?: string | null // no longer printed (the stamp is a mythology seal); kept so the screens do not have to change
  round: number // 0 for the preview of a base's own stamp
  time?: string
  state?: StampState
  size?: number
  pop?: boolean // play the stamping animation
  straight?: boolean // ignore the tilt (previews)
  atGate?: boolean // for "current": the base already confirmed the arrival
}) {
  const uid = useId().replace(/:/g, '')
  const look = stampLook(seed)
  const seal = sealForSeed(seed)
  const code = airportCode(name)
  const filled = state === 'done' || state === 'stamped'
  const label = clip(name.toUpperCase(), 15)
  const fit = Math.min(6.4, (43 / label.length - 0.7) / 0.62) // the name always fits inside its band
  const footer = round > 0 ? `${code}·R${round}${time ? `·${time}` : ''}` : `${code}·SELLO`
  const outline = (seal.frame === 'medal' ? FRAMES.circle : FRAMES[seal.frame]).outer
  const style = {
    '--stamp-ink': state === 'rest' ? 'var(--text-faint)' : sealInkVar(seed),
    width: size,
    height: size,
    transform: straight ? undefined : `rotate(${look.tilt}deg)`,
  } as CSSProperties

  return (
    <span className={`stamp ${state}${pop ? ' pop' : ''}`} style={style} role="img" aria-label={stampLabel(name, round, time, state, atGate)}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          {/* worn ink: a few pale specks, like a real rubber stamp */}
          <filter id={`wear${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={look.seed} result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="specks" />
            <feComposite in="SourceGraphic" in2="specks" operator="in" />
          </filter>
        </defs>

        {filled ? (
          <g filter={`url(#wear${uid})`} className="stamp-ink">
            <MythPicture seal={seal} />
            <rect x="27" y="81" width="46" height="9" rx="1" stroke="none" />
            <text x="50" y="87.6" textAnchor="middle" fontSize={fit} fontWeight="800" letterSpacing=".7" stroke="none" className="stamp-text stamp-onink">
              {label}
            </text>
            <text x="50" y="97.4" textAnchor="middle" fontSize="3.6" fontWeight="700" stroke="none" letterSpacing=".5" className="stamp-mono">
              {footer}
            </text>
          </g>
        ) : (
          <g className="stamp-empty">
            <path d={outline} strokeWidth="1.8" strokeDasharray="4 3.2" fill="none" strokeLinejoin="round" />
            <text x="50" y={state === 'rest' ? 43 : 46} textAnchor="middle" fontSize={state === 'rest' ? 10 : 24} fontWeight="800" stroke="none" className="stamp-initial">
              {state === 'rest' ? 'DESCANSO' : round}
            </text>
            {state !== 'rest' && (
              <text x="50" y="61" textAnchor="middle" fontSize="6.6" fontWeight="700" letterSpacing=".9" stroke="none" className="stamp-mono">
                {state === 'current' ? (atGate ? 'EN PUERTA' : 'EN RUTA') : code}
              </text>
            )}
          </g>
        )}
      </svg>
      {state === 'done' && (
        <span className="stamp-seal" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
    </span>
  )
}

export function stampLabel(name: string, round: number, time: string | undefined, state: StampState, atGate = false): string {
  if (state === 'rest') return `Ronda ${round}: descansas`
  if (state === 'pending') return `Ronda ${round}: destino pendiente, ${name}`
  if (state === 'current') return `Ronda ${round}: ${name}, ${atGate ? 'ya estás en la puerta' : 'en ruta'}`
  return `Sello de ${name}${round > 0 ? `, ronda ${round}` : ''}${time ? `, ${time}` : ''}${state === 'done' ? ', destino completado' : ''}`
}
