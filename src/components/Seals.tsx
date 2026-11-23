import { useId, type ReactNode } from 'react'
import EventSealView from './EventSealView'
import { imageUrl } from '../lib/eventSeals'
import { eventOfTheme, sealOverride } from '../lib/eventSealStore'
import { cultureOf, type CultureKey } from '../lib/themes'
import { symbolOf } from '../lib/symbols'
import { CultureIcon } from './CultureEmblem'

// The round stamps of the personal passport that are not the stamp of a base or of a committee:
//   CultureSeal  "this is the culture you got" (a drawing of the place of the culture on the rings)
//   TextSeal     a ring with a word in the middle (the entry to the induction, the generation…)
//   SymbolBadge  the personal symbol of each inductor (an icon picked from a list, with its name)
// One ink (`color`, the culture's) with the paper colour (--seal-paper) for the cut-outs; worn like a rubber stamp.
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function SealFrame({ top, bottom, size, tilt, className, label, children }: { top: string; bottom: string; size: number; tilt: number; className: string; label: string; children: ReactNode }) {
  const uid = useId().replace(/:/g, '')
  return (
    <span className={`seal ${className}`} style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          <filter id={`sw${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={hash(top + bottom) % 90} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="s" />
            <feComposite in="SourceGraphic" in2="s" operator="in" />
          </filter>
          <path id={`st${uid}`} d="M19 50A31 31 0 0 1 81 50" fill="none" />
          <path id={`sb${uid}`} d="M13 50A37 37 0 0 0 87 50" fill="none" />
        </defs>
        <g filter={`url(#sw${uid})`} className="seal-ink">
          <circle cx="50" cy="50" r="47" fill="none" strokeWidth="3" />
          <circle cx="50" cy="50" r="41.4" fill="none" strokeWidth="1" />
          <circle cx="50" cy="50" r="27.4" fill="none" strokeWidth="1" />
          <text fontSize={top.length > 17 ? 5.6 : top.length > 12 ? 6.4 : 7} fontWeight="800" letterSpacing=".8" textAnchor="middle" stroke="none" className="stamp-text">
            <textPath href={`#st${uid}`} startOffset="50%">{top.toUpperCase()}</textPath>
          </text>
          <text fontSize={bottom.length > 22 ? 4.6 : 5.4} fontWeight="700" letterSpacing=".5" textAnchor="middle" stroke="none" className="stamp-mono">
            <textPath href={`#sb${uid}`} startOffset="50%">{bottom.toUpperCase()}</textPath>
          </text>
          {children}
        </g>
      </svg>
    </span>
  )
}

/** "Te tocó": the culture the career was assigned in the theme of the semester, with the drawing of its place in the middle. */
export function CultureSeal({ culture, theme, top, bottom, size = 108, tilt = -4 }: { culture: CultureKey; theme: string; top: string; bottom: string; size?: number; tilt?: number }) {
  const c = cultureOf(theme, culture)
  const own = sealOverride(eventOfTheme(theme), 'subtheme', culture) // the seal this carrera gave to the subtheme
  if (own) return <span className={`culture-${c.key}`} style={{ display: 'inline-block', transform: `rotate(${tilt}deg)`, lineHeight: 0 }}><EventSealView shape={own.shape} color={own.color} imageUrl={imageUrl(own.image_path)} initial={c.name} size={size} label={`${top}, ${bottom}`} /></span>
  return (
    <SealFrame top={top} bottom={bottom} size={size} tilt={tilt} className={`culture-${c.key}`} label={`${top}, ${bottom}`}>
      <g transform="translate(50 50) scale(.62) translate(-50 -50)" className="seal-emblem">
        <CultureIcon culture={c.key} />
      </g>
    </SealFrame>
  )
}

/** Splits a long text into two lines at the space nearest to the middle. */
export function splitWords(s: string): [string, string] {
  if (s.length <= 8 || !s.includes(' ')) return [s, '']
  const mid = s.length / 2
  let best = -1
  for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  return [s.slice(0, best), s.slice(best + 1)]
}

/** A ring with a word in the middle: the semester of entry to the induction, the generation… */
export function TextSeal({ center, top, bottom, size = 108, tilt = 3, culture }: { center: string; top: string; bottom: string; size?: number; tilt?: number; culture?: CultureKey }) {
  const words = center.trim()
  // "Generación 7" says its name on the ring already: the middle keeps what is new ("7"). Long texts go on two lines.
  const [a, b] = splitWords(words.replace(/^generaci[oó]n\s*/i, '').trim() || words)
  const longest = Math.max(a.length, b.length)
  const fs = longest <= 3 ? 20 : longest <= 5 ? 14 : longest <= 8 ? 10.4 : 7.4
  return (
    <SealFrame top={top} bottom={bottom} size={size} tilt={tilt} className={culture ? `culture-${culture}` : ''} label={`${top}: ${words}`}>
      <text x="50" y={b ? 50 - fs * 0.1 : 50 + fs * 0.34} fontSize={fs} fontWeight="800" textAnchor="middle" stroke="none" className="stamp-text">
        {a.toUpperCase()}
      </text>
      {b && (
        <text x="50" y={50 + fs} fontSize={fs} fontWeight="800" textAnchor="middle" stroke="none" className="stamp-text">
          {b.toUpperCase()}
        </text>
      )}
    </SealFrame>
  )
}

/** The personal symbol: a round badge with the icon, and its name under it. */
export function SymbolBadge({ symbol, label, size = 64, showLabel = true }: { symbol?: string | null; label?: string | null; size?: number; showLabel?: boolean }) {
  const s = symbolOf(symbol)
  return (
    <span className="symbol-badge">
      <span className={`symbol-disc${s ? '' : ' empty'}`} style={{ width: size, height: size }} aria-hidden="true">
        {s ? <s.Icon size={size * 0.52} strokeWidth={1.8} /> : <span>?</span>}
      </span>
      {showLabel && <small>{label?.trim() || s?.name || 'Sin símbolo'}</small>}
    </span>
  )
}

/**
 * The golden stamp with a PHOTO: the picture of the group a runner runs with, or of the base an inductor staffs. It is gold because it is
 * unique to that person (a runner collects stamps of the bases, a base inductor does not run, so the base itself is their stamp).
 * The photo is printed in gold like the stamps print theirs in one ink.
 */
export function PhotoSeal({ url, top, bottom, size = 110, tilt = 0 }: { url: string | null; top: string; bottom: string; size?: number; tilt?: number }) {
  const uid = useId().replace(/:/g, '')
  const gold = `url(#pg${uid})`
  return (
    <span className="seal photo-seal gold" style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={`${top}: ${bottom}`}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`pg${uid}`} gradientUnits="userSpaceOnUse" x1="8" y1="6" x2="92" y2="94">
            <stop offset="0" style={{ stopColor: 'var(--foil-a)' }} />
            <stop offset=".36" style={{ stopColor: 'var(--foil-b)' }} />
            <stop offset=".58" style={{ stopColor: 'var(--foil-c)' }} />
            <stop offset="1" style={{ stopColor: 'var(--foil-d)' }} />
          </linearGradient>
          <filter id={`pf${uid}`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncR type="table" tableValues=".2 .65 1" />
              <feFuncG type="table" tableValues=".12 .47 .86" />
              <feFuncB type="table" tableValues=".02 .17 .5" />
            </feComponentTransfer>
          </filter>
          <clipPath id={`pc${uid}`}>
            <circle cx="50" cy="50" r="27" />
          </clipPath>
          <path id={`pt${uid}`} d="M19 50A31 31 0 0 1 81 50" fill="none" />
          <path id={`pb${uid}`} d="M13 50A37 37 0 0 0 87 50" fill="none" />
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke={gold} strokeWidth="3" />
        <circle cx="50" cy="50" r="41.4" fill="none" stroke={gold} strokeWidth="1" />
        <circle cx="50" cy="50" r="28.4" fill="none" stroke={gold} strokeWidth="1.6" />
        {url ? (
          <image href={url} x="23" y="23" width="54" height="54" preserveAspectRatio="xMidYMid slice" clipPath={`url(#pc${uid})`} filter={`url(#pf${uid})`} />
        ) : (
          <circle cx="50" cy="50" r="27" fill={gold} opacity=".35" />
        )}
        <text fontSize={top.length > 14 ? 5.8 : 7} fontWeight="800" letterSpacing=".8" textAnchor="middle" fill={gold} className="stamp-text">
          <textPath href={`#pt${uid}`} startOffset="50%">{top.toUpperCase()}</textPath>
        </text>
        <text fontSize={bottom.length > 22 ? 4.6 : 5.4} fontWeight="700" letterSpacing=".5" textAnchor="middle" fill={gold} className="stamp-mono">
          <textPath href={`#pb${uid}`} startOffset="50%">{bottom.toUpperCase()}</textPath>
        </text>
      </svg>
    </span>
  )
}
