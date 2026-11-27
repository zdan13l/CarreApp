import type { CSSProperties } from 'react'

// The colour of each group of careers is fixed: Sistemas orange, Biomec green, Tronicas red, Industrial yellow, Civil blue (the tokens `--tone-*` of
// index.css, one for the light and one for the dark theme). The groups that may come take the other colours in turn.
export const slugName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const FIXED_TONES = ['sistemas', 'biomec', 'tronicas', 'industrial', 'civil']
const EXTRA_TONES = ['purple', 'teal', 'pink']

/** A class (`tone-sistemas`…) for the five groups, or an inline `--accent` for the others. */
export function toneOf(groups: { id: string; name: string }[], g: { id: string; name: string }): { className?: string; style?: CSSProperties } {
  const slug = slugName(g.name)
  if (FIXED_TONES.includes(slug)) return { className: `tone-${slug}` }
  const n = groups.filter((x) => !FIXED_TONES.includes(slugName(x.name))).findIndex((x) => x.id === g.id)
  return { style: { ['--accent' as string]: `var(--tone-${EXTRA_TONES[Math.max(0, n) % EXTRA_TONES.length]})` } }
}
