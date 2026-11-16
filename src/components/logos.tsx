import type { ReactNode } from 'react'

// Logo options for CarreApp. Every mark is drawn on a 64 x 64 board with the palette variables, so it follows
// the colours and the light / dark mode of the app. The gallery (/preview/logos in development) shows them all;
// the one the app uses is LOGO_VARIANT in Logo.tsx. Changing it is a one-word edit.
export type LogoVariant = 'cpin' | 'brujula' | 'podio' | 'pista' | 'bandera' | 'paso'

export const LOGO_OPTIONS: { id: LogoVariant; name: string; idea: string }[] = [
  { id: 'cpin', name: 'C con destino', idea: 'La C de Carrera abraza el punto de llegada de cada base. Se lee bien hasta en 16 px.' },
  { id: 'brujula', name: 'Brújula', idea: 'La marca anterior, afinada: una C dorada con la aguja que marca el camino.' },
  { id: 'podio', name: 'Podio', idea: 'Tres puestos y una estrella: dice "ranking" a primera vista.' },
  { id: 'pista', name: 'Pista', idea: 'La pista de atletismo vista desde arriba, con el corredor en la curva.' },
  { id: 'bandera', name: 'Bandera', idea: 'La bandera a cuadros de la meta, en oro y azul noche.' },
  { id: 'paso', name: 'Doble paso', idea: 'Dos flechas hacia adelante dentro de un sello dorado: movimiento y velocidad.' },
]

const stroke = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const MARKS: Record<LogoVariant, ReactNode> = {
  // A "C" (Carrera) holding a location pin (the next base).
  cpin: (
    <>
      <path d="M49.3 19.2A22 22 0 1 0 49.3 44.8" {...stroke} stroke="var(--gold)" strokeWidth="8" />
      <path d="M33 15.5a9.5 9.5 0 0 1 9.5 9.5c0 7.2-9.5 17-9.5 17s-9.5-9.8-9.5-17A9.5 9.5 0 0 1 33 15.5Z" fill="var(--sky)" />
      <circle cx="33" cy="25" r="3.6" fill="var(--bg)" />
    </>
  ),
  // The previous mark: a "C" with a compass needle.
  brujula: (
    <>
      <path d="M49.6 19.4A22 22 0 1 0 49.6 44.6" {...stroke} stroke="var(--gold)" strokeWidth="7" />
      <g transform="rotate(35 32 32)">
        <polygon points="32,22 37.5,41.5 32,37.6 26.5,41.5" fill="var(--sky)" stroke="var(--sky)" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    </>
  ),
  // Three podium steps and a star over the winner.
  podio: (
    <>
      <rect x="7" y="34" width="15" height="22" rx="3" fill="var(--sky)" />
      <rect x="24.5" y="23" width="15" height="33" rx="3" fill="var(--gold)" />
      <rect x="42" y="40" width="15" height="16" rx="3" fill="var(--sky)" opacity=".78" />
      <path d="m32 6 2.2 4.7 5.1.6-3.8 3.5 1 5.1-4.5-2.5-4.5 2.5 1-5.1-3.8-3.5 5.1-.6L32 6Z" fill="var(--gold)" />
    </>
  ),
  // An athletics track seen from above, with the runner in the bend.
  pista: (
    <>
      <rect x="6" y="15" width="52" height="34" rx="17" {...stroke} stroke="var(--gold)" strokeWidth="5.5" />
      <rect x="16.5" y="25.5" width="31" height="13" rx="6.5" {...stroke} stroke="var(--sky)" strokeWidth="3.2" />
      <circle cx="49" cy="17.5" r="5" fill="var(--text)" />
    </>
  ),
  // The chequered flag of the finish line.
  bandera: (
    <>
      <path d="M13 6v52" {...stroke} stroke="var(--text)" strokeWidth="4" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={18 + c * 9.5}
            y={9 + r * 9 + (c % 2 === 0 ? 0 : 1.6)}
            width="9.5"
            height="9"
            fill={(r + c) % 2 === 0 ? 'var(--gold)' : 'var(--text)'}
          />
        )),
      )}
    </>
  ),
  // A gold seal with two forward chevrons.
  paso: (
    <>
      <circle cx="32" cy="32" r="27" fill="var(--gold)" />
      <path d="m21 21 11 11-11 11" {...stroke} stroke="var(--on-gold)" strokeWidth="6" />
      <path d="m33 21 11 11-11 11" {...stroke} stroke="var(--on-gold)" strokeWidth="6" opacity=".55" />
    </>
  ),
}

export function LogoMarkOf({ variant, size = 32 }: { variant: LogoVariant; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="CarreApp">
      {MARKS[variant]}
    </svg>
  )
}
