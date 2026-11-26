import { useId, type ReactNode } from 'react'
import { careerKey, type CareerKey } from './CareerEmblem'

// The plate of each career on the identity page (the DNI): an engraved plaque, not a stamp. A banknote guilloché behind a disc, a double gold
// edge and the drawing of the career in thick gold line. It is the same for a person for their whole life in the induction.
//   sistemas a desktop computer · tronicas a circuit board (Mecatrónica, Redes, Electrónica) · biomec a sprout growing out of a nut
//   (Bioingeniería, Mecánica) · civil a hard hat · industrial a factory
// The plate is always dark (navy and gold), in both themes; its colours are the --plate-* variables of index.css.
const L = (g: string, w = 5) => ({ fill: 'none', stroke: g, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })
const SOFT = (g: string, o = 0.18) => ({ fill: g, fillOpacity: o })

const ICON: Record<CareerKey, (g: string) => ReactNode> = {
  sistemas: (g) => (
    <>
      <rect x="16" y="16" width="68" height="48" rx="6" {...L(g)} {...SOFT(g, 0.14)} />
      <path d="M42 30L32 40L42 50M58 30L68 40L58 50M54 28L46 52" {...L(g, 4.4)} />
      <path d="M50 64V76M30 82H70" {...L(g, 5.4)} />
    </>
  ),
  tronicas: (g) => (
    <>
      <rect x="14" y="18" width="72" height="64" rx="6" {...L(g)} {...SOFT(g, 0.14)} />
      <rect x="36" y="38" width="28" height="28" rx="3" {...L(g)} {...SOFT(g, 0.3)} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${43 + i * 7} 38V30M${43 + i * 7} 66V74M36 ${45 + i * 7}H28M64 ${45 + i * 7}H72`} {...L(g, 3.2)} />
      ))}
      <path d="M14 34H24L30 40M86 68H76L70 62" {...L(g, 3.2)} />
      {[[30, 40], [70, 62]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="3" {...L(g, 2.6)} />
      ))}
    </>
  ),
  biomec: (g) => (
    <>
      <path d="M68 76L59 91H41L32 76L41 61H59Z" {...L(g)} {...SOFT(g, 0.3)} />
      <circle cx="50" cy="76" r="6.4" {...L(g, 4)} />
      <path d="M50 70V46" {...L(g)} />
      <path d="M50 56C38 56 31 49 30 38C42 38 49 45 50 56Z" {...L(g, 4.4)} {...SOFT(g, 0.3)} />
      <path d="M50 48C62 48 69 41 70 30C58 30 51 37 50 48Z" {...L(g, 4.4)} {...SOFT(g, 0.3)} />
    </>
  ),
  civil: (g) => (
    <>
      <path d="M16 64A34 34 0 0 1 84 64Z" {...L(g)} {...SOFT(g, 0.18)} />
      <path d="M12 64H88V70Q88 74 84 74H16Q12 74 12 70Z" {...L(g)} {...SOFT(g, 0.35)} />
      <path d="M42 30V64H58V30Z" {...L(g, 4.4)} {...SOFT(g, 0.35)} />
    </>
  ),
  industrial: (g) => (
    <>
      <path d="M12 82V50L34 62V50L56 62V50L76 62V28H88V82Z" {...L(g)} {...SOFT(g, 0.2)} />
      <path d="M12 82H88M24 72H30M44 72H50M64 72H70" {...L(g, 4)} />
      <path d="M78 22C78 16 84 18 84 12" {...L(g, 3)} />
    </>
  ),
  general: (g) => (
    <>
      <circle cx="50" cy="50" r="30" {...L(g)} {...SOFT(g, 0.14)} />
      <path d="M50 24L58 50L50 76L42 50Z" {...L(g, 4)} />
      <path d="M24 50H76" {...L(g, 4)} />
    </>
  ),
}

const NAME: Record<CareerKey, string> = { sistemas: 'SISTEMAS', tronicas: 'TRÓNICAS', industrial: 'INDUSTRIAL', biomec: 'BIOMEC', civil: 'CIVIL', general: 'INGENIERÍA' }
const SERIAL: Record<CareerKey, string> = { sistemas: '01/05', tronicas: '02/05', biomec: '03/05', civil: '04/05', industrial: '05/05', general: '00/05' }

export const CAREER_NAME = NAME

function Guilloche() {
  return (
    <g fill="none" stroke="var(--plate-line)" strokeWidth=".45">
      {Array.from({ length: 28 }, (_, i) => (
        <ellipse key={i} cx="95" cy="98" rx="70" ry="22" transform={`rotate(${(i * 180) / 28} 95 98)`} />
      ))}
      {[1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx="95" cy="98" r={i * 13} strokeWidth=".35" />
      ))}
    </g>
  )
}

export default function CareerPlate({ career, size = 110, className = '' }: { career: string; size?: number; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const key = careerKey(career)
  const gold = `url(#g${uid})`
  return (
    <span className={`career-plate ${className}`} style={{ width: size, height: size * (232 / 190) }} role="img" aria-label={`Placa de ${career || 'Ingeniería'}`}>
      <svg viewBox="0 0 190 232" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`g${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="190" y2="232">
            <stop offset="0" style={{ stopColor: 'var(--foil-a)' }} />
            <stop offset=".36" style={{ stopColor: 'var(--foil-b)' }} />
            <stop offset=".58" style={{ stopColor: 'var(--foil-c)' }} />
            <stop offset="1" style={{ stopColor: 'var(--foil-d)' }} />
          </linearGradient>
          <linearGradient id={`b${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--plate-a)' }} />
            <stop offset="1" style={{ stopColor: 'var(--plate-b)' }} />
          </linearGradient>
          <clipPath id={`c${uid}`}>
            <rect x="6" y="6" width="178" height="220" rx="18" />
          </clipPath>
        </defs>
        <rect x="1.5" y="1.5" width="187" height="229" rx="22" fill={`url(#b${uid})`} stroke={gold} strokeWidth="4" />
        <g clipPath={`url(#c${uid})`}>
          <Guilloche />
        </g>
        <rect x="9" y="9" width="172" height="214" rx="15" fill="none" stroke={gold} strokeWidth="1.6" />
        <rect x="14" y="14" width="162" height="204" rx="11" fill="none" stroke="var(--plate-line)" strokeWidth=".8" />
        <circle cx="95" cy="98" r="62" fill="var(--plate-disc)" stroke={gold} strokeWidth="3.2" />
        <circle cx="95" cy="98" r="56" fill="none" stroke={gold} strokeWidth="1" />
        <g transform="translate(53 56) scale(.84)">{ICON[key](gold)}</g>
        <path d="M40 180H150" stroke={gold} strokeWidth="1.4" />
        <path d="M92 177l3-3 3 3-3 3z" fill={gold} />
        <text x="95" y="199" textAnchor="middle" fontSize="13" fontWeight="800" letterSpacing="3.4" fill={gold} className="stamp-text">{NAME[key]}</text>
        <text x="95" y="213" textAnchor="middle" fontSize="6.4" letterSpacing="2.2" fill={gold} opacity=".85" className="stamp-mono">INGENIERÍA · {SERIAL[key]}</text>
      </svg>
    </span>
  )
}
