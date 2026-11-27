import { useId } from 'react'
import { careerKey } from './CareerEmblem'
import { EMBLEM } from './InsigniaEmblems'
import { GROUP_MEDAL_CAREER } from '../lib/careers'

// The seal of a group of careers: the drawing that sits in the centre of its insignia (the laptop of Sistemas, the bridge of Civil…) printed like
// a stamp, in ONE ink (the colour of the group), inside a double ring. The drawing is turned into ink with a luminance mask: what is light in the
// medal (the white outlines and the touches) takes the colour, and the dark enamel stays empty.
// A group without a drawing of the app shows its picture, if its insignia has one, or its initial until it has one.
export default function GroupSeal({
  groupKey,
  color = 'currentColor',
  imageUrl,
  initial,
  size = 56,
  label,
}: {
  groupKey?: string // the key of the insignia of the group (sistemas, tronicas…)
  color?: string
  imageUrl?: string | null
  initial?: string
  size?: number
  label?: string
}) {
  const uid = useId().replace(/:/g, '')
  const career = groupKey ? GROUP_MEDAL_CAREER[groupKey] : undefined
  const key = career ? careerKey(career) : 'general'
  const drawing = !imageUrl && career && key !== 'general' ? EMBLEM[key] : null
  return (
    <svg className="group-seal" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label ?? 'Sello del grupo'} style={{ color, flex: 'none' }}>
      <defs>
        <clipPath id={`gc${uid}`}>
          <circle cx="50" cy="50" r="39" />
        </clipPath>
        <mask id={`gm${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100" style={{ maskType: 'luminance' }}>
          <rect width="100" height="100" fill="black" />
          <g clipPath={`url(#gc${uid})`}>
            <g transform="translate(6.5 6.5) scale(.1087)">{drawing ? drawing() : null}</g>
          </g>
        </mask>
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="42.5" fill="none" stroke="currentColor" strokeWidth=".9" />
      {drawing ? (
        <rect width="100" height="100" fill="currentColor" mask={`url(#gm${uid})`} />
      ) : imageUrl ? (
        <image href={imageUrl} x="11" y="11" width="78" height="78" preserveAspectRatio="xMidYMid slice" clipPath={`url(#gc${uid})`} />
      ) : (
        <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontSize="38" fontWeight={800} fill="currentColor" className="stamp-text">
          {(initial ?? '?').trim().charAt(0).toUpperCase()}
        </text>
      )}
    </svg>
  )
}
