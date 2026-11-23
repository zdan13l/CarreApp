import { useId, type ReactNode } from 'react'
import type { CultureKey } from '../lib/themes'

// What marks the culture a person got ("te tocó"): a drawing of the place of that culture (a longship, a temple, a pyramid, a pagoda,
// the pyramids with the sun) and the border ornament of its pages. They are NOT the figures of the stamps of the bases (those are gods
// and creatures: Mjölnir, Medusa, the dragon…), so a culture's mark and a base's stamp never look alike. One colour (the culture's
// ink) with the paper colour for the cut-outs, like the stamps of the passport.
const rad = (d: number) => (d * Math.PI) / 180
const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]

const Ring = ({ r, w }: { r: number; w: number }) => <circle className="o" cx="50" cy="50" r={r} strokeWidth={w} />

function Drakkar() {
  const stripes = [34, 42, 50, 58].map((x) => <rect key={x} className="f" x={x} y="27" width="8" height="24" />)
  return (
    <>
      {stripes}
      <path className="o" d="M32 26.5H68M50 26.5V60" strokeWidth="2.2" strokeLinecap="round" />
      <path className="f" d="M16 52C20 68 34 74 50 74C66 74 80 68 84 52C70 61 30 61 16 52Z" />
      <path className="o" d="M17 52Q9 42 15 31M83 52Q91 44 86 35" strokeWidth="3" strokeLinecap="round" />
      <path className="f" d="M15 31L9 27L11 34Z" />
      <circle className="pp" cx="14" cy="31.2" r="1" />
      {[30, 40, 50, 60, 70].map((x) => (
        <g key={x}>
          <circle className="pp" cx={x} cy="64.4" r="3.1" />
          <circle className="o" cx={x} cy="64.4" r="3.1" strokeWidth="1" />
          <circle className="f" cx={x} cy="64.4" r="1" />
        </g>
      ))}
      <path className="o" d="M14 82q4.4 -5 8.8 0t8.8 0t8.8 0t8.8 0t8.8 0t8.8 0t8.8 0t8.8 0" strokeWidth="1.8" strokeLinecap="round" />
    </>
  )
}

function Templo() {
  return (
    <>
      <path className="f" d="M16 41L50 21L84 41Z" />
      <path className="pp" d="M28 38L50 25.4L72 38Z" />
      <circle className="f" cx="50" cy="33" r="3" />
      <rect className="f" x="19" y="42.5" width="62" height="5" />
      {[22, 34.5, 47, 59.5, 72].map((x) => (
        <g key={x}>
          <rect className="f" x={x - 1.2} y="49" width="8.4" height="2.6" />
          <rect className="f" x={x} y="51.6" width="6" height="16" />
          <path className="ps" d={`M${x + 2} 52.6V67M${x + 4} 52.6V67`} strokeWidth=".7" />
        </g>
      ))}
      <rect className="f" x="15" y="68" width="70" height="4" />
      <rect className="f" x="11" y="72.4" width="78" height="4" />
    </>
  )
}

function Piramide() {
  return (
    <>
      <rect className="f" x="14" y="62" width="72" height="9" />
      <rect className="f" x="22" y="53" width="56" height="9" />
      <rect className="f" x="30" y="44" width="40" height="9" />
      <rect className="f" x="38" y="35" width="24" height="9" />
      <path className="f" d="M41 35V25H59V35Z" />
      <rect className="pp" x="46" y="28" width="8" height="7" />
      <path className="ps" d="M46 71V44M54 71V44M46 66.6H54M46 57.6H54M46 48.6H54" strokeWidth="1.4" />
      <path className="o" d="M20 74H80" strokeWidth="2" strokeLinecap="round" />
      <circle className="f" cx="76" cy="26" r="5" />
      <path className="o" d="M76 17V19.6M76 32.4V35M67 26H69.6M82.4 26H85M69.6 19.6L71.4 21.4M80.6 30.6L82.4 32.4M82.4 19.6L80.6 21.4M71.4 30.6L69.6 32.4" strokeWidth="1.4" strokeLinecap="round" />
    </>
  )
}

function Pagoda() {
  const tier = (cx: number, w: number, y: number, key: string) => (
    <g key={key}>
      <path className="f" d={`M${cx - w - 5} ${y - 3}Q${cx - w + 2} ${y} ${cx - w} ${y - 1}Q${cx} ${y - 9} ${cx + w} ${y - 1}Q${cx + w - 2} ${y} ${cx + w + 5} ${y - 3}L${cx + w - 2} ${y + 4}H${cx - w + 2}Z`} />
      <rect className="f" x={cx - w + 5} y={y + 4} width={(w - 5) * 2} height="8" />
      <rect className="pp" x={cx - 2} y={y + 6} width="4" height="6" />
    </g>
  )
  return (
    <>
      <path className="o" d="M50 14V24" strokeWidth="1.8" strokeLinecap="round" />
      <circle className="f" cx="50" cy="19" r="2" />
      {tier(50, 12, 32, 't3')}
      {tier(50, 21, 49, 't2')}
      {tier(50, 30, 66, 't1')}
      <rect className="f" x="18" y="78.6" width="64" height="4" />
      <circle className="o" cx="26" cy="26" r="6" strokeWidth="1.6" />
    </>
  )
}

function Piramides() {
  return (
    <>
      <path className="f" d="M76 44L94 72H58Z" />
      <path className="o" d="M50 24L82 72H18Z" strokeWidth="2.6" strokeLinejoin="round" />
      <path className="f" d="M50 24L82 72H50Z" />
      <path className="ps" d="M50 24V72" strokeWidth="1.2" />
      <path className="o" d="M8 72H92" strokeWidth="2" strokeLinecap="round" />
      <circle className="f" cx="24" cy="30" r="7" />
      {Array.from({ length: 12 }, (_, k) => {
        const a = k * 30
        const [x1, y1] = polar(24, 30, 9.6, a)
        const [x2, y2] = polar(24, 30, 12.6, a)
        return <path key={k} className="o" d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} strokeWidth="1.4" strokeLinecap="round" />
      })}
    </>
  )
}

// the neutral mark: a theme this version does not know yet
function Estrella() {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const [x, y] = polar(50, 50, i % 2 ? 11 : 30, -90 + i * 22.5)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <>
      <polygon className="f" points={pts} />
      <circle className="pp" cx="50" cy="50" r="4.4" />
    </>
  )
}

const ICONS: Record<CultureKey, () => ReactNode> = {
  general: Estrella,
  nordica: Drakkar,
  griega: Templo,
  mexicana: Piramide,
  china: Pagoda,
  egipcia: Piramides,
}

/** The drawing of the culture alone (inside a 100 x 100 box, within a circle of radius 40). */
export function CultureIcon({ culture }: { culture: CultureKey }) {
  const Icon = ICONS[culture] ?? Estrella // a culture the coordinator added has no drawing of its own yet
  return <Icon />
}

/** The mark of a culture in the colour of its ink (`--culture-ink`, set by the passport): two rings and its drawing. */
export default function CultureEmblem({ culture, size = 120, className = '' }: { culture: CultureKey; size?: number; className?: string }) {
  return (
    <svg className={`emblem ${className}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Cultura ${culture}`}>
      <Ring r={47} w={3} />
      <Ring r={43.6} w={1} />
      <g transform="translate(50 50) scale(.9) translate(-50 -50)">
        <CultureIcon culture={culture} />
      </g>
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
  } else if (culture === 'general') {
    width = h * 1.2
    unit = <circle className="f" cx={h * 0.6} cy={h * 0.5} r={h * 0.14} />
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
