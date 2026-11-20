// The theme of an induction ("temática") and the cultures inside it. THE THEME BELONGS TO ONE INDUCTION ONLY: the passport of a person is
// for their whole life in the induction, so nothing general (the cover, the identity page, the career) speaks of the theme; only the pages
// of each induction do. Every inductor belongs to the culture that their career is assigned to in the theme of THAT induction. A new
// induction with a new theme ("2720 · casas de Harry Potter") only needs a new entry here; nothing in the database changes
// (terms.theme is just the key). A theme this version of the app does not know shows a neutral page instead of another theme's cultures.
export type CultureKey = 'nordica' | 'griega' | 'mexicana' | 'china' | 'egipcia' | 'general'
export type Ornament = 'runes' | 'meander' | 'steps' | 'clouds' | 'lotus' | 'plain'

export interface Culture {
  key: CultureKey
  name: string // "Nórdica"
  myth: string // what the culture is known for, one line for the passport
  ink: 1 | 2 | 3 | 4 | 5 // --ink-N in index.css: the colour of its pages
  ornament: Ornament // the border drawn on its pages
  emblem: string
}

export interface Theme {
  key: string
  name: string
  cultures: Culture[]
  /** The culture assigned to a career, or null when the theme has no rule for it (the coordinator chooses). */
  cultureOf: (career: string) => CultureKey | null
}

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MITOLOGIAS: Culture[] = [
  { key: 'nordica', name: 'Nórdica', myth: 'Runas, martillos y el árbol del mundo', ink: 4, ornament: 'runes', emblem: 'Drakkar' },
  { key: 'griega', name: 'Griega', myth: 'Dioses del Olimpo, héroes y monstruos', ink: 1, ornament: 'meander', emblem: 'Templo' },
  { key: 'mexicana', name: 'Mexicana', myth: 'El quinto sol y la serpiente emplumada', ink: 3, ornament: 'steps', emblem: 'Pirámide' },
  { key: 'china', name: 'China', myth: 'Dragones, fénix y el equilibrio del yin y el yang', ink: 2, ornament: 'clouds', emblem: 'Pagoda' },
  { key: 'egipcia', name: 'Egipcia', myth: 'Ra, Horus y el viaje al más allá', ink: 5, ornament: 'lotus', emblem: 'Pirámides' },
]

const GENERAL: Culture = { key: 'general', name: 'Tu grupo', myth: 'Tu lugar en esta inducción', ink: 1, ornament: 'plain', emblem: 'Estrella' }

export const THEMES: Record<string, Theme> = {
  mitologias: {
    key: 'mitologias',
    name: 'Mitologías',
    cultures: MITOLOGIAS,
    cultureOf: (career) => {
      const c = plain(career)
      if (/sistemas|computaci|software|informatica/.test(c)) return 'nordica'
      if (/mecatr|redes|electr[oó]n|electric|telecom|tronic/.test(c)) return 'griega'
      if (/industrial/.test(c)) return 'mexicana'
      if (/bioing|biom|mecanica/.test(c)) return 'china'
      if (/civil/.test(c)) return 'egipcia'
      return null
    },
  },
}

export const DEFAULT_THEME = 'mitologias'

const pretty = (key: string) => key.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** The theme of a key. One this version does not know gets a neutral theme with its own name, never another theme's cultures. */
export function themeOf(key: string | null | undefined): Theme {
  const k = key ?? ''
  return THEMES[k] ?? { key: k, name: pretty(k || 'Temática'), cultures: [GENERAL], cultureOf: () => 'general' }
}

export function cultureOf(theme: string | null | undefined, key: string | null | undefined): Culture {
  const t = themeOf(theme)
  return t.cultures.find((c) => c.key === key) ?? t.cultures[0]
}
