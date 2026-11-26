// The personal passport of each inductor: types, the Excel the coordinator uploads (names and careers) and the Excel the app returns
// (the @ and the password of every person). Pure functions where possible: the screen shows a preview before anything is created.
import type { PassportSong } from './songs'
import { generatePassword } from './password'
import { cultureOf } from './themes'
import { USERNAME_PATTERN } from './username'

export type PassportRole = 'runner' | 'base' | 'coordinator'
export const PASSPORT_ROLES: PassportRole[] = ['runner', 'base', 'coordinator']
export const PASSPORT_ROLE_LABEL: Record<PassportRole, string> = { runner: 'Corredor', base: 'Base', coordinator: 'Coordi' }
export const PASSPORT_ROLE_LONG: Record<PassportRole, string> = { runner: 'Corredor', base: 'Inductor de base', coordinator: 'Coordi de carrera' }

export interface TermRow {
  id: string
  name: string
  theme: string
  is_current: boolean
  welcome?: string | null // the words of the coordinators to their inductors in this induction (migration 0025)
}

/** The words of one committee in one induction. */
export interface TermCommitteeRow {
  term_id: string
  committee: string
  message: string
}

export interface PassportPerson {
  id: string
  username: string
  full_name: string
  photo_path: string | null
  // migration 0024: the coordinator sets generation, entry and nickname
  nickname?: string | null
  song?: PassportSong | null // migration 0042: the song that characterises the person (a 30 s preview), read apart so the passport opens without it
  generation?: string | null
  joined_term?: string | null // migration 0043: it comes from the generation (the semester it entered)
  career?: string | null // migration 0043: the career of the person (one for their whole life in the induction), read apart so the list opens without it
  second_career?: string | null // migration 0044: the other career of a double program (read apart, like the first)
  inductions?: number | null // migration 0044 (view passport_inductions): how many inductions they have taken part in; null while the view does not exist
  prior_inductions?: number | null // migration 0045: the inductions they already had before CarreApp (fixed; the carreras they join add to it), read apart
  // migration 0035: an ancestor (left the induction) keeps their passport until `disable_at`, then it is disabled
  status?: 'active' | 'ancestor' | 'disabled'
  ancestor_at?: string | null
  disable_at?: string | null
}

/** The columns of the passport, with and without the ones of migration 0024 (the app keeps working until it is applied). */
export const PERSON_COLUMNS = 'id, username, full_name, photo_path, nickname, generation, joined_term, status, ancestor_at, disable_at'
export const PERSON_COLUMNS_BASE = 'id, username, full_name, photo_path'
export const RECORD_COLUMNS = 'id, passport_id, term_id, role, career, culture, team_id, base_id, committee, committee_lead, extra_committees, extra_leads'
/** The columns before migration 0027 (the extra committees). */
export const RECORD_COLUMNS_0024 = 'id, passport_id, term_id, role, career, culture, team_id, base_id, committee, committee_lead'
export const RECORD_COLUMNS_BASE = 'id, passport_id, term_id, role, career, culture, team_id, base_id'
/** True when a request failed because a column of migration 0024 does not exist yet. */
export const missingColumn = (e: { code?: string; message?: string } | null | undefined) => Boolean(e && (e.code === '42703' || /column .* does not exist|schema cache/i.test(e.message ?? '')))

export interface PassportRecordRow {
  id: string
  passport_id: string
  term_id: string
  role: PassportRole
  career: string
  culture: string
  team_id: string | null
  base_id: string | null
  committee?: string | null // one of the five committees (migration 0024)
  committee_lead?: boolean // the coordinator of the committee: golden stamp
  extra_committees?: string[] // the other committees they belong to (migration 0027)
  extra_leads?: string[] // the ones of those they coordinate: golden stamp
  disabled?: boolean // migration 0044: disabled in this induction (it does not count as one of theirs and they have no group or base)
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
  base_photo_path?: string | null // migration 0025
  event_id: string | null
  event_name: string | null
  event_active: boolean
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** "PUJ-483920": the number of the identity page of a person, the same for their whole life in the induction (decorative, from the id). */
export function personNumber(personId: string): string {
  return `PUJ-${String(hash(personId) % 1000000).padStart(6, '0')}`
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
 * "Camila Andrea Rojas Prieto" -> "camila.rojas": the first name and the first surname. With three words the last one is the
 * surname ("Ana Pardo Ruiz" -> "ana.ruiz"). When it is taken ("juan.sanchez") the initial of the second name is added
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

const key = (s: string) => plain(s.replace(/\(.*?\)/g, '')).join(' ') // "Rol (opcional)" is the column "rol"

// ---------- the Excel that goes out ----------

export interface CredentialRow {
  fullName: string
  career: string
  secondCareer?: string
  generation: string
  username: string
  password: string // empty when the person already had a login
}

const head = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#062a5c', textColor: '#ffffff' })

/** The rows of the Excel that goes out (a header and one line per person). Pure, so it can be checked without a browser. */
export function credentialsData(rows: CredentialRow[]) {
  return [
    ['Nombre', 'Carrera', 'Otra carrera', 'Generación', 'Usuario (@)', 'Contraseña', 'Entrar en'].map(head),
    ...rows.map((r) => [r.fullName, r.career, r.secondCareer ?? '', r.generation, `@${r.username}`, r.password || '(ya tenía)', 'carreapp.vercel.app']),
  ]
}

/** The new password of every person is shown once: this is the only moment it can be put in the sheet. */
export async function credentialsWorkbook(rows: CredentialRow[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(credentialsData(rows), {
    sheet: 'Inductores',
    columns: [{ width: 34 }, { width: 28 }, { width: 28 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 22 }],
    stickyRowsCount: 1,
  }).toBlob()
}

/** The song column of the template is the question of the induction's form, so the answers can be pasted as they come. */
export const SONG_COLUMN = '¿Qué canción sonaría cada vez que entraras a un lugar? (opcional)'

/** The template of the bulk upload; the examples use the careers and generations of the catalog so they load as they are. */
export function templateData(careers: string[], generations: string[]) {
  const career = (i: number) => careers[i] ?? careers[0] ?? 'Ingeniería de Sistemas'
  const generation = generations[0] ?? 'Minichips'
  return [
    ['Nombre', 'Usuario (@)', 'Carrera', 'Otra carrera (opcional)', 'Generación', 'Inducciones previas (opcional)', 'Apodo', SONG_COLUMN].map(head),
    ['Ana María Pérez Gómez', 'ana.perez', career(0), '', generation, '0', 'Anita', 'Mujeriego - Ryan Castro'],
    ['Luis Fernando Ruiz', 'luis.ruiz', career(1), '', generation, '3', 'Lucho', 'https://music.apple.com/us/song/comernos/1804988448'],
    ['Camila Torres Vega', 'camila.torres', career(2), careers[3] ?? '', generations[1] ?? generation, '8', 'Cami', ''],
  ]
}

export async function templateWorkbook(careers: string[], generations: string[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  return writeXlsxFile(templateData(careers, generations), { sheet: 'Inductores', columns: [{ width: 36 }, { width: 22 }, { width: 30 }, { width: 30 }, { width: 18 }, { width: 24 }, { width: 18 }, { width: 52 }], stickyRowsCount: 1 }).toBlob()
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
