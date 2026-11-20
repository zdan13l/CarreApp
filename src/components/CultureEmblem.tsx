import { useId, type ReactNode } from 'react'
import type { CultureKey } from '../lib/themes'

// The emblem of each culture of the theme (the cover of the personal passport) and the border ornament of its pages. They are
// drawn as vectors in one colour (the culture's ink), with the paper colour for the cut-outs, like the stamps of the passport.
const rad = (d: number) => (d * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]
const f = (n: number) => +n.toFixed(2)
const pt = (p: [number, number]) => `${f(p[0])},${f(p[1])}`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const Ring = ({ r, w, cx = 50, cy = 50 }: { r: number; w: number; cx?: number; cy?: number }) => <circle className="o" cx={cx} cy={cy} r={r} strokeWidth={w} />

function Medusa() {
  const N = 13
  const snakes: ReactNode[] = []
  for (let k = 0; k < N; k++) {
    const a = 130 + k * (280 / (N - 1))
    const far = Math.abs((((a % 360) + 360) % 360) - 270) < 105 ? 27.6 : 23.4
    let d = ''
    let end: [number, number] = [0, 0]
    for (let s = 0; s <= 14; s++) {
      const t = s / 14
      const [x, y] = polar(50, 50, lerp(11, far, t), a)
      const [ox, oy] = polar(0, 0, Math.sin(t * Math.PI * 2.3 + k * 1.3) * 3.4 * t, a + 90)
      end = [x + ox, y + oy]
      d += `${s ? 'L' : 'M'}${pt(end)}`
    }
    snakes.push(
      <g key={k}>
        <path className="o" d={d} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        <ellipse className="f" cx={f(end[0])} cy={f(end[1])} rx="2.7" ry="1.9" transform={`rotate(${f(a)} ${f(end[0])} ${f(end[1])})`} />
      </g>,
    )
  }
  return (
    <>
      <Ring r={47} w={3} />
      <Ring r={44} w={1} />
      <g transform="translate(50 50) scale(1.22) translate(-50 -50)">
        {snakes}
        <circle className="f" cx="50" cy="50" r="12.4" />
        <ellipse className="pp" cx="44.4" cy="47.6" rx="2.9" ry="2.1" />
        <ellipse className="pp" cx="55.6" cy="47.6" rx="2.9" ry="2.1" />
        <circle className="f" cx="44.8" cy="47.8" r="1.1" />
        <circle className="f" cx="55.2" cy="47.8" r="1.1" />
        <path className="ps" d="M40.4 43.2L47.6 44.6M59.6 43.2L52.4 44.6" strokeWidth="1.1" strokeLinecap="round" />
        <path className="pp" d="M50 49.6L48.2 53.6H51.8Z" />
        <path className="pp" d="M42 56Q50 62 58 56Q50 58.2 42 56Z" />
        <path className="f" d="M45 56.6L46.2 59L47.4 57ZM52.6 57L53.8 59L55 56.6Z" />
      </g>
    </>
  )
}

function PiedraDelSol() {
  const cells: ReactNode[] = []
  for (let k = 0; k < 20; k++) {
    const a = k * 18
    const [x, y] = polar(50, 50, 39.6, a)
    cells.push(
      <g key={k} transform={`translate(${f(x)} ${f(y)}) rotate(${a + 90})`}>
        <rect className="f" x="-2.7" y="-3" width="5.4" height="6" rx=".9" />
        <circle className="pp" cx="0" cy="-.3" r=".95" />
      </g>,
    )
  }
  const rays: ReactNode[] = []
  for (let k = 0; k < 16; k++) {
    const a = k * 22.5 + 11.25
    const long = k % 2 === 0
    const w = long ? 6 : 4.4
    rays.push(<polygon key={k} className="f" points={`${pt(polar(50, 50, 15.2, a - w))} ${pt(polar(50, 50, long ? 24 : 20.4, a))} ${pt(polar(50, 50, 15.2, a + w))}`} />)
  }
  return (
    <>
      <Ring r={47} w={3} />
      <Ring r={43.7} w={1} />
      {cells}
      <Ring r={35.4} w={1} />
      <Ring r={32.2} w={1} />
      {rays}
      <circle className="f" cx="37.2" cy="50" r="1.9" />
      <circle className="f" cx="62.8" cy="50" r="1.9" />
      <Ring r={13.4} w={1.7} />
      <path className="f" d="M39.6 40.4H60.4V43.4H39.6Z" />
      <rect className="f" x="42.6" y="45.4" width="5.2" height="3.6" rx="1.1" />
      <rect className="f" x="52.2" y="45.4" width="5.2" height="3.6" rx="1.1" />
      <path className="f" d="M50 47.8L47.4 53.4H52.6Z" />
      <path className="f" d="M42.4 55.4Q50 61.2 57.6 55.4Q50 57.8 42.4 55.4Z" />
      <path className="f" d="M48.4 57.6L50 63.4L51.6 57.6Z" />
    </>
  )
}

function Dragon() {
  const N = 170
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const u = i / N
    const a = lerp(205, -85, u)
    const r = lerp(30, 24.5, u)
    const [x, y] = polar(50, 50, r, a)
    return { u, a, r, x, y, w: Math.max(0.7, 7.4 * Math.pow(1 - u, 0.85)) }
  })
  const head = pts[0]
  const claws = [0.3, 0.52, 0.72].map((u) => {
    const p = pts[Math.round(u * N)]
    const [x1, y1] = polar(50, 50, p.r - p.w * 0.6, p.a)
    const [x2, y2] = polar(50, 50, p.r - p.w - 4, p.a + 9)
    return `M${pt([x1, y1])}L${pt([x2, y2])}`
  })
  return (
    <>
      <Ring r={47} w={3} />
      <Ring r={43.6} w={1} />
      {Array.from({ length: 7 }, (_, k) => {
        const a = k * (360 / 7) - 90
        return <path key={k} className="f" d={`M${pt(polar(50, 50, 7.4, a))}Q${pt(polar(50, 50, 11.6, a + 10))} ${pt(polar(50, 50, 7.4, a + 24))}Z`} />
      })}
      <circle className="f" cx="50" cy="50" r="6.2" />
      <circle className="pp" cx="48" cy="48" r="1.7" />
      {pts.map((p, i) => (
        <circle key={i} className="f" cx={f(p.x)} cy={f(p.y)} r={f(p.w)} />
      ))}
      {pts.map((p, i) => {
        if (i % 14 !== 6 || p.u > 0.9) return null
        return <polygon key={`s${i}`} className="f" points={`${pt(polar(50, 50, p.r + p.w * 0.6, p.a + 4))} ${pt(polar(50, 50, p.r + p.w + 2.2, p.a))} ${pt(polar(50, 50, p.r + p.w * 0.6, p.a - 4))}`} />
      })}
      {pts.map((p, i) => (i % 9 === 3 && p.u > 0.08 && p.u < 0.85 ? <circle key={`d${i}`} className="pp" cx={f(p.x)} cy={f(p.y)} r={f(Math.max(0.5, p.w * 0.2))} /> : null))}
      <path className="o" d={claws.join('')} strokeWidth="1.2" strokeLinecap="round" />
      <g transform={`translate(${f(head.x)} ${f(head.y)}) rotate(-38) scale(1.05)`}>
        <path className="f" d="M-5 -4.8Q0 -7 6 -4.2Q13 -3.6 16.4 -1.4Q17.4 0.4 15.4 1.6L7.6 2.6Q10 3.8 15.6 3.4Q13.6 6.8 5.4 6.4Q-2 7 -5 3.2Z" />
        <path className="o" d="M-2 -4.6Q-7.5 -10.4 -14.6 -8.4M0.6 -5Q-2.6 -9.4 -8.4 -10.8" strokeWidth="1.8" strokeLinecap="round" />
        <path className="o" d="M-4.4 -1Q-11.6 -3.2 -16.4 1.2M-4.4 2Q-10.6 3.2 -14.6 8.6M-3.4 4.4Q-7.6 8.6 -9.4 12.6" strokeWidth="1.5" strokeLinecap="round" />
        <path className="o" d="M14.4 0Q22 -3.4 25 3Q26 6.4 22.6 8.4M13.4 2.2Q20 5.4 19.6 11" strokeWidth="1.1" strokeLinecap="round" />
        <circle className="pp" cx="3.2" cy="-1.3" r="1.9" />
        <circle className="f" cx="3.7" cy="-1.3" r=".9" />
      </g>
    </>
  )
}

function Mjolnir() {
  const runes: [string, number, number][] = [
    ['M2 14V0M2 4.5L9 0.5M2 9L9 5', 21, 33],
    ['M2 14V0M2 0L8 5V14', 21, 48],
    ['M2 0V14M2 1.5L8 5.5M2 6.5L8 10.5', 21, 63],
    ['M5 0V14M1.5 4L5 0.5L8.5 4', 79, 33],
    ['M2 0V14M2 1L8 4.5L2 8L8 13', 79, 48],
    ['M2 0V14M8 0V14M2 4.5L8 9.5', 79, 63],
  ]
  return (
    <>
      <polygon className="o" points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" strokeWidth="3" strokeLinejoin="round" />
      {runes.map(([d, x, y], i) => (
        <path key={i} className="o" transform={`translate(${x} ${y}) scale(.95) translate(-5 -7)`} d={d} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path className="f" d="M34.5 25H65.5L67.5 27.2V36.8L65.5 39H34.5L32.5 36.8V27.2Z" />
      <path className="ps" d="M37 32H63M45 27.4V36.6M55 27.4V36.6" strokeWidth=".9" />
      <path className="f" d="M47.4 39H52.6V70H47.4Z" />
      {[46, 52, 58, 64].map((y) => (
        <path key={y} className="ps" d="M47.6 0H52.4" transform={`translate(0 ${y})`} strokeWidth="1" />
      ))}
      <circle className="o" cx="50" cy="75" r="3.4" strokeWidth="1.5" />
    </>
  )
}

function OjoDeHorus() {
  return (
    <>
      <rect className="o" x="21" y="3" width="58" height="94" rx="25" strokeWidth="3" />
      <rect className="o" x="26.5" y="8.5" width="47" height="83" rx="20" strokeWidth="1" />
      <g transform="translate(50 50) scale(1.1) translate(-50 -50)">
        <path className="o" d="M30.5 33Q50 23.4 70 33" strokeWidth="2.6" strokeLinecap="round" />
        <path className="o" d="M28.5 44Q39 36 51 36Q63 36 71.5 42.6Q62.5 53.6 50 53.6Q37 53.6 28.5 44Z" strokeWidth="2" strokeLinejoin="round" />
        <circle className="f" cx="52" cy="44.6" r="5.6" />
        <circle className="pp" cx="50.2" cy="42.8" r="1.5" />
        <path className="o" d="M43 53.6V63Q43 67 38 67" strokeWidth="2.2" strokeLinecap="round" />
        <path className="o" d="M58 52.8Q65.5 57.4 68 64.4Q69.4 70.4 64 71.4Q60 72 59.4 67.8" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </>
  )
}

const EMBLEMS: Record<CultureKey, () => ReactNode> = {
  nordica: Mjolnir,
  griega: Medusa,
  mexicana: PiedraDelSol,
  china: Dragon,
  egipcia: OjoDeHorus,
}

/** The emblem of a culture in the colour of its ink (`--culture-ink`, set by the passport) with paper cut-outs. */
export default function CultureEmblem({ culture, size = 120, className = '' }: { culture: CultureKey; size?: number; className?: string }) {
  const Emblem = EMBLEMS[culture]
  return (
    <svg className={`emblem ${className}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Emblema ${culture}`}>
      <Emblem />
    </svg>
  )
}

const RUNE_PATHS = ['M2 14V0M2 4.5L9 0.5M2 9L9 5', 'M2 14V0M2 0L8 5V14', 'M2 0V14M2 3.5L8 7L2 10.5', 'M2 0V14M2 1.5L8 5.5M2 6.5L8 10.5', 'M2 0V14M2 1L8 4.5L2 8L8 13', 'M8 2L3 7L8 12', 'M1.5 1.5L8.5 12.5M8.5 1.5L1.5 12.5', 'M2 0V14M2 1.5L8 4.5L2 7.5', 'M2 0V14M8 0V14M2 4.5L8 9.5', 'M5 0V14M2 5L8 9', 'M5 0V14', 'M5 0V14M1.5 4L5 0.5L8.5 4']

/** The repeated border of a page: greca, runes, steps, clouds or lotus. Tileable, one colour. */
export function CultureOrnament({ culture, height = 14 }: { culture: CultureKey; height?: number }) {
  const id = useId().replace(/:/g, '')
  const h = height
  let width = 24
  let unit: ReactNode
  if (culture === 'griega') {
    width = h * 2.2
    unit = <path className="o" d={`M0 ${h * 0.9}V${h * 0.1}H${h * 1.1}V${h * 0.62}H${h * 0.42}V${h * 0.36}`} strokeWidth="1.3" />
  } else if (culture === 'nordica') {
    const k = (h * 0.9) / 14
    width = RUNE_PATHS.length * 12
    unit = (
      <>
        {RUNE_PATHS.map((d, i) => (
          <path key={i} className="o" transform={`translate(${i * 12 + 1} ${h * 0.05}) scale(${k})`} d={d} strokeWidth={1.6 / k} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </>
    )
  } else if (culture === 'mexicana') {
    width = h * 2.8
    const q = (h * 2.2) / 6
    const t = h / 3
    unit = <path className="f" d={`M0 ${h}V${2 * t}H${q}V${t}H${2 * q}V0H${4 * q}V${t}H${5 * q}V${2 * t}H${6 * q}V${h}Z`} />
  } else if (culture === 'china') {
    width = h * 2.6
    unit = (
      <>
        <path className="o" d={`M0 ${h * 0.7}Q${h * 0.5} ${h * 0.1} ${h} ${h * 0.7}T${h * 2} ${h * 0.7}`} strokeWidth="1.3" strokeLinecap="round" />
        <circle className="f" cx={h * 1.3} cy={h * 0.35} r={h * 0.12} />
      </>
    )
  } else {
    width = h * 1.6
    unit = (
      <>
        <path className="f" d={`M${h * 0.8} ${h}Q${h * 0.25} ${h * 0.55} ${h * 0.8} 0Q${h * 1.35} ${h * 0.55} ${h * 0.8} ${h}Z`} />
        <path className="o" d={`M0 ${h}H${h * 1.6}`} strokeWidth="1" />
      </>
    )
  }
  return (
    <svg className="ornament" width="100%" height={h} role="presentation" aria-hidden="true">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={h}>
          {unit}
        </pattern>
      </defs>
      <rect width="100%" height={h} fill={`url(#${id})`} />
    </svg>
  )
}
