import { useId, type CSSProperties, type ReactNode } from 'react'
import { careerKey } from './CareerEmblem'
import CareerPlate, { CAREER_NAME } from './CareerPlate'
import { EMBLEM, type InsigniaKey } from './InsigniaEmblems'

// The INSIGNIA of each group of careers: the top mark of a javeriano, the global representation of the career (not a seal: seals belong
// to bases, themes and committees). A gold medal of eight arms, after the Cruz San Pedro Claver of the Javeriana, hung from a clasp by a ribbon
// in the colours of the flag of the University (yellow, white and blue). The centre is an enamel disc in the blue of the flag with the drawing of
// the career; the name is engraved in the ring. The colours are the same in light and dark mode (`--puj-*`), like a real medal.
export type { InsigniaKey }
export const INSIGNIA_KEYS: InsigniaKey[] = ['sistemas', 'tronicas', 'biomec', 'civil', 'industrial']

const BLUE = 'var(--puj-blue)'
const mix = (c: string, pct: number, other: string) => `color-mix(in srgb, ${c} ${pct}%, ${other})`
const DARK_GOLD = mix('var(--foil-a)', 60, 'black')
const rad = (d: number) => (d * Math.PI) / 180
const C = { x: 100, y: 164 } // the centre of the medal

export type MedalProps = {
  career: InsigniaKey
  size?: number
  /** With the clasp and the ribbon (the big insignia) or only the medal (lists, avatars). */
  ribbon?: boolean
}

const stop = (offset: number, c: string) => <stop offset={offset} style={{ stopColor: c } as CSSProperties} />

// one arm of the medal: a spear that widens at the disc and ends in a point, pointing up from the centre
const arm = (len: number) => `M-9 -60L-5.2 ${-(len - 14)}L0 ${-len}L5.2 ${-(len - 14)}L9 -60Z`

export function MedallaBadge({ career, size = 170, ribbon = true }: MedalProps) {
  const uid = useId().replace(/:/g, '')
  const color = BLUE
  const metal = `url(#m${uid})`
  const concave = `url(#n${uid})`
  const viewBox = ribbon ? '0 0 200 272' : '2 64 196 196'
  const height = ribbon ? Math.round(size * 1.36) : size

  // the rays engraved between the enamel and the ring
  const rays = Array.from({ length: 64 }, (_, k) => {
    const a = rad((k * 360) / 64)
    return <path key={k} d={`M${(C.x + 48.6 * Math.cos(a)).toFixed(2)} ${(C.y + 48.6 * Math.sin(a)).toFixed(2)}L${(C.x + 52.4 * Math.cos(a)).toFixed(2)} ${(C.y + 52.4 * Math.sin(a)).toFixed(2)}`} stroke={DARK_GOLD} strokeOpacity=".5" strokeWidth=".9" strokeLinecap="round" />
  })
  // engraved lettering: a light edge under the dark gold
  const engraved = (children: ReactNode, fontSize: number, spacing: number, family: 'stamp-text' | 'stamp-mono') => (
    <>
      <text fontSize={fontSize} fontWeight={800} letterSpacing={spacing} fill="white" fillOpacity=".55" textAnchor="middle" className={family} transform="translate(.5 .7)">{children}</text>
      <text fontSize={fontSize} fontWeight={800} letterSpacing={spacing} fill={DARK_GOLD} textAnchor="middle" className={family}>{children}</text>
    </>
  )

  return (
    <svg viewBox={viewBox} width={size} height={height} role="img" aria-label={`Insignia de ${CAREER_NAME[career]}: medalla${ribbon ? ' con cinta' : ''}`} style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 5px 5px rgba(3, 29, 68, .32))' }}>
      <defs>
        <linearGradient id={`m${uid}`} gradientUnits="userSpaceOnUse" x1="30" y1="70" x2="170" y2="262">
          {stop(0, 'var(--foil-b)')}
          {stop(0.3, 'var(--foil-d)')}
          {stop(0.55, 'var(--foil-c)')}
          {stop(0.8, 'var(--foil-b)')}
          {stop(1, 'var(--foil-a)')}
        </linearGradient>
        <linearGradient id={`n${uid}`} gradientUnits="userSpaceOnUse" x1="30" y1="70" x2="170" y2="262">
          {stop(0, 'var(--foil-a)')}
          {stop(0.45, 'var(--foil-c)')}
          {stop(1, 'var(--foil-b)')}
        </linearGradient>
        <radialGradient id={`e${uid}`} cx="0.38" cy="0.3" r="0.9">
          {stop(0, mix(color, 70, 'white'))}
          {stop(0.55, color)}
          {stop(1, mix(color, 58, 'black'))}
        </radialGradient>
        <linearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="0">
          {stop(0, 'rgba(0, 0, 0, .28)')}
          {stop(0.18, 'rgba(0, 0, 0, 0)')}
          {stop(0.5, 'rgba(255, 255, 255, .22)')}
          {stop(0.82, 'rgba(0, 0, 0, 0)')}
          {stop(1, 'rgba(0, 0, 0, .28)')}
        </linearGradient>
        <clipPath id={`rc${uid}`}>
          <path d="M66 22H134L120 68H80Z" />
        </clipPath>
        <clipPath id={`ec${uid}`}>
          <circle cx={C.x} cy={C.y} r="43" />
        </clipPath>
        <clipPath id={`dc${uid}`}>
          <circle cx={C.x} cy={C.y} r="67" />
        </clipPath>
        <path id={`b${uid}`} d={`M${C.x - 65} ${C.y}A65 65 0 0 0 ${C.x + 65} ${C.y}`} />
        <path id={`t${uid}`} d={`M${C.x - 57.6} ${C.y}A57.6 57.6 0 0 1 ${C.x + 57.6} ${C.y}`} />
      </defs>

      {ribbon && (
        <g>
          <g clipPath={`url(#rc${uid})`}>
            <path d="M66 22L87.3 22L93.3 68L80 68Z" style={{ fill: 'var(--puj-yellow)' }} />
            <path d="M87.3 22L112.7 22L106.7 68L93.3 68Z" style={{ fill: 'var(--puj-white)' }} />
            <path d="M112.7 22L134 22L120 68L106.7 68Z" style={{ fill: 'var(--puj-blue)' }} />
            <rect x="60" y="20" width="80" height="50" fill={`url(#r${uid})`} />
          </g>
          <path d="M66 22L80 68M134 22L120 68" stroke="black" strokeOpacity=".25" strokeWidth="1" />
          <rect x="58" y="8" width="84" height="18" rx="3.5" fill={metal} stroke={DARK_GOLD} strokeWidth="1" />
          <rect x="66" y="13" width="68" height="7" rx="2.5" fill="black" fillOpacity=".55" />
          <path d="M62 10.4H138" stroke="white" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="100" cy="68" r="7" fill="none" stroke={metal} strokeWidth="4" />
          <circle cx="100" cy="68" r="9" fill="none" stroke={DARK_GOLD} strokeOpacity=".5" strokeWidth=".8" />
        </g>
      )}

      {/* the eight arms: the four of the cross a little longer than the diagonal ones */}
      {Array.from({ length: 8 }, (_, k) => (
        <g key={k} transform={`translate(${C.x} ${C.y}) rotate(${k * 45})`}>
          <path d={arm(k % 2 ? 88 : 98)} fill={metal} stroke={DARK_GOLD} strokeWidth="1.1" strokeLinejoin="round" />
          <path d={`M-2.4 -66L-0.6 ${-(k % 2 ? 80 : 90)}`} stroke="white" strokeOpacity=".55" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      ))}

      {/* the disc: a raised rim, the engraved ring and the enamel in the middle */}
      <circle cx={C.x} cy={C.y} r="71" fill={metal} stroke={DARK_GOLD} strokeWidth="1.1" />
      <circle cx={C.x} cy={C.y} r="67" fill={concave} />
      <circle cx={C.x} cy={C.y} r="67" fill="none" stroke="white" strokeOpacity=".45" strokeWidth=".8" />
      <g clipPath={`url(#dc${uid})`}>
        <ellipse cx={C.x - 26} cy={C.y - 34} rx="44" ry="17" transform={`rotate(-34 ${C.x - 26} ${C.y - 34})`} fill="white" fillOpacity=".16" />
      </g>
      <circle cx={C.x} cy={C.y} r="53.8" fill="none" stroke={DARK_GOLD} strokeOpacity=".55" strokeWidth=".9" />
      <circle cx={C.x} cy={C.y} r="53" fill="none" stroke="white" strokeOpacity=".4" strokeWidth=".7" />
      {rays}
      {engraved(<textPath href={`#b${uid}`} startOffset="50%">{CAREER_NAME[career]}</textPath>, 11.5, 2.4, 'stamp-text')}
      {engraved(<textPath href={`#t${uid}`} startOffset="50%">INGENIERÍA · JAVERIANA</textPath>, 6.2, 1.7, 'stamp-mono')}
      <circle cx={C.x - 60.4} cy={C.y} r="1.5" fill={DARK_GOLD} />
      <circle cx={C.x + 60.4} cy={C.y} r="1.5" fill={DARK_GOLD} />

      <circle cx={C.x} cy={C.y} r="47" fill={metal} />
      <circle cx={C.x} cy={C.y} r="44" fill={`url(#e${uid})`} />
      <circle cx={C.x} cy={C.y} r="44" fill="none" stroke="black" strokeOpacity=".3" strokeWidth="1" />
      <ellipse cx={C.x - 14} cy={C.y - 24} rx="26" ry="9" transform={`rotate(-30 ${C.x - 14} ${C.y - 24})`} fill="white" fillOpacity=".13" />
      <g clipPath={`url(#ec${uid})`}>
        <g transform={`translate(${C.x - 48.2} ${C.y - 48.2}) scale(.1206)`}>{EMBLEM[career]()}</g>
      </g>
    </svg>
  )
}

/** The insignia of a career by its name (Ingeniería de Sistemas, Bioingeniería…): a career the app does not know keeps the plate. */
export default function Insignia({ career, size = 170, ribbon = true }: { career: string; size?: number; ribbon?: boolean }) {
  const key = careerKey(career)
  if (key === 'general') return <CareerPlate career={career} size={size} />
  return <MedallaBadge career={key} size={size} ribbon={ribbon} />
}
