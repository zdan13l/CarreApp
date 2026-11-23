// The seals that are made from a picture printed in one ink: the fifteen mythology stamps of the bases and the generation seals.
// Each picture is turned into ink in the browser (a luminance mask), so it takes the colour of the stamp and follows the theme.
// The pictures live in /public/sellos and are not precached: a phone only downloads the ones it shows.

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]
const f = (n: number) => +n.toFixed(2)
const pt = (x: number, y: number) => `${f(x)},${f(y)}`
const poly = (n: number, r: number, rot: number, cx = 50, cy = 40) => 'M' + Array.from({ length: n }, (_, k) => pt(...polar(cx, cy, r, rot + (k * 360) / n))).join('L') + 'Z'
const scallop = (n: number, r: number, bump: number, cx = 50, cy = 40) => {
  let d = ''
  for (let k = 0; k < n; k++) {
    const [x1, y1] = polar(cx, cy, r, (k * 360) / n)
    const [x2, y2] = polar(cx, cy, r, ((k + 1) * 360) / n)
    d += `${k ? '' : 'M' + pt(x1, y1)}Q${pt(...polar(cx, cy, r + bump, ((k + 0.5) * 360) / n))} ${pt(x2, y2)}`
  }
  return d + 'Z'
}

// ---------- where the pictures come from ----------
const SEAL_DIR = '/sellos/'
const embedded = new Map<string, string>() // file -> data URL, filled before the PDF is drawn (an SVG turned into an image cannot fetch)
export const assetUrl = (file: string) => embedded.get(file) ?? (/^https?:/.test(file) ? file : SEAL_DIR + file)

export async function embedSealAssets(files: string[]): Promise<void> {
  for (const file of new Set(files)) {
    if (embedded.has(file)) continue
    const blob = await (await fetch(/^https?:/.test(file) ? file : SEAL_DIR + file)).blob()
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    embedded.set(file, url)
  }
}

// ---------- the silhouettes (a 100 x 100 box: the frame above, the name band under it) ----------
export type FrameKind = 'circle' | 'hexagon' | 'octagon' | 'pentagon' | 'shield' | 'arch' | 'roundsq' | 'tablet' | 'oval' | 'wide' | 'scallop' | 'medal'
export interface Frame {
  outer: string
  inner: string
  box: [number, number, number, number] // where the picture goes
}
export const FRAMES: Record<FrameKind, Frame> = {
  circle: { outer: 'M13 40a37 37 0 1 0 74 0a37 37 0 1 0 -74 0Z', inner: 'M16.6 40a33.4 33.4 0 1 0 66.8 0a33.4 33.4 0 1 0 -66.8 0Z', box: [16.6, 6.6, 66.8, 66.8] },
  hexagon: { outer: poly(6, 37, -90), inner: poly(6, 33, -90), box: [21.4, 7, 57.2, 66] },
  octagon: { outer: poly(8, 38, -67.5), inner: poly(8, 34.4, -67.5), box: [15.6, 5.6, 68.8, 68.8] },
  pentagon: { outer: poly(5, 39, -90, 50, 42), inner: poly(5, 35, -90, 50, 42), box: [16, 8, 68, 66] },
  shield: { outer: 'M18 4H82V42C82 62 68 72 50 78C32 72 18 62 18 42Z', inner: 'M21 7H79V42C79 59 67 68 50 73C33 68 21 59 21 42Z', box: [21, 7, 58, 66] },
  arch: { outer: 'M14 77V38A36 36 0 0 1 86 38V77Z', inner: 'M18 73V38A32 32 0 0 1 82 38V73Z', box: [18, 6, 64, 67] },
  roundsq: { outer: 'M24 4H76Q86 4 86 14V66Q86 76 76 76H24Q14 76 14 66V14Q14 4 24 4Z', inner: 'M26 8H74Q82 8 82 16V64Q82 72 74 72H26Q18 72 18 64V16Q18 8 26 8Z', box: [18, 8, 64, 64] },
  tablet: { outer: 'M22 4H78L91 17V63L78 76H22L9 63V17Z', inner: 'M25 8H75L87 19V61L75 72H25L13 61V19Z', box: [13, 8, 74, 64] },
  oval: { outer: 'M20 40a30 37 0 1 0 60 0a30 37 0 1 0 -60 0Z', inner: 'M23.4 40a26.6 33.6 0 1 0 53.2 0a26.6 33.6 0 1 0 -53.2 0Z', box: [23.4, 6.4, 53.2, 67.2] },
  wide: { outer: 'M24 14H76Q94 14 94 40Q94 66 76 66H24Q6 66 6 40Q6 14 24 14Z', inner: 'M26 18H74Q90 18 90 40Q90 62 74 62H26Q10 62 10 40Q10 18 26 18Z', box: [10, 18, 80, 44] },
  scallop: { outer: scallop(18, 34, 3.4), inner: 'M18.4 40a31.6 31.6 0 1 0 63.2 0a31.6 31.6 0 1 0 -63.2 0Z', box: [18.4, 8.4, 63.2, 63.2] },
  // no outline of its own: the picture brings its ring and breaks out of it
  medal: { outer: '', inner: '', box: [13, 3, 74, 74] },
}

// ---------- a picture that is already ink ----------
export interface InkSource {
  file: string // under /sellos/: white = ink, transparent = paper
}

export type SealKey =
  | 'horus' | 'anubis' | 'khepri' | 'mjolnir' | 'loki' | 'cuervos' | 'zeus' | 'pegaso' | 'poseidon'
  | 'jaguar' | 'aguila' | 'mictlan' | 'dragon' | 'wukong' | 'tigre'
export interface MythSeal extends InkSource {
  key: string // one of SealKey, or the id of a seal the coordinator uploaded
  color?: string // only the uploaded seals: their own ink (the app's seals take it from --seal-<key>)
  name: string
  story: string // what it is, for the inductor who staffs the base: its mythology and what it refers to
  culture: string // the key of the culture in the Mitologías theme
  frame: FrameKind
  wings?: boolean // Pegasus: the wings are drawn over the picture, which has none
}

export const MYTH_SEALS: MythSeal[] = [
  { key: 'horus', name: 'El ojo de Horus', story: 'El ojo de Horus, el dios halcón del cielo egipcio, protege y sana: es el ojo que todo lo ve y cuida a quien lo lleva.', culture: 'egipcia', frame: 'wide', file: 'ink/horus.png' },
  { key: 'anubis', name: 'Anubis', story: 'Anubis, el dios con cabeza de chacal, guía a las almas por el inframundo y vigila el pesaje de sus corazones.', culture: 'egipcia', frame: 'oval', file: 'ink/anubis.png' },
  { key: 'khepri', name: 'Khepri, el escarabajo alado', story: 'Khepri, el escarabajo alado, empuja el sol cada mañana por el cielo: símbolo de renacer y de empezar de nuevo.', culture: 'egipcia', frame: 'octagon', file: 'ink/khepri.png' },
  { key: 'mjolnir', name: 'Mjölnir, el martillo de Thor', story: 'Mjölnir es el martillo de Thor, el dios del trueno: defiende a dioses y humanos de los gigantes y bendice lo que toca.', culture: 'nordica', frame: 'circle', file: 'ink/mjolnir.png' },
  { key: 'loki', name: 'Loki, el casco de cuernos', story: 'Loki, el embaucador nórdico: dios del fuego y las travesuras, capaz de cambiar de forma. Lleva su casco de cuernos.', culture: 'nordica', frame: 'shield', file: 'ink/loki.png' },
  { key: 'cuervos', name: 'Hugin y Munin, los cuervos de Odín', story: 'Hugin (el pensamiento) y Munin (la memoria) son los cuervos de Odín: vuelan por el mundo y le cuentan todo lo que ven.', culture: 'nordica', frame: 'arch', file: 'ink/cuervos.png' },
  { key: 'zeus', name: 'Zeus, el rayo en alto', story: 'Zeus, rey de los dioses del Olimpo, gobierna el cielo y lanza el rayo con el que impone la justicia.', culture: 'griega', frame: 'hexagon', file: 'ink/zeus.png' },
  { key: 'pegaso', name: 'Pegaso, el salto con alas', story: 'Pegaso es el caballo alado que nació de Medusa: voló hasta el Olimpo y llevó los rayos de Zeus.', culture: 'griega', frame: 'circle', file: 'ink/pegaso.png', wings: true },
  { key: 'poseidon', name: 'Poseidón, rey de los mares', story: 'Poseidón, dios de los mares, agita las olas con su tridente y hace temblar la tierra cuando se enfurece.', culture: 'griega', frame: 'medal', file: 'ink/poseidon.png' }, // the letters of the ring of the original are a solid ring
  { key: 'jaguar', name: 'El jaguar', story: 'El jaguar era el guardián de la noche y del inframundo para los pueblos de México: símbolo de la fuerza y de los guerreros.', culture: 'mexicana', frame: 'tablet', file: 'ink/jaguar.png' },
  { key: 'aguila', name: 'El águila de alas abiertas', story: 'El águila es el ave del sol. Según la leyenda mexica, un águila sobre un nopal mostró dónde fundar Tenochtitlán.', culture: 'mexicana', frame: 'pentagon', file: 'ink/aguila.png' },
  { key: 'mictlan', name: 'Mictlán, el rostro con la lengua', story: 'Mictlán es el inframundo mexica: las almas lo cruzaban en nueve niveles hasta llegar a su señor, Mictlantecuhtli.', culture: 'mexicana', frame: 'scallop', file: 'ink/mictlan.png' },
  { key: 'dragon', name: 'El dragón y la perla', story: 'El dragón chino trae la lluvia y la buena suerte, y persigue la perla, que representa la sabiduría.', culture: 'china', frame: 'octagon', file: 'ink/dragon.png' },
  { key: 'wukong', name: 'Sun Wukong, el Rey Mono', story: 'Sun Wukong, el Rey Mono de «Viaje al Oeste»: ingenioso, travieso e imparable, con su bastón mágico.', culture: 'china', frame: 'oval', file: 'ink/wukong.png' },
  { key: 'tigre', name: 'El tigre blanco, Baihu', story: 'El tigre blanco, Baihu, es uno de los cuatro guardianes del cielo chino: protege el oeste y simboliza el valor.', culture: 'china', frame: 'circle', file: 'ink/tigre.png' },
]

/** The order bases take the seals in: the cultures alternate, so five bases already get one of each. */
export const SEAL_ORDER: SealKey[] = [
  'horus', 'mjolnir', 'zeus', 'jaguar', 'dragon', 'anubis', 'loki', 'pegaso', 'aguila', 'wukong', 'khepri', 'cuervos', 'poseidon', 'mictlan', 'tigre',
]
export const sealOf = (key: string) => MYTH_SEALS.find((s) => s.key === key) ?? MYTH_SEALS[0]

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// The seal of each base of the Carrera: no two bases repeat a seal (while there are as many seals as bases) and the cultures alternate. Every
// screen that loads the bases tells this list which they are (`registerSealRoster`); the i-th base by id takes the i-th seal, so it looks the
// same on every screen. The seals are the 15 of the app plus the ones the coordinator uploaded (`custom_seals`, 0034). A base that is not in the
// list (an old stamp in a passport) falls back to a seal drawn from its id.
let customSeals: MythSeal[] = []
let roster = new Map<string, number>()
let rosterIds: string[] = []
const allSeals = (): MythSeal[] => [...SEAL_ORDER.map(sealOf), ...customSeals]
export const sealCount = () => allSeals().length
export function registerSealRoster(ids: string[]) {
  rosterIds = ids
  const n = allSeals().length
  roster = new Map([...new Set(ids)].sort().map((id, i) => [id, i % n]))
}
export const sealForSeed = (seed: string): MythSeal => {
  const list = allSeals()
  return list[roster.get(seed) ?? hash(seed || 'base') % SEAL_ORDER.length]
}

export interface CustomSealRow { id: string; name: string; culture: string; color: string; path: string; story: string | null }
export function setCustomSeals(rows: CustomSealRow[], urlOf: (path: string) => string) {
  customSeals = rows.map((r) => ({
    key: r.id,
    name: r.name,
    story: r.story ?? `Un sello propio de la carrera${r.culture === 'otra' ? '' : `, de la mitología ${r.culture}`}.`,
    culture: r.culture,
    frame: 'circle' as const,
    file: urlOf(r.path),
    color: r.color,
  }))
  registerSealRoster(rosterIds) // the list grew: the bases are dealt the seals again
}
export const customSealList = () => customSeals

export const sealInkVar = (seed: string) => {
  const seal = sealForSeed(seed)
  return seal.color ?? `var(--seal-${seal.key})`
}

// ---------- the generations ----------
export type GenerationKey = 'peluches' | 'barbies' | 'champinones' | 'textiles' | 'minichips'
export interface GenerationSeal {
  key: GenerationKey
  name: string
  term: string | null // the semester they entered (2X10 first half of the year, 2X30 second half, 2X20 intersemestral)
  kind: 'arch' | 'ticket' | 'block' | 'spool' | null // null: its picture is not defined yet
  ink: 1 | 2 | 3 | 4 | 5
  source?: InkSource
}

export const GENERATIONS: GenerationSeal[] = [
  { key: 'champinones', name: 'Champiñones', term: '2510', kind: 'block', ink: 2, source: { file: 'ink/gen-champinones.png' } },
  { key: 'peluches', name: 'Peluches', term: '2610', kind: 'arch', ink: 5, source: { file: 'ink/gen-peluches.png' } },
  { key: 'barbies', name: 'Barbies', term: '2630', kind: 'ticket', ink: 4, source: { file: 'ink/gen-barbies.png' } },
  { key: 'minichips', name: 'Minichips', term: '2710', kind: null, ink: 3 }, // the logo of the newest generation is not defined yet
  { key: 'textiles', name: 'Textiles', term: null, kind: 'spool', ink: 1 },
]

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

/** "Barbies / Pendiente" -> the generations of the text that this version knows, in order. */
export function generationsOf(text: string | null | undefined): GenerationSeal[] {
  if (!text) return []
  return text
    .split(/[/,+]/)
    .map((part) => GENERATIONS.find((g) => g.key === plain(part)))
    .filter((g): g is GenerationSeal => Boolean(g))
}

/** Every picture file the seals can use (for the PDF). */
export const allSealFiles = () => [...new Set([...MYTH_SEALS.map((s) => s.file), ...GENERATIONS.flatMap((g) => (g.source ? [g.source.file] : []))])]
