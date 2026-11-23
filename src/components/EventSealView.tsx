import { useId, type CSSProperties } from 'react'
import { FRAMES } from '../lib/seals'
import type { SealShape } from '../lib/eventSeals'
import { InkPicture } from './InkSeals'

// One seal of a carrera: its silhouette in its colour, with its picture (already ink) inside. The coordi's seal is GOLD (the foil of the app).
// Without a picture it shows the initial of the element.
export default function EventSealView({
  shape,
  color,
  imageUrl,
  initial,
  gold = false,
  size = 96,
  label,
}: {
  shape: SealShape
  color: string
  imageUrl?: string | null
  initial?: string
  gold?: boolean
  size?: number
  label?: string
}) {
  const uid = useId().replace(/:/g, '')
  const frame = FRAMES[shape]
  const paint = gold ? `url(#gold${uid})` : color
  const style = { width: size, height: size, '--stamp-ink': paint } as CSSProperties
  return (
    <span className="event-seal" style={style} role="img" aria-label={label ?? 'Sello'}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          {gold && (
            <linearGradient id={`gold${uid}`} gradientUnits="userSpaceOnUse" x1="8" y1="6" x2="92" y2="94">
              <stop offset="0" style={{ stopColor: 'var(--foil-a)' }} />
              <stop offset=".36" style={{ stopColor: 'var(--foil-b)' }} />
              <stop offset=".58" style={{ stopColor: 'var(--foil-c)' }} />
              <stop offset="1" style={{ stopColor: 'var(--foil-d)' }} />
            </linearGradient>
          )}
          <clipPath id={`clip${uid}`}>
            <path d={frame.inner} />
          </clipPath>
        </defs>
        <path d={frame.outer} fill="none" stroke={paint} strokeWidth="3" strokeLinejoin="round" />
        <path d={frame.inner} fill="none" stroke={paint} strokeWidth=".8" strokeLinejoin="round" />
        <g clipPath={`url(#clip${uid})`}>
          {imageUrl ? (
            <InkPicture source={{ file: imageUrl }} box={frame.box} fill={paint} />
          ) : (
            <text x="50" y="52" textAnchor="middle" fontSize="30" fontWeight="800" fill={paint} className="stamp-text">
              {(initial ?? '?').charAt(0).toUpperCase()}
            </text>
          )}
        </g>
      </svg>
    </span>
  )
}
