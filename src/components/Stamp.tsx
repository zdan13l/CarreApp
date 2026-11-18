import {
  Building2, Church, Coffee, Compass, FlaskConical, Goal, GraduationCap, Landmark, Library, Lightbulb, Mountain, Music, Palette,
  Sprout, Star, Sun, Theater, TreePine, type LucideIcon,
} from 'lucide-react'
import { useId, type CSSProperties } from 'react'
import { airportCode } from '../lib/flight'
import { stampLook, stampSymbol, type StampShape, type StampSymbol } from '../lib/stamp'
import { photoUrl } from '../lib/storage'

// A stamp of the passport. Every base has its own: the photo of the place printed in one ink, its name and its three-letter
// airport code, a symbol of what the place is (a book for the library, a goal for the pitch…), and a shape, ink and
// composition drawn from its id, so two bases never look alike and each one is recognisable on every screen.
//   done     the base scored the three stages: the stamp is earned (with a gold seal)
//   stamped  the same stamp without the seal (the preview of a base's own stamp)
//   current  the destination the group is heading to: an outline waiting to be filled
//   pending  a later destination: an outline with its number
//   rest     the group does not play this round
export type StampState = 'done' | 'stamped' | 'current' | 'pending' | 'rest'

const SYMBOL_ICON: Record<StampSymbol, LucideIcon> = {
  library: Library, goal: Goal, landmark: Landmark, church: Church, coffee: Coffee, flask: FlaskConical, theater: Theater,
  tree: TreePine, building: Building2, palette: Palette, mountain: Mountain, compass: Compass, sun: Sun, star: Star,
  bulb: Lightbulb, cap: GraduationCap, sprout: Sprout, music: Music,
}

const POINTS: Partial<Record<StampShape, string>> = {
  hexagon: '50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5',
  octagon: '93.4,68 68,93.4 32,93.4 6.6,68 6.6,32 32,6.6 68,6.6 93.4,32',
}

function Outline({ shape, inset = 0 }: { shape: StampShape; inset?: number }) {
  const s = 1 - inset / 47
  const common = { fill: 'none', vectorEffect: 'non-scaling-stroke' as const }
  if (shape === 'circle') return <circle cx="50" cy="50" r={47 * s} {...common} />
  if (shape === 'square') return <rect x={50 - 46 * s} y={50 - 46 * s} width={92 * s} height={92 * s} rx={22 * s} {...common} />
  return <polygon points={POINTS[shape]} transform={`translate(50 50) scale(${s}) translate(-50 -50)`} {...common} />
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)

export default function Stamp({
  seed,
  name,
  photoPath,
  round,
  time,
  state = 'done',
  size = 120,
  pop = false,
  straight = false,
  atGate = false,
}: {
  seed: string // id of the base: decides the shape, the ink and the composition
  name: string
  photoPath?: string | null
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
  const code = airportCode(name)
  const Symbol = SYMBOL_ICON[stampSymbol(name, seed)]
  const url = photoUrl(photoPath ?? null)
  const filled = state === 'done' || state === 'stamped'
  const band = look.layout === 'band'
  const label = clip(name.toUpperCase(), band ? 14 : 17)
  const topSize = label.length > 13 ? 6.3 : label.length > 10 ? 7 : 7.8
  const bandSize = label.length > 11 ? 6.6 : label.length > 8 ? 7.6 : 8.6
  const footer = round > 0 ? `${code}·R${round}${time ? `·${time}` : ''}` : `${code}·SELLO`
  const style = {
    '--stamp-ink': state === 'rest' ? 'var(--text-faint)' : `var(--ink-${look.ink})`,
    width: size,
    height: size,
    transform: straight ? undefined : `rotate(${look.tilt}deg)`,
  } as CSSProperties
  const photoR = band ? 31 : 24
  const photoY = band ? 47 : 50

  return (
    <span className={`stamp ${state}${pop ? ' pop' : ''}`} style={style} role="img" aria-label={stampLabel(name, round, time, state, atGate)}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          {/* the photo printed in one ink: dark areas take the ink, light areas stay paper */}
          <filter id={`ink${uid}`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.26 -.86 -.09 0 1.12" result="alpha" />
            <feFlood style={{ floodColor: 'var(--stamp-ink)' }} result="ink" />
            <feComposite in="ink" in2="alpha" operator="in" />
          </filter>
          {/* worn ink: a few pale specks, like a real rubber stamp */}
          <filter id={`wear${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={look.seed} result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="specks" />
            <feComposite in="SourceGraphic" in2="specks" operator="in" />
          </filter>
          <clipPath id={`disc${uid}`}>
            <circle cx="50" cy={photoY} r={photoR} />
          </clipPath>
          <path id={`top${uid}`} d="M19 50 A31 31 0 0 1 81 50" fill="none" />
          <path id={`bot${uid}`} d="M14 50 A36 36 0 0 0 86 50" fill="none" />
        </defs>

        {filled ? (
          <g filter={`url(#wear${uid})`} className="stamp-ink">
            <g strokeWidth="3.2" fill="none">
              <Outline shape={look.shape} />
            </g>
            <g strokeWidth="1.1" fill="none">
              <Outline shape={look.shape} inset={6.5} />
            </g>
            {!band && (
              <>
                <circle cx="50" cy="50" r="26.5" fill="none" strokeWidth="1.1" />
                <circle cx="50" cy="50" r="41" fill="none" strokeWidth=".8" />
              </>
            )}
            {url ? (
              <image href={url} x={50 - photoR} y={photoY - photoR} width={photoR * 2} height={photoR * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#disc${uid})`} filter={`url(#ink${uid})`} />
            ) : (
              <text x="50" y={band ? 56 : 59} textAnchor="middle" fontSize={band ? 32 : 26} fontWeight="800" stroke="none" className="stamp-initial">
                {label.charAt(0)}
              </text>
            )}
            {band ? (
              <>
                <g transform="rotate(-8 50 60)">
                  <rect x="4" y="52" width="92" height="17" stroke="none" />
                  <text x="50" y={63.4} textAnchor="middle" fontSize={bandSize} fontWeight="800" stroke="none" letterSpacing=".6" className="stamp-text stamp-onink">
                    {label}
                  </text>
                </g>
                <circle cx="50" cy="14" r="8.5" stroke="none" />
                <Symbol x={44} y={8} width={12} height={12} strokeWidth={2.3} style={{ color: 'var(--stamp-paper)' }} />
                <text x="50" y="84" textAnchor="middle" fontSize="6.3" fontWeight="700" stroke="none" letterSpacing=".5" className="stamp-mono">
                  {footer}
                </text>
              </>
            ) : (
              <>
                <text fontSize={topSize} fontWeight="800" stroke="none" letterSpacing=".9" textAnchor="middle" className="stamp-text">
                  <textPath href={`#top${uid}`} startOffset="50%">
                    {label}
                  </textPath>
                </text>
                <text fontSize="6.2" fontWeight="700" stroke="none" letterSpacing=".6" textAnchor="middle" className="stamp-mono">
                  <textPath href={`#bot${uid}`} startOffset="50%">
                    {footer}
                  </textPath>
                </text>
                <circle cx="31" cy="69" r="8" stroke="none" />
                <Symbol x={25.5} y={63.5} width={11} height={11} strokeWidth={2.4} style={{ color: 'var(--stamp-paper)' }} />
              </>
            )}
          </g>
        ) : (
          <g className="stamp-empty">
            <g strokeWidth="1.8" strokeDasharray="4 3.2">
              <Outline shape={look.shape} />
            </g>
            {state === 'current' && url && (
              <image href={url} x="26" y="26" width="48" height="48" preserveAspectRatio="xMidYMid slice" clipPath={`url(#disc${uid})`} filter={`url(#ink${uid})`} opacity=".3" />
            )}
            <text x="50" y={state === 'rest' ? 52 : 55} textAnchor="middle" fontSize={state === 'rest' ? 11 : 24} fontWeight="800" stroke="none" className="stamp-initial">
              {state === 'rest' ? 'DESCANSO' : round}
            </text>
            {state !== 'rest' && (
              <text x="50" y="70" textAnchor="middle" fontSize="6.6" fontWeight="700" letterSpacing=".9" stroke="none" className="stamp-mono">
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
