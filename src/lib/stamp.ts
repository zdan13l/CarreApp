// The look of a stamp in the passport. Each base always gets the same shape and ink (derived from its id), so the
// stamp is recognisable everywhere: the runner's passport, the base's own screen and the coordinator's list.
export const STAMP_SHAPES = ['circle', 'hexagon', 'octagon', 'square'] as const
export type StampShape = (typeof STAMP_SHAPES)[number]

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const STAMP_SYMBOLS = [
  'library', 'goal', 'landmark', 'church', 'coffee', 'flask', 'theater', 'tree', 'building', 'palette', 'mountain',
  'compass', 'sun', 'star', 'bulb', 'cap', 'sprout', 'music',
] as const
export type StampSymbol = (typeof STAMP_SYMBOLS)[number]

// What the place is, read from its name; a base with an unusual name gets a symbol from its id instead.
const SYMBOL_WORDS: [RegExp, StampSymbol][] = [
  [/biblioteca|libro|lectura|hemeroteca/, 'library'],
  [/cancha|futbol|deporte|coliseo|gimnasio|piscina|estadio/, 'goal'],
  [/atrio|portico|porteria|entrada|plaza|plazoleta|patio/, 'landmark'],
  [/capilla|iglesia|templo|claustro|santuario/, 'church'],
  [/cafeteria|restaurante|comida|cafe|casino/, 'coffee'],
  [/laboratorio|lab|quimica|biologia|medicina|ciencia/, 'flask'],
  [/auditorio|teatro|escenario|aula magna/, 'theater'],
  [/jardin|parque|bosque|arbol|ecologia|zona verde/, 'tree'],
  [/torre|edificio|facultad|bloque|decanatura/, 'building'],
  [/museo|arte|galeria|pintura/, 'palette'],
  [/mirador|cerro|montana|sendero/, 'mountain'],
  [/musica|conservatorio|coro/, 'music'],
  [/invernadero|vivero/, 'sprout'],
]
const SYMBOL_FALLBACK: StampSymbol[] = ['compass', 'sun', 'star', 'bulb', 'cap', 'mountain', 'sprout', 'music']

export function stampSymbol(name: string, seed: string): StampSymbol {
  const text = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const [re, symbol] of SYMBOL_WORDS) if (re.test(text)) return symbol
  return SYMBOL_FALLBACK[hash(seed || name) % SYMBOL_FALLBACK.length]
}

export type StampLayout = 'ring' | 'band' // the name around the photo, or on a band across it

export interface StampLook {
  shape: StampShape
  layout: StampLayout
  ink: 1 | 2 | 3 | 4 | 5 // --ink-N in index.css
  tilt: number // degrees: a hand-stamped mark is never perfectly straight
  seed: number // grain of the worn ink
}

export function stampLook(seed: string): StampLook {
  const h = hash(seed || 'base')
  const shape = STAMP_SHAPES[h % STAMP_SHAPES.length]
  return {
    shape,
    layout: shape !== 'circle' && Math.floor(h / 3) % 2 === 1 ? 'band' : 'ring', // the band needs the width of a polygon
    ink: ((Math.floor(h / 7) % 5) + 1) as StampLook['ink'],
    tilt: (Math.floor(h / 61) % 13) - 6,
    seed: (h % 90) + 1,
  }
}

/** "12:04" in Colombian time format, 24 hours. */
export function stampTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Machine-readable zone style text: uppercase, no accents, `<` as filler. */
export function mrzText(text: string, width = 30): string {
  const clean = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
  return (clean + '<'.repeat(width)).slice(0, width)
}

/** A line of the machine-readable zone from words: `mrzJoin(['P<PUJ', 'CARRERA', '2710'])` -> P<PUJ<<CARRERA<<2710<<<<<<<<<< */
export function mrzJoin(parts: string[], width = 30): string {
  return parts.map((p) => mrzText(p, p.length).replace(/<+$/, '')).join('<<').padEnd(width, '<').slice(0, width)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** The two lines at the bottom of a passport page. Only real numbers: stamps collected and rounds in the Carrera. */
export function mrzLines(teamName: string, stamps: number, rounds: number): [string, string] {
  return [`P<PUJ<<${mrzText(teamName, 23)}`, `SELLOS${pad2(stamps)}<<RONDAS${pad2(rounds)}`.padEnd(30, '<')]
}
