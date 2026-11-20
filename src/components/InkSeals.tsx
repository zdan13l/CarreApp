import { useId, type ReactNode } from 'react'
import { FRAMES, assetUrl, type InkSource, type MythSeal } from '../lib/seals'

// Seals made from a picture turned into one ink, and the seals with a silhouette of their own (a shield, an oval, an arch…).
// Everything is drawn with the ink of the page (`currentColor` / `--stamp-ink`) and the paper colour for the cut-outs, so it follows the
// theme; the golden ones use the foil gradient of the design system.
const PAPER = 'var(--seal-paper, var(--surface))'
const rad = (d: number) => (d * Math.PI) / 180

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A picture that is already ink (white where there is ink, transparent elsewhere) inside `box`, printed in `fill` (default the stamp's ink). */
export function InkPicture({ source, box, fill = 'var(--stamp-ink, currentColor)' }: { source: InkSource; box: [number, number, number, number]; fill?: string }) {
  const uid = useId().replace(/:/g, '')
  const [x, y, w, h] = box
  return (
    <>
      <defs>
        <mask id={`pm${uid}`} maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <image href={assetUrl(source.file)} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
        </mask>
      </defs>
      <rect x={x} y={y} width={w} height={h} mask={`url(#pm${uid})`} style={{ fill }} stroke="none" />
    </>
  )
}

/** Pegasus has no wings in its picture: a fan of feathers is drawn over its back. */
function PegasusWings() {
  const feathers = Array.from({ length: 8 }, (_, k) => {
    const t = k / 7
    const a = -122 + t * 82
    const len = 14 + (30 - 14) * Math.sin(t * Math.PI * 0.9 + 0.3)
    return (
      <path key={k} transform={`translate(51 37) rotate(${a.toFixed(1)})`} d={`M0 0Q${(len / 2).toFixed(1)} -4 ${len.toFixed(1)} 0Q${(len / 2).toFixed(1)} 4 0 0Z`} />
    )
  })
  return <g style={{ fill: 'var(--stamp-ink, currentColor)' }}>{feathers}</g>
}

/** The picture of a mythology seal inside its silhouette, in the 100 x 100 box of a stamp. */
export function MythPicture({ seal }: { seal: MythSeal }) {
  const uid = useId().replace(/:/g, '')
  const frame = FRAMES[seal.frame]
  const picture = <InkPicture source={seal} box={frame.box} />
  return (
    <>
      {seal.frame !== 'medal' && (
        <>
          <defs>
            <clipPath id={`mc${uid}`}>
              <path d={frame.inner} />
            </clipPath>
          </defs>
          <path d={frame.outer} fill="none" strokeWidth="3" strokeLinejoin="round" />
          <path d={frame.inner} fill="none" strokeWidth=".8" strokeLinejoin="round" />
          <g clipPath={`url(#mc${uid})`}>
            {picture}
            {seal.wings && <PegasusWings />}
          </g>
        </>
      )}
      {seal.frame === 'medal' && picture}
    </>
  )
}

// ---------- the seals with a silhouette of their own (200 x 200) ----------
export type ShapeKind = 'shield' | 'oval' | 'arch' | 'ticket' | 'block' | 'spool'
export type ShapeArt = 'vest' | 'butterfly' | 'spool'

function Vest({ c }: { c: string }) {
  return (
    <>
      <path fill={c} d="M31 20L43 20L50 37L57 20L69 20L77 34L72 50L74 82L50 89L26 82L28 50L23 34Z" />
      <path fill="none" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M50 37V87M28 50Q33 44 31 34M72 50Q67 44 69 34" />
      {[48, 59, 70].map((y) => (
        <circle key={y} cx="55" cy={y} r="2.5" fill={PAPER} />
      ))}
      <path fill="none" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" d="M30 66H41M61 70H70" />
    </>
  )
}

function Butterfly({ wing, body, cut }: { wing: string; body: string; cut: string }) {
  return (
    <g transform="rotate(-8 50 50)">
      <path d="M31 53C24 46 18 40 14 34M33 51C28 42 24 36 21 32" fill="none" stroke={body} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="34" r="1.8" fill={body} />
      <circle cx="21" cy="32" r="1.8" fill={body} />
      <path d="M30 56C28 54 29 50 32 50C35 51 36 54 35 58L37 78C37 80 34 80 34 78Z" fill={body} />
      <path d="M34 58C50 60 72 60 78 66C80 78 64 86 52 78C42 72 36 66 34 58Z" fill={wing} />
      <path d="M33 55C36 38 52 20 68 22C84 24 86 44 80 54C72 62 50 62 33 55Z" fill={wing} />
      <path d="M36 56C48 46 60 38 74 34M36 57C52 54 66 50 80 50M38 60C52 66 64 70 70 76" fill="none" stroke={cut} strokeWidth="1.2" strokeLinecap="round" />
      {[[60, 27, 5.5, -20], [69, 30, 4.4, -10], [51, 33, 3.6, -30], [77, 38, 3, 0]].map(([x, y, rx, a]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx={rx} ry="2" transform={`rotate(${a} ${x} ${y})`} fill={cut} />
      ))}
      <circle cx="60" cy="72" r="2" fill={cut} />
      <circle cx="52" cy="70" r="1.4" fill={cut} />
    </g>
  )
}

function SpoolT({ c }: { c: string }) {
  return (
    <>
      <rect x="35" y="29" width="30" height="42" fill={c} />
      <path d="M35 36L65 31M35 44L65 39M35 52L65 47M35 60L65 55M35 68L65 63" stroke={PAPER} strokeWidth="1.2" opacity=".75" />
      <path fill={PAPER} d="M40 36H60V43H53.6V64H46.4V43H40Z" />
    </>
  )
}

const T = ({ x, y, size, children, spacing = 1.2, mono = false }: { x: number; y: number; size: number; children: ReactNode; spacing?: number; mono?: boolean }) => (
  <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={mono ? 700 : 800} letterSpacing={spacing} className={mono ? 'stamp-mono' : 'stamp-text'} stroke="none">
    {children}
  </text>
)

export default function ShapeSeal({
  kind,
  ink = 1,
  gold = false,
  size = 120,
  tilt = 0,
  label,
  top = '',
  bottom = '',
  lines = [],
  art,
  source,
}: {
  kind: ShapeKind
  ink?: 1 | 2 | 3 | 4 | 5
  gold?: boolean // the coordinator: the same seal in gold foil
  size?: number
  tilt?: number
  label: string
  top?: string // shield and oval: the word above the drawing
  bottom?: string
  lines?: string[] // oval: the words under the drawing
  art?: ShapeArt
  source?: InkSource // arch, ticket and block: the picture that goes inside
}) {
  const uid = useId().replace(/:/g, '')
  const c = gold ? `url(#sg${uid})` : 'currentColor'
  const drawing = (cx: number, cy: number, scale: number) => (
    <g transform={`translate(${cx} ${cy}) scale(${scale}) translate(-50 -50)`}>
      {art === 'vest' && <Vest c={c} />}
      {art === 'butterfly' &&
        (gold ? <Butterfly wing={c} body={c} cut={PAPER} /> : <Butterfly wing={`url(#sw${uid})`} body="var(--ink-4)" cut={PAPER} />)}
      {art === 'spool' && <SpoolT c={c} />}
    </g>
  )
  let body: ReactNode
  if (kind === 'shield') {
    const d = 'M30 16H170V102C170 150 138 176 100 194C62 176 30 150 30 102Z'
    body = (
      <>
        <path d={d} fill="none" stroke={c} strokeWidth="6" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={c} strokeWidth="1.6" transform="translate(100 105) scale(.9) translate(-100 -105)" />
        <g fill={c}><T x={100} y={40} size={13} spacing={3}>{top}</T></g>
        {drawing(100, 86, 0.8)}
        <rect x="60" y="138" width="80" height="16" rx="3" fill={c} />
        <text x="100" y="149.6" textAnchor="middle" fontSize="8.6" fontWeight="800" letterSpacing="1.2" className="stamp-text" stroke="none" style={{ fill: PAPER }}>{bottom}</text>
        {gold && [0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${64 + i * 18} 12l2 -7 2 7z`} fill={c} />)}
      </>
    )
  } else if (kind === 'oval') {
    body = (
      <>
        <ellipse cx="100" cy="100" rx="76" ry="96" fill="none" stroke={c} strokeWidth="6" />
        <ellipse cx="100" cy="100" rx="68" ry="88" fill="none" stroke={c} strokeWidth="1.6" />
        <g fill={c}><T x={100} y={32} size={13} spacing={4}>{top}</T></g>
        {drawing(100, 82, 0.9)}
        <path d="M72 138H128" stroke={c} strokeWidth="1.4" />
        <g fill={c}>{lines.map((l, i) => <T key={l} x={100} y={148 + i * 11.5} size={8.4}>{l}</T>)}</g>
        {gold && Array.from({ length: 16 }, (_, k) => {
          const a = (k * 360) / 16 + 11
          return <circle key={k} cx={(100 + 100 * Math.cos(rad(a))).toFixed(1)} cy={(100 + 126 * Math.sin(rad(a))).toFixed(1)} r="2.4" fill={c} />
        })}
      </>
    )
  } else if (kind === 'arch') {
    body = (
      <>
        <defs><clipPath id={`sc${uid}`}><path d="M33 168V100A67 67 0 0 1 167 100V168Z" /></clipPath></defs>
        <path d="M24 196V100A76 76 0 0 1 176 100V196Z" fill="none" stroke={c} strokeWidth="6" strokeLinejoin="round" />
        <path d="M33 188V100A67 67 0 0 1 167 100V188Z" fill="none" stroke={c} strokeWidth="1.4" />
        <g clipPath={`url(#sc${uid})`}>{source && <InkPicture source={source} box={[36, 40, 128, 128]} fill={c} />}</g>
        <g fill={c}><T x={100} y={180} size={7} mono spacing={2}>GENERACIÓN</T><T x={100} y={194} size={12} spacing={1.6}>{bottom}</T></g>
      </>
    )
  } else if (kind === 'ticket') {
    const d = 'M34 42H166A28 28 0 0 0 194 70V130A28 28 0 0 0 166 158H34A28 28 0 0 0 6 130V70A28 28 0 0 0 34 42Z'
    body = (
      <>
        <defs><clipPath id={`sc${uid}`}><rect x="26" y="52" width="148" height="72" rx="6" /></clipPath></defs>
        <path d={d} fill="none" stroke={c} strokeWidth="6" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={c} strokeWidth="1.4" transform="translate(100 100) scale(.93 .86) translate(-100 -100)" />
        <g clipPath={`url(#sc${uid})`}>{source && <InkPicture source={source} box={[26, 52, 148, 72]} fill={c} />}</g>
        <g fill={c}><T x={100} y={138} size={7} mono spacing={2}>GENERACIÓN</T><T x={100} y={150} size={11} spacing={1.6}>{bottom}</T></g>
      </>
    )
  } else if (kind === 'block') {
    body = (
      <>
        <defs><clipPath id={`sc${uid}`}><rect x="50" y="56" width="100" height="90" /></clipPath></defs>
        <rect x="22" y="22" width="156" height="156" rx="22" fill="none" stroke={c} strokeWidth="6" />
        <rect x="31" y="31" width="138" height="138" rx="14" fill="none" stroke={c} strokeWidth="1.4" />
        {[[38, 38], [162, 38], [38, 162], [162, 162]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill={c} />)}
        <g clipPath={`url(#sc${uid})`}>{source && <InkPicture source={source} box={[50, 56, 100, 90]} fill={c} />}</g>
        <g fill={c}><T x={100} y={50} size={7.4} mono spacing={2}>GENERACIÓN</T><T x={100} y={164} size={9} spacing={0.6}>{bottom}</T></g>
      </>
    )
  } else {
    const d = 'M48 12H152Q160 12 160 20V34Q160 42 152 42H138V158H152Q160 158 160 166V180Q160 188 152 188H48Q40 188 40 180V166Q40 158 48 158H62V42H48Q40 42 40 34V20Q40 12 48 12Z'
    body = (
      <>
        <path d={d} fill="none" stroke={c} strokeWidth="6" strokeLinejoin="round" />
        <g fill={c}><T x={100} y={32} size={8} mono spacing={2}>GENERACIÓN</T><T x={100} y={177} size={13} spacing={3}>{bottom}</T></g>
        {drawing(100, 100, 0.78)}
        <path d="M62 70Q50 74 40 70M138 130Q150 126 160 130" stroke={c} strokeWidth="1.4" fill="none" />
      </>
    )
  }
  return (
    <span className={`seal shape-seal ink-${ink}${gold ? ' gold' : ''}`} style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={label}>
      <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`sg${uid}`} gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="190" y2="190">
            <stop offset="0" style={{ stopColor: 'var(--foil-a)' }} />
            <stop offset=".36" style={{ stopColor: 'var(--foil-b)' }} />
            <stop offset=".58" style={{ stopColor: 'var(--foil-c)' }} />
            <stop offset="1" style={{ stopColor: 'var(--foil-d)' }} />
          </linearGradient>
          <linearGradient id={`sw${uid}`} gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="85" y2="85">
            <stop offset="0" style={{ stopColor: 'var(--ink-4)' }} />
            <stop offset=".55" style={{ stopColor: 'var(--ink-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ink-3)' }} />
          </linearGradient>
          <filter id={`sf${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={hash(label) % 90} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="s" />
            <feComposite in="SourceGraphic" in2="s" operator="in" />
          </filter>
        </defs>
        <g filter={gold ? undefined : `url(#sf${uid})`} style={{ ['--stamp-ink' as string]: gold ? `url(#sg${uid})` : 'currentColor' }}>
          {body}
        </g>
      </svg>
    </span>
  )
}
