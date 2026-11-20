import { useId, type CSSProperties, type ReactNode } from 'react'
import { COMMITTEES, committeeOf, type CommitteeKey } from '../lib/committees'
import ShapeSeal from './InkSeals'

// The stamp of each committee, in the mythology of the semester:
//   Clausura  the blue robe Homer wore to recite his poems
//   Meraki    Psyche (the soul) as a butterfly: the committee of the inductors for the inductors
//   Conzumo   the wine cup of Dionysus
//   Carrera   the ancient Olympic games: a runner inside the laurel wreath
//   Caos      the fire Prometheus gave to humans, a fire that lights other fires
// The coordinator of each committee gets the GOLDEN one (`lead`): the same drawing in gold foil with a ring of rays.
// Drawn in one ink (`color`, from --ink-N) with the paper colour for the cut-outs (--seal-paper), like the stamps of the bases.
const rad = (d: number) => (d * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]
const PAPER = 'var(--seal-paper)'

interface Paint {
  ink: string
  f: { fill: string; stroke: string }
  o: { fill: string; stroke: string }
  p: CSSProperties // paper cut-out
  ps: CSSProperties // paper line
}

function Clausura({ f, o, p, ps }: Paint) {
  return (
    <>
      <path {...f} d="M42 25Q50 30 58 25L66 30L72 41L75 64L65 66L63 49L67 78H33L37 49L35 66L25 64L28 41L34 30Z" />
      <path style={ps} fill="none" d="M42 25L50 40L58 25M50 40V78" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path style={ps} fill="none" d="M37.4 52H62.6" strokeWidth="2.2" />
      <circle style={p} cx="50" cy="52" r="2.4" />
      <path style={ps} fill="none" d="M36 73.6H64M40 63Q42 70 41 76M60 63Q58 70 59 76" strokeWidth="1" strokeLinecap="round" />
      <path style={ps} fill="none" d="M26.6 61H34.4M65.6 61H73.4" strokeWidth="1" strokeLinecap="round" />
      <path {...o} d="M44.4 21.4Q50 17.6 55.6 21.4" strokeWidth="1.6" strokeLinecap="round" />
    </>
  )
}

function Conzumo({ f, o, p }: Paint) {
  return (
    <>
      <path {...f} d="M26 47H74C74 61 62 67 50 67C38 67 26 61 26 47Z" />
      <ellipse {...o} cx="50" cy="47" rx="24" ry="4.2" strokeWidth="1.8" />
      <ellipse style={p} cx="50" cy="47" rx="21.6" ry="2.8" />
      <ellipse {...f} cx="50" cy="47.6" rx="17" ry="1.5" />
      <path {...o} d="M26 48C15 45 15 59 28 56M74 48C85 45 85 59 72 56" strokeWidth="2.6" strokeLinecap="round" />
      <path {...f} d="M47 66H53L54 76H46Z" />
      <ellipse {...f} cx="50" cy="77.4" rx="14" ry="2.6" />
      {[[63, 28], [69, 28], [66, 33.4], [60, 33.4], [72, 33.4], [66, 38.8], [69, 38.8], [63, 38.8]].map(([x, y], i) => (
        <circle key={i} {...f} cx={x} cy={y} r="2.9" />
      ))}
      <path {...o} d="M66 24.6V28M66 24.6Q70 21 73 22" strokeWidth="1.4" strokeLinecap="round" />
      <path {...f} d="M38 36L41 29L44 33L48 27L48.6 35L52 38L45 40L40 41Z" transform="translate(-6 -2)" />
      <path style={p} d="M39 36.4L45 31.6" fill="none" strokeWidth="0" />
    </>
  )
}

function Carrera({ f, o }: Paint) {
  const leaves: ReactNode[] = []
  const stems: string[] = []
  for (const side of [0, 1]) {
    const a0 = side ? 80 : 100
    const dir = side ? -1 : 1
    const [sx, sy] = polar(50, 50, 24, a0)
    const [ex, ey] = polar(50, 50, 24, a0 + dir * 7 * 17 + dir * 6)
    stems.push(`M${sx.toFixed(1)} ${sy.toFixed(1)}A24 24 0 0 ${side ? 0 : 1} ${ex.toFixed(1)} ${ey.toFixed(1)}`)
    for (let k = 0; k < 8; k++) {
      const a = a0 + dir * k * 17
      const out = k % 2 === 0
      const [x, y] = polar(50, 50, 24 + (out ? 2.6 : -2.6), a)
      const tangent = a + 90
      leaves.push(<ellipse key={`${side}${k}`} {...f} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="4.6" ry="1.9" transform={`rotate(${(tangent + (out ? -32 : 32) * dir).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`} />)
    }
  }
  return (
    <>
      <path {...o} d={stems.join('')} strokeWidth="1.1" />
      {leaves}
      <circle {...f} cx="54" cy="34" r="4.2" />
      <path {...o} d="M51 40L47.6 54M51 41L60 48L65 43M51 41L42 46L37.6 41M47.6 54L56 60L54 70M47.6 54L40.6 62L32 60" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path {...o} d="M31 38H40M28 45H36M31 52H38" strokeWidth="1.4" strokeLinecap="round" />
      <path {...o} d="M42 74H66" strokeWidth="1.6" strokeLinecap="round" />
    </>
  )
}

const FLAME = 'M50 22C58 33 67 41 62 56C60 64 55 68 50 68C45 68 40 64 38 56C35 45 44 40 50 22Z'
function Caos({ f, p }: Paint) {
  const small = (x: number, y: number, rot: number, k: number) => (
    <path {...f} d={FLAME} transform={`translate(${x} ${y}) rotate(${rot}) scale(${k}) translate(-50 -66)`} />
  )
  return (
    <>
      <path {...f} d={FLAME} />
      <path style={p} d="M50 40C55 47 58 51 56 58C55 62 52 64 50 64C48 64 45 62 44 58C43 51 46 47 50 40Z" />
      <path {...f} d="M50 51C52.4 54.6 54 56.6 53 60C52.4 62 51.2 62.8 50 62.8C48.8 62.8 47.6 62 47 60C46 56.6 47.6 54.6 50 51Z" />
      {small(27, 70, -24, 0.34)}
      {small(73, 70, 24, 0.34)}
      {small(24, 52, -38, 0.24)}
      {small(76, 52, 38, 0.24)}
      {[[34, 40], [66, 40], [40, 28], [60, 28], [30, 62], [70, 62]].map(([x, y], i) => (
        <circle key={i} {...f} cx={x} cy={y} r="1.2" />
      ))}
      <path {...f} d="M47.6 68H52.4L53.4 78H46.6Z" />
    </>
  )
}

// Bienvenida and Meraki have a silhouette of their own (ShapeSeal): a shield and an oval
const ART: Partial<Record<CommitteeKey, (p: Paint) => ReactNode>> = { clausura: Clausura, conzumo: Conzumo, carrera: Carrera, caos: Caos }

export default function CommitteeSeal({
  committee,
  lead = false,
  size = 120,
  tilt = 0,
  label,
}: {
  committee: CommitteeKey | string
  lead?: boolean // the coordinator of the committee: golden
  size?: number
  tilt?: number
  label?: string // accessible name
}) {
  const uid = useId().replace(/:/g, '')
  const c = committeeOf(committee) ?? COMMITTEES[0]
  const ink = lead ? `url(#cg${uid})` : 'currentColor'
  const paint: Paint = {
    ink,
    f: { fill: ink, stroke: 'none' },
    o: { fill: 'none', stroke: ink },
    p: { fill: PAPER, stroke: 'none' },
    ps: { stroke: PAPER },
  }
  const Art = ART[c.key]
  const name = label ?? `Sello del comité ${c.name}${lead ? ', coordinador' : ''}`
  if (c.key === 'bienvenida') return <ShapeSeal kind="shield" art="vest" ink={c.ink} gold={lead} size={size} tilt={tilt} label={name} top="BIENVENIDA" bottom="QUIEN TE RECIBE" />
  if (c.key === 'meraki') return <ShapeSeal kind="oval" art="butterfly" ink={c.ink} gold={lead} size={size} tilt={tilt} label={name} top="MERAKI" lines={['CON EL ALMA,', 'LA PASIÓN Y', 'EL CORAZÓN']} />
  const rays = Array.from({ length: 36 }, (_, i) => {
    const a = i * 10
    const [x1, y1] = polar(50, 50, 44.6, a - 2.6)
    const [x2, y2] = polar(50, 50, 44.6, a + 2.6)
    const [x3, y3] = polar(50, 50, i % 2 ? 48.6 : 50, a)
    return <polygon key={i} points={`${x1.toFixed(1)},${y1.toFixed(1)} ${x3.toFixed(1)},${y3.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`} />
  })
  return (
    <span className={`seal committee-seal ink-${c.ink}${lead ? ' gold' : ''}`} style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={name}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          {lead && (
            <linearGradient id={`cg${uid}`} gradientUnits="userSpaceOnUse" x1="8" y1="6" x2="92" y2="94">
              <stop offset="0" style={{ stopColor: 'var(--foil-a)' }} />
              <stop offset=".36" style={{ stopColor: 'var(--foil-b)' }} />
              <stop offset=".58" style={{ stopColor: 'var(--foil-c)' }} />
              <stop offset="1" style={{ stopColor: 'var(--foil-d)' }} />
            </linearGradient>
          )}
          <filter id={`cw${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={c.name.length * 7 + 13} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="s" />
            <feComposite in="SourceGraphic" in2="s" operator="in" />
          </filter>
          <path id={`ct${uid}`} d="M19 50A31 31 0 0 1 81 50" fill="none" />
          <path id={`cb${uid}`} d="M13 50A37 37 0 0 0 87 50" fill="none" />
        </defs>
        <g filter={lead ? undefined : `url(#cw${uid})`}>
          {lead && <g fill={ink} stroke="none">{rays}</g>}
          <g transform={lead ? 'translate(50 50) scale(.9) translate(-50 -50)' : undefined}>
            <circle {...paint.o} cx="50" cy="50" r="47" strokeWidth="3" />
            <circle {...paint.o} cx="50" cy="50" r="41.4" strokeWidth="1" />
            <circle {...paint.o} cx="50" cy="50" r="27.4" strokeWidth="1" />
            <text fontSize={c.name.length > 7 ? 7.4 : 8.6} fontWeight="800" letterSpacing="1.1" textAnchor="middle" fill={ink} stroke="none" className="stamp-text">
              <textPath href={`#ct${uid}`} startOffset="50%">{c.name.toUpperCase()}</textPath>
            </text>
            <text fontSize="5.2" fontWeight="700" letterSpacing=".5" textAnchor="middle" fill={ink} stroke="none" className="stamp-mono">
              <textPath href={`#cb${uid}`} startOffset="50%">{(lead ? `COORDINADOR · ${c.name}` : c.tagline).toUpperCase()}</textPath>
            </text>
            <g transform="translate(50 50) scale(.92) translate(-50 -50)">
              {Art && <Art {...paint} />}
            </g>
          </g>
        </g>
      </svg>
    </span>
  )
}
