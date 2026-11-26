// The inductors of the global list: what is needed to register one (career, generation, nickname, song), to search and filter the list, and to
// read the Excel of a whole induction at once. Pure functions first (they are tested without a browser), then the one place that creates a login.
import { nameKey, passportUsername, newPassword, type PassportPerson, type PassportRecordRow } from './passports'
import { readTablesFromFile } from './bulk'
import { generationsOf, GENERATIONS } from './seals'
import { appleTrack, isSongLink, type PassportSong } from './songs'
import { createPassportUser, deleteUser } from './usersApi'
import { USERNAME_PATTERN } from './username'
import { supabase } from './supabase'

const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// ---------- generation and entry ----------

/** The semester a person entered the induction: the one of their (first) generation, e.g. Barbies → 2630. null when the generation has none. */
export const entryOf = (generation: string | null | undefined): string | null => generationsOf(generation)[0]?.term ?? null

// ---------- the career ----------

/** The career of the catalog a written one means: the same name, or the one that contains it / is contained (the longest). null when none. */
export function matchCareer(text: string, catalog: string[]): string | null {
  const t = plain(text)
  if (!t) return null
  const exact = catalog.find((c) => plain(c) === t)
  if (exact) return exact
  const near = catalog.filter((c) => t.includes(plain(c)) || plain(c).includes(t)).sort((a, b) => plain(b).length - plain(a).length)
  return near[0] ?? null
}

/** «Ingeniería de Sistemas» → «Sistemas»: the short name that fits in a filter chip. */
export const shortCareer = (career: string) => career.replace(/^ingenier[ií]a\s+(de\s+|en\s+)?/i, '').trim() || career

// ---------- the list: search and filters ----------

export type PersonState = 'active' | 'ancestor' | 'disabled'
export const STATE_LABEL: Record<PersonState, string> = { active: 'Activos', ancestor: 'Ancestros', disabled: 'Deshabilitados' }

/** The career of a person: the one saved in their passport (0043) or, before it, the one of their latest participation. */
export function careerOfPerson(p: PassportPerson, latest?: string | null): string | null {
  return p.career?.trim() || latest?.trim() || null
}

/** Every word the person can be found by: name, nickname, career, generation and the parts of the @. */
function words(p: PassportPerson, career: string | null): string[] {
  return plain(`${p.full_name} ${p.nickname ?? ''} ${career ?? ''} ${p.generation ?? ''} ${p.username.replace(/[._-]/g, ' ')}`).split(' ').filter(Boolean)
}

/** Each typed word has to START a word of the person («ana» finds Ana and not Mariana); the @ also matches whole («ana.ruiz»). */
export function matchesSearch(p: PassportPerson, career: string | null, query: string): boolean {
  const q = plain(query)
  if (!q) return true
  const hay = words(p, career)
  if (query.trim().toLowerCase().includes('@') || /[._-]/.test(query.trim())) {
    const raw = query.trim().toLowerCase().replace(/^@/, '')
    if (p.username.includes(raw)) return true
  }
  return q.split(' ').every((token) => hay.some((w) => w.startsWith(token)))
}

export interface Filters {
  careers: string[]
  states: PersonState[]
  roles: string[]
}
export const NO_FILTERS: Filters = { careers: [], states: [], roles: [] }
export const hasFilters = (f: Filters) => f.careers.length + f.states.length + f.roles.length > 0

/** Inside a group the chosen ones add up (Sistemas OR Civil); between groups they narrow down (ancestors AND Sistemas). */
export function passesFilters(f: Filters, person: { state: PersonState; career: string | null; role?: string | null }): boolean {
  if (f.states.length && !f.states.includes(person.state)) return false
  if (f.careers.length && !(person.career && f.careers.includes(person.career))) return false
  if (f.roles.length && !(person.role && f.roles.includes(person.role))) return false
  return true
}

/** The latest career of each person according to their participation (before migration 0043 this is all there is). */
export function latestCareers(records: Pick<PassportRecordRow, 'passport_id' | 'career'>[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of records) out.set(r.passport_id, r.career) // records come oldest first, so the last one wins
  return out
}

// ---------- the Excel of a whole induction ----------

export interface InductorIn {
  line: number
  fullName: string
  careerWritten: string
  career: string | null // the one of the catalog (null: the coordi has to choose)
  generation: string // exact names of the catalog, « / »-joined ('' = the coordi has to choose)
  nickname: string
  songWritten: string
  username: string
  existing: boolean // already registered: only the song is applied
  errors: string[]
}

export interface InductorsContext {
  careers: string[] // the careers of the catalog; empty = anything goes
  usernames: Set<string>
  known: Map<string, string> // normalised name → @ of the people already registered
  defaultGeneration: string // used by the rows that do not say one
}

/** Finds the table with a «Nombre» column and a «Carrera» or a song column (the form of the induction has both). */
export function inductorsTable(tables: string[][][]): { header: string[]; rows: string[][] } | null {
  for (const t of tables) {
    const hi = t.findIndex((r) => {
      const h = r.map((c) => plain(String(c ?? '').replace(/\(.*?\)/g, '')))
      return h.includes('nombre') && (h.includes('carrera') || h.some((x) => x.includes('cancion')))
    })
    if (hi >= 0) return { header: t[hi], rows: t.slice(hi + 1) }
  }
  return null
}

export function parseInductors(tables: string[][][], ctx: InductorsContext): InductorIn[] {
  const table = inductorsTable(tables)
  if (!table) throw new Error('No se encontró la tabla. El Excel necesita la columna «Nombre» y la de «Carrera» (usa la plantilla).')
  const heads = table.header.map((c) => plain(String(c ?? '').replace(/\(.*?\)/g, '')))
  const at = (name: string) => heads.indexOf(name)
  const [iName, iCareer, iGen, iNick, iUser] = [at('nombre'), at('carrera'), at('generacion'), at('apodo'), at('usuario')]
  const iSong = heads.findIndex((h) => h.includes('cancion'))
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').replace(/\s+/g, ' ').trim() : '')
  const taken = new Set(ctx.usernames)
  const seen = new Set<string>()
  const out: InductorIn[] = []
  table.rows.forEach((r, i) => {
    const fullName = cell(r, iName)
    if (!fullName) return
    const errors: string[] = []
    const knownUser = ctx.known.get(nameKey(fullName))
    const careerWritten = cell(r, iCareer)
    const career = ctx.careers.length ? matchCareer(careerWritten, ctx.careers) : careerWritten || null
    let generation = cell(r, iGen)
    if (generation) {
      const parts = generation.split(/[/,+]/).map((x) => x.trim()).filter(Boolean)
      const found = generationsOf(generation)
      if (found.length !== parts.length) errors.push(`La generación «${generation}» no existe (${GENERATIONS.map((g) => g.name).join(', ')}).`)
      else generation = found.map((g) => g.name).join(' / ')
    } else generation = ctx.defaultGeneration
    const nickname = cell(r, iNick)
    if (nickname.length > 24) errors.push('El apodo es muy largo (máximo 24 letras).')
    if (seen.has(nameKey(fullName))) errors.push('Esta persona está repetida en el archivo.')
    seen.add(nameKey(fullName))
    let username = knownUser ?? ''
    if (!username) {
      const wanted = cell(r, iUser).toLowerCase().replace(/^@/, '')
      if (wanted) {
        if (!USERNAME_PATTERN.test(wanted)) errors.push('El usuario debe tener 3-30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
        else if (taken.has(wanted)) errors.push(`El usuario @${wanted} ya existe.`)
        else taken.add(wanted)
        username = wanted
      } else username = passportUsername(fullName, taken)
    }
    out.push({ line: i + 2, fullName, careerWritten, career, generation, nickname, songWritten: cell(r, iSong), username, existing: Boolean(knownUser), errors })
  })
  if (out.length === 0) throw new Error('La tabla no tiene personas.')
  return out
}

export async function readInductorsFile(file: File, ctx: InductorsContext): Promise<InductorIn[]> {
  return parseInductors(await readTablesFromFile(file), ctx)
}

/** Why a row cannot be created yet (empty = ready). A person that already exists only needs a song. */
export function rowProblem(r: InductorIn): string | null {
  if (r.errors.length) return r.errors[0]
  if (r.existing) return null
  if (!r.career) return 'Elige la carrera.'
  if (!r.generation) return 'Elige la generación.'
  return null
}

/** The song text of a row as something that can be searched: empty when they wrote none or a link that is not Apple Music (the coordi searches it by hand). */
export const songSearchOf = (r: InductorIn) => (r.songWritten && !(isSongLink(r.songWritten) && !appleTrack(r.songWritten)) ? r.songWritten : '')

// ---------- the one place that creates a login ----------

export interface NewInductor {
  fullName: string
  career: string
  generation: string
  nickname?: string
  song?: PassportSong | null
  username?: string // the @ the preview of the Excel already showed
}

/** Creates the login and the passport data of one inductor; undoes the login when the data is refused, so nobody is left half made. */
export async function createInductor(input: NewInductor, usernames: Set<string>): Promise<{ id: string; username: string; password: string }> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const username = input.username ?? passportUsername(input.fullName, usernames)
  const password = newPassword()
  const id = (await createPassportUser({ username, password, full_name: input.fullName })).id
  if (!id) throw new Error('No se pudo crear el usuario.')
  const entry = entryOf(input.generation)
  const data = {
    career: input.career,
    generation: input.generation,
    ...(entry ? { joined_term: entry } : {}),
    ...(input.nickname ? { nickname: input.nickname } : {}),
    ...(input.song ? { song: input.song } : {}),
  }
  const { error } = await supabase.from('passports').update(data).eq('id', id)
  if (error) {
    await deleteUser(id).catch(() => undefined)
    throw new Error(/column .*career|schema cache/i.test(error.message) ? 'Falta aplicar la migración 0043 (la carrera de cada persona).' : /column .*song/i.test(error.message) ? 'Falta aplicar la migración 0042 (la canción).' : error.message || 'No se pudieron guardar los datos del inductor.')
  }
  return { id, username, password }
}

// ---------- editing a profile ----------

export interface IdentityPatch {
  status?: PersonState
  ancestor_at?: string | null
  disable_at?: string | null
  full_name?: string
  career?: string | null
  generation?: string | null
  joined_term?: string | null
  nickname?: string | null
  song?: PassportSong | null
}

/** What changed between a person and the profile the coordi edited. A new generation brings its entry with it. Empty when nothing changed. */
export function profileChanges(p: PassportPerson, career: string | null, draft: { fullName: string; career: string; generation: string; nickname: string; song: PassportSong | null }): IdentityPatch {
  const patch: IdentityPatch = {}
  const name = draft.fullName.trim().replace(/\s+/g, ' ')
  if (name && name !== p.full_name) patch.full_name = name
  if ((draft.career || null) !== (career ?? null)) patch.career = draft.career || null
  if ((draft.generation || null) !== (p.generation ?? null)) {
    patch.generation = draft.generation || null
    const entry = entryOf(draft.generation)
    if (entry) patch.joined_term = entry
  }
  if ((draft.nickname.trim() || null) !== (p.nickname ?? null)) patch.nickname = draft.nickname.trim() || null
  if ((draft.song?.preview ?? null) !== (p.song?.preview ?? null)) patch.song = draft.song
  return patch
}
