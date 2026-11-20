// The theme of a semester ("temática") and the cultures inside it. Every inductor belongs to the culture that their career is
// assigned to in the theme of the semester, and their passport is dressed in it (colour, border ornament, emblem). A new
// semester with a new theme only needs a new entry here; nothing in the database changes (terms.theme is just the key).
export type CultureKey = 'nordica' | 'griega' | 'mexicana' | 'china' | 'egipcia'
export type Ornament = 'runes' | 'meander' | 'steps' | 'clouds' | 'lotus'

export interface Culture {
  key: CultureKey
  name: string // "Nórdica"
  myth: string // what the culture is known for, one line for the passport
  ink: 1 | 2 | 3 | 4 | 5 // --ink-N in index.css: the colour of its passport
  ornament: Ornament // the border drawn on every page
  emblem: string // what the cover shows
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
  { key: 'nordica', name: 'Nórdica', myth: 'Runas, martillos y el árbol del mundo', ink: 4, ornament: 'runes', emblem: 'Mjölnir' },
  { key: 'griega', name: 'Griega', myth: 'Dioses del Olimpo, héroes y monstruos', ink: 1, ornament: 'meander', emblem: 'Gorgoneion' },
  { key: 'mexicana', name: 'Mexicana', myth: 'El quinto sol y la serpiente emplumada', ink: 3, ornament: 'steps', emblem: 'Piedra del Sol' },
  { key: 'china', name: 'China', myth: 'Dragones, fénix y el equilibrio del yin y el yang', ink: 2, ornament: 'clouds', emblem: 'Dragón' },
  { key: 'egipcia', name: 'Egipcia', myth: 'Ra, Horus y el viaje al más allá', ink: 5, ornament: 'lotus', emblem: 'Ojo de Horus' },
]

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

/** A theme that this version of the app does not know (it was written by a newer one) falls back to the default. */
export function themeOf(key: string | null | undefined): Theme {
  return THEMES[key ?? ''] ?? THEMES[DEFAULT_THEME]
}

export function cultureOf(theme: string | null | undefined, key: string | null | undefined): Culture {
  const t = themeOf(theme)
  return t.cultures.find((c) => c.key === key) ?? t.cultures[0]
}
