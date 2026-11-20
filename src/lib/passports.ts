// The personal passport of each inductor: types, the Excel the coordinator uploads (names and careers) and the Excel the app returns
// (the @ and the password of every person). Pure functions where possible: the screen shows a preview before anything is created.
import { readTablesFromFile } from './bulk'
import { generatePassword } from './password'
import { cultureOf, themeOf, type CultureKey } from './themes'
import { USERNAME_PATTERN } from './username'

export type PassportRole = 'runner' | 'base' | 'coordinator'
export const PASSPORT_ROLES: PassportRole[] = ['runner', 'base', 'coordinator']
export const PASSPORT_ROLE_LABEL: Record<PassportRole, string> = { runner: 'Corredor', base: 'Base', coordinator: 'Coordinador' }
export const PASSPORT_ROLE_LONG: Record<PassportRole, string> = { runner: 'Corredor', base: 'Inductor de base', coordinator: 'Coordinador de Carrera' }

export interface TermRow {
  id: string
  name: string
  theme: string
  is_current: boolean
}

export interface PassportPerson {
  id: string
  username: string
  full_name: string
  photo_path: string | null
}

export interface PassportRecordRow {
  id: string
  passport_id: string
  term_id: string
  role: PassportRole
  career: string
  culture: string
  team_id: string | null
  base_id: string | null
}

export type StampKind = 'visited' | 'hosted' | 'coordinated'
export interface PassportStampRow {
  record_id: string
  event_id: string | null
  event_name: string
  kind: StampKind
  base_name: string | null
  base_key: string | null
  round_number: number
  stamped_at: string
}

export interface PassportContextRow {
  record_id: string
  team_id: string | null
  team_name: string | null
  team_photo_path: string | null
  partners: string[]
  base_id: string | null
  base_name: string | null
  event_id: string | null
  event_name: string | null
  event_active: boolean
}

// ---------- the @ of each person ----------

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * "Gabriel Alejandro Peñuela Niño" -> "gabriel.penuela": the first name and the first surname. With three words the last one is the
 * surname ("Sara Castro Ramirez" -> "sara.ramirez"). When it is taken ("juan.sanchez") the initial of the second name is added
 * ("juan.sanchez.s"), then a number. `taken` is updated so a whole list can be named at once.
 */
export function passportUsername(fullName: string, taken: Set<string>): string {
  const w = plain(fullName)
  const first = w[0] ?? 'inductor'
  const surname = w.length >= 4 ? w[2] : w.length >= 2 ? w[w.length - 1] : ''
  const base = (surname ? `${first}.${surname}` : first).slice(0, 26)
  const second = w.length >= 3 ? w[1][0] : ''
  const candidates = [base, ...(second ? [`${base}.${second}`] : [])]
  for (let n = 2; n < 100; n++) candidates.push(`${base}${n}`)
  const pick = candidates.find((c) => USERNAME_PATTERN.test(c) && !taken.has(c)) ?? `${base}${Date.now() % 100000}`
  taken.add(pick)
  return pick
}

// ---------- the Excel that comes in ----------

export interface PersonIn {
  line: number // line in the sheet (the header is line 1)
  fullName: string
  career: string
  role: PassportRole
  culture: CultureKey | null // null: the theme has no rule for this career
  username: string
  existing: boolean // already has a passport (same @): it only gets a record for this semester
  errors: string[]
}

const key = (s: string) => plain(s).join(' ')

const ROLE_WORDS: [RegExp, PassportRole][] = [
  [/base|inductor/, 'base'],
  [/coord|admin/, 'coordinator'],
  [/corred|runner/, 'runner'],
]
function parseRole(text: string): PassportRole | null {
  const k = key(text)
  if (!k) return null
  return ROLE_WORDS.find(([re]) => re.test(k))?.[1] ?? null
}

/** Finds the table with the "Nombre" and "Carrera" columns (the first sheet or table that has them). */
export function parsePeopleTable(tables: string[][][]): { header: string[]; rows: string[][] } | null {
  for (const t of tables) {
    const hi = t.findIndex((r) => r.some((c) => key(c) === 'nombre') && r.some((c) => key(c) === 'carrera'))
    if (hi >= 0) return { header: t[hi], rows: t.slice(hi + 1) }
  }
  return null
}

export interface PeopleContext {
  theme: string
  /** The @ that already exist (passports and profiles): a new person can never take one. */
  usernames: Set<string>
  /** People that already have a passport, by normalised full name -> their @. They are not created again. */
  known: Map<string, string>
}

export function parsePeople(tables: string[][][], ctx: PeopleContext): PersonIn[] {
  const table = parsePeopleTable(tables)
  if (!table) throw new Error('No se encontró la tabla. El Excel necesita las columnas "Nombre" y "Carrera" (usa la plantilla).')
  const col = (name: string) => table.header.findIndex((c) => key(c) === name)
  const [iName, iCareer, iRole, iUser] = [col('nombre'), col('carrera'), col('rol'), col('usuario')]
  const theme = themeOf(ctx.theme)
  const taken = new Set(ctx.usernames)
  const seen = new Set<string>()
  const out: PersonIn[] = []
  table.rows.forEach((r, i) => {
    const fullName = (r[iName] ?? '').replace(/\s+/g, ' ').trim()
    if (!fullName && !(r[iCareer] ?? '').trim()) return // an empty line
    const career = (r[iCareer] ?? '').replace(/\s+/g, ' ').trim()
    const errors: string[] = []
    if (!fullName) errors.push('Falta el nombre.')
    if (!career) errors.push('Falta la carrera.')
    const roleText = iRole >= 0 ? (r[iRole] ?? '') : ''
    const parsedRole = parseRole(roleText)
    if (roleText.trim() && !parsedRole) errors.push('El rol no se entiende (corredor, base o coordinador).')
    if (seen.has(key(fullName)) && fullName) errors.push('Esta persona está repetida en el archivo.')
    seen.add(key(fullName))
    const knownUser = ctx.known.get(key(fullName))
    let username = knownUser ?? ''
    if (!username) {
      const wanted = iUser >= 0 ? (r[iUser] ?? '').trim().toLowerCase().replace(/^@/, '') : ''
      if (wanted) {
        if (!USERNAME_PATTERN.test(wanted)) errors.push('El usuario debe tener 3-30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
        else if (taken.has(wanted)) errors.push(`El usuario @${wanted} ya existe.`)
        else taken.add(wanted)
        username = wanted
      } else if (fullName) username = passportUsername(fullName, taken)
    }
    out.push({
      line: i + 2,
      fullName,
      career,
      role: parsedRole ?? 'runner',
      culture: career ? theme.cultureOf(career) : null,
      username,
      existing: Boolean(knownUser),
      errors,
    })
  })
  if (out.length === 0) throw new Error('La tabla no tiene personas.')
  return out
}

export async function readPeopleFile(file: File, ctx: PeopleContext): Promise<PersonIn[]> {
  return parsePeople(await readTablesFromFile(file), ctx)
}

// ---------- the Excel that goes out ----------

export interface CredentialRow {
  fullName: string
  career: string
  role: PassportRole
  culture: string // the name, e.g. "Nórdica"
  username: string
  password: string // empty when the person already had a passport
}

const head = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#062a5c', textColor: '#ffffff' })

/** The rows of the Excel that goes out (a header and one line per person). Pure, so it can be checked without a browser. */
export function credentialsData(rows: CredentialRow[], themeKey: string) {
  return [
    ['Nombre', 'Carrera', 'Temática', 'Cultura', 'Rol', 'Usuario (@)', 'Contraseña', 'Entrar en'].map(head),
    ...rows.map((r) => [
      r.fullName,
      r.career,
      themeOf(themeKey).name,
      r.culture,
      PASSPORT_ROLE_LABEL[r.role],
      `@${r.username}`,
      r.password || '(ya tenía)',
      'carreapp.vercel.app',
    ]),
  ]
}

/** The new password of every person is shown once: this is the only moment it can be put in the sheet. */
export async function credentialsWorkbook(rows: CredentialRow[], termName: string, themeKey: string): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(credentialsData(rows, themeKey), {
    sheet: `Pasaportes ${termName}`.slice(0, 31),
    columns: [{ width: 34 }, { width: 26 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 28 }, { width: 22 }, { width: 22 }],
    stickyRowsCount: 1,
  }).toBlob()
}

export const TEMPLATE_DATA = [
  ['Nombre', 'Carrera', 'Rol (opcional)'].map(head),
  ['Ana María Pérez Gómez', 'Ingeniería de Sistemas', 'Corredor'],
  ['Luis Fernando Ruiz', 'Ingeniería Civil', 'Base'],
  ['Camila Torres Vega', 'Bioingeniería', ''],
]

export async function templateWorkbook(): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(TEMPLATE_DATA, { sheet: 'Inductores', columns: [{ width: 36 }, { width: 28 }, { width: 18 }], stickyRowsCount: 1 }).toBlob()
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const newPassword = () => generatePassword()
export const cultureName = (theme: string, culture: string | null) => cultureOf(theme, culture).name
export { key as nameKey }
