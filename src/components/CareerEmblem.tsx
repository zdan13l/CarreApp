import type { ReactNode } from 'react'

// The mark of each career on the identity page of the passport (the DNI of the induction): it belongs to the person for their whole life
// in the induction, so it never changes with the theme of an induction. Five marks, because some careers share one:
//   sistemas   code brackets and a circuit      tronicas   a chip with a bolt (Mecatrónica, Redes, Electrónica)
//   industrial a gear                            biomec     a DNA helix (Bioingeniería, Mecánica)
//   civil      a bridge
// One ink (`color`) with the paper colour for the cut-outs, like the stamps.
export type CareerKey = 'sistemas' | 'tronicas' | 'industrial' | 'biomec' | 'civil' | 'general'

const plain = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Which of the marks a career gets, from its name. */
export function careerKey(career: string): CareerKey {
  const c = plain(career)
  if (/sistemas|computaci|software|informatica/.test(c)) return 'sistemas'
  if (/mecatr|redes|electr|telecom|tronic/.test(c)) return 'tronicas'
  if (/industrial/.test(c)) return 'industrial'
  if (/bioing|biom|mecanica/.test(c)) return 'biomec'
  if (/civil/.test(c)) return 'civil'
  return 'general'
}

const rad = (d: number) => (d * Math.PI) / 180

function Sistemas() {
  return (
    <>
      <path className="o" d="M36 34L20 50L36 66M64 34L80 50L64 66" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="o" d="M56 28L44 72" strokeWidth="5" strokeLinecap="round" />
      <circle className="f" cx="22" cy="28" r="2.6" />
      <circle className="f" cx="78" cy="72" r="2.6" />
      <path className="o" d="M22 31V40M78 69V60" strokeWidth="1.6" strokeLinecap="round" />
    </>
  )
}

function Tronicas() {
  const pins: ReactNode[] = []
  for (let i = 0; i < 4; i++) {
    const p = 38 + i * 8
    pins.push(<path key={i} className="o" d={`M${p} 26V34M${p} 66V74M26 ${p}H34M66 ${p}H74`} strokeWidth="3" strokeLinecap="round" />)
  }
  return (
    <>
      {pins}
      <rect className="f" x="34" y="34" width="32" height="32" rx="4" />
      <path className="pp" d="M53 38L42 53H49L46 62L59 46H51Z" />
    </>
  )
}

function Industrial() {
  const teeth: ReactNode[] = []
  for (let i = 0; i < 10; i++) teeth.push(<rect key={i} className="f" x="45" y="16" width="10" height="14" rx="2" transform={`rotate(${i * 36} 50 50)`} />)
  return (
    <>
      {teeth}
      <circle className="f" cx="50" cy="50" r="26" />
      <circle className="pp" cx="50" cy="50" r="10" />
      <path className="ps" d="M50 30V36M50 64V70M30 50H36M64 50H70" strokeWidth="2" strokeLinecap="round" />
    </>
  )
}

function Biomec() {
  const a: string[] = []
  const b: string[] = []
  const rungs: ReactNode[] = []
  for (let i = 0; i <= 24; i++) {
    const y = 18 + i * 2.8
    const x = 50 + 17 * Math.sin(rad(i * 30))
    a.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    b.push(`${i ? 'L' : 'M'}${(100 - x).toFixed(1)} ${y.toFixed(1)}`)
    if (i % 3 === 0 && i > 0 && i < 24) rungs.push(<path key={i} className="o" d={`M${x.toFixed(1)} ${y.toFixed(1)}H${(100 - x).toFixed(1)}`} strokeWidth="2.4" strokeLinecap="round" />)
  }
  return (
    <>
      {rungs}
      <path className="o" d={a.join('')} strokeWidth="4.4" strokeLinecap="round" />
      <path className="o" d={b.join('')} strokeWidth="4.4" strokeLinecap="round" />
    </>
  )
}

function Civil() {
  const hangers: ReactNode[] = []
  for (let i = 0; i < 7; i++) {
    const x = 28 + i * 7.3
    const y = 66 - 38 * Math.sin(((x - 22) / 56) * Math.PI) * 0.9
    hangers.push(<path key={i} className="o" d={`M${x} ${y.toFixed(1)}V62`} strokeWidth="1.8" />)
  }
  return (
    <>
      <path className="o" d="M22 66Q50 14 78 66" strokeWidth="4.4" strokeLinecap="round" />
      {hangers}
      <path className="f" d="M12 62H88V68H12Z" />
      <path className="f" d="M22 68V82H30V68ZM70 68V82H78V68Z" />
      <path className="o" d="M8 82H92" strokeWidth="2.4" strokeLinecap="round" />
    </>
  )
}

function General() {
  return (
    <>
      <path className="f" d="M50 20L60 42L84 44L66 60L72 84L50 71L28 84L34 60L16 44L40 42Z" />
    </>
  )
}

const MARKS: Record<CareerKey, () => ReactNode> = { sistemas: Sistemas, tronicas: Tronicas, industrial: Industrial, biomec: Biomec, civil: Civil, general: General }

/** The mark of a career in two rings, in the colour set by `color`. */
export default function CareerEmblem({ career, size = 96, className = '' }: { career: string; size?: number; className?: string }) {
  const Mark = MARKS[careerKey(career)]
  return (
    <svg className={`emblem career-emblem ${className}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Símbolo de ${career}`}>
      <circle className="o" cx="50" cy="50" r="47" strokeWidth="3" />
      <circle className="o" cx="50" cy="50" r="43.6" strokeWidth="1" />
      <g transform="translate(50 50) scale(.78) translate(-50 -50)">
        <Mark />
      </g>
    </svg>
  )
}
