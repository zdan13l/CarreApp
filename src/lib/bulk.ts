// Bulk upload: reads a Word / Excel / CSV file (fixed format) with everything needed to start a
// Carrera and validates it. Pure functions, no network: the screen shows the result before
// anything is created. EVERY section is optional; the file can have any subset of them.
//
//   Carrera   : Dato | Valor                      (nombre de la Carrera, tiempo máximo general)
//   Grupos    : Nombre del grupo
//   Bases     : Nombre de la base | Información | Pregunta 1 | Pregunta 2 | Pregunta 3 | Latitud | Longitud
//   Personas  : Nombre completo | Rol | Grupo o base | Usuario | GPS | Contraseña
//   Cruces    : Ronda | Base | Grupo A | Grupo B
//   Tiempos   : Desde | Hasta | Minutos
//
// In Word each section is a table; in Excel each section is a sheet; a CSV holds one section.
// Tables are recognised by their column titles, so their order and any text around them is free.
import { generatePassword } from './password'
import { normalizeUsername, suggestUsername, USERNAME_PATTERN } from './username'

export type BulkRole = 'runner' | 'base'

export interface BulkRow {
  line: number // line in the table (the header is line 1)
  fullName: string
  username: string
  role: BulkRole | null
  assignment: string // team name (runner) or base name (inductor)
  gps: boolean
  password: string
  errors: string[]
}

interface RowBase {
  line: number
  errors: string[]
}
export interface CarreraIn {
  name: string
  maxMinutes: number | null
  errors: string[]
}
export interface GrupoIn extends RowBase {
  name: string
}
export interface BaseIn extends RowBase {
  name: string
  info: string
  questions: string[] // up to 3, blanks removed
  lat: number | null
  lng: number | null
}
export interface MatchIn extends RowBase {
  round: number
  base: string
  teamA: string
  teamB: string
}
export interface LegIn extends RowBase {
  from: string
  to: string
  minutes: number
}

export interface ParsedFile {
  carrera: CarreraIn | null
  grupos: GrupoIn[]
  bases: BaseIn[]
  personas: BulkRow[]
  cruces: MatchIn[]
  tiempos: LegIn[]
  notes: string[] // tables that were not recognised, etc.
}

const emptyFile = (): ParsedFile => ({ carrera: null, grupos: [], bases: [], personas: [], cruces: [], tiempos: [], notes: [] })

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 .,]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()

// Collapses spaces and accents so "Dioses  Griegos" and "dioses griegos" are the same name.
export const nameKey = (name: string) => fold(name).replace(/[.,]/g, '').replace(/ +/g, ' ').trim()

const headerKey = (h: string) => fold(h).replace(/[.,]/g, '').replace(/opcional/g, '').replace(/ +/g, ' ').trim()

type Section = 'carrera' | 'grupos' | 'bases' | 'personas' | 'cruces' | 'tiempos'

// What kind of table is this? Decided by its column titles.
export function classifyTable(header: string[]): Section | null {
  const h = header.map(headerKey).filter(Boolean)
  const has = (...names: string[]) => names.some((n) => h.includes(n))
  if (has('dato', 'campo') && has('valor')) return 'carrera'
  if (has('ronda') && has('grupo a', 'equipo a')) return 'cruces'
  if (has('desde', 'origen') && has('hasta', 'destino')) return 'tiempos'
  if (has('rol', 'tipo') && has('nombre completo', 'nombre', 'persona')) return 'personas'
  if (has('nombre de la base', 'base') && has('informacion', 'pregunta 1', 'latitud')) return 'bases'
  if (has('nombre del grupo', 'grupo', 'equipo', 'nombre de grupo') && h.length <= 2) return 'grupos'
  return null
}

function index(header: string[], names: string[]): number {
  return header.map(headerKey).findIndex((x) => names.includes(x))
}

const cellAt = (row: string[], i: number) => (i < 0 ? '' : (row[i] ?? '').trim())
const spaces = (s: string) => s.replace(/\s+/g, ' ').trim()

function toNumber(raw: string): number | null {
  const v = raw.trim().replace(',', '.')
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

export function parseRole(raw: string): BulkRole | null {
  const v = nameKey(raw)
  if (['corredor', 'corredora', 'runner', 'corredores'].includes(v)) return 'runner'
  if (['base', 'inductor', 'inductora', 'inductor de base', 'inductores', 'inductor base'].includes(v)) return 'base'
  return null
}

const truthy = (raw: string) => ['si', 'x', '1', 'true', 'yes', 'y', 'verdadero'].includes(nameKey(raw))

// ---------- Section readers ----------

function readPersonas(table: string[][]): BulkRow[] {
  const header = table[0]
  const col = {
    fullName: index(header, ['nombre completo', 'nombre', 'persona', 'nombres']),
    username: index(header, ['usuario', 'username', 'user']),
    role: index(header, ['rol', 'tipo', 'cargo']),
    assignment: index(header, ['grupo o base', 'grupo base', 'asignacion', 'asignado a', 'grupo', 'base', 'equipo']),
    gps: index(header, ['gps', 'transmite gps', 'gps si no']),
    password: index(header, ['contrasena', 'clave', 'password']),
  }
  return table.slice(1).map<BulkRow>((r, i) => {
    const role = parseRole(cellAt(r, col.role))
    const row: BulkRow = {
      line: i + 2,
      fullName: spaces(cellAt(r, col.fullName)),
      username: normalizeUsername(cellAt(r, col.username)),
      role,
      assignment: spaces(cellAt(r, col.assignment)),
      gps: truthy(cellAt(r, col.gps)),
      password: cellAt(r, col.password),
      errors: [],
    }
    if (col.assignment < 0) row.errors.push('Falta la columna "Grupo o base".')
    if (!row.fullName) row.errors.push('Falta el nombre.')
    if (!role) row.errors.push(`Rol no válido ("${cellAt(r, col.role)}"). Usa "Corredor" o "Base".`)
    if (col.assignment >= 0 && !row.assignment) row.errors.push(role === 'base' ? 'Falta la base.' : 'Falta el grupo.')
    if (row.username && !USERNAME_PATTERN.test(row.username)) {
      row.errors.push('Usuario no válido: 3 a 30 caracteres, letras minúsculas, números, punto, guion o guion bajo.')
    }
    if (row.password && row.password.length < 6) row.errors.push('La contraseña debe tener al menos 6 caracteres.')
    if (row.gps && role === 'base') row.errors.push('La columna GPS solo aplica a corredores.')
    return row
  })
}

function readGrupos(table: string[][]): GrupoIn[] {
  const c = index(table[0], ['nombre del grupo', 'nombre de grupo', 'grupo', 'equipo'])
  return table.slice(1).map((r, i) => {
    const name = spaces(cellAt(r, c))
    return { line: i + 2, name, errors: name ? [] : ['Falta el nombre del grupo.'] }
  })
}

function readBases(table: string[][]): BaseIn[] {
  const h = table[0]
  const col = {
    name: index(h, ['nombre de la base', 'nombre de base', 'base', 'nombre']),
    info: index(h, ['informacion', 'informacion que se da', 'informacion de la base']),
    q: [1, 2, 3].map((n) => index(h, [`pregunta ${n}`, `pregunta${n}`, `p${n}`])),
    lat: index(h, ['latitud', 'lat']),
    lng: index(h, ['longitud', 'lng', 'lon']),
  }
  return table.slice(1).map((r, i) => {
    const row: BaseIn = {
      line: i + 2,
      name: spaces(cellAt(r, col.name)),
      info: cellAt(r, col.info),
      questions: col.q.map((c) => spaces(cellAt(r, c))).filter(Boolean),
      lat: null,
      lng: null,
      errors: [],
    }
    if (!row.name) row.errors.push('Falta el nombre de la base.')
    const lat = toNumber(cellAt(r, col.lat))
    const lng = toNumber(cellAt(r, col.lng))
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) row.errors.push('La latitud debe ser un número entre -90 y 90.')
    else row.lat = lat
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) row.errors.push('La longitud debe ser un número entre -180 y 180.')
    else row.lng = lng
    if ((row.lat === null) !== (row.lng === null)) row.errors.push('Escribe la latitud y la longitud juntas, o ninguna.')
    return row
  })
}

function readCruces(table: string[][]): MatchIn[] {
  const h = table[0]
  const col = {
    round: index(h, ['ronda']),
    base: index(h, ['base']),
    a: index(h, ['grupo a', 'equipo a']),
    b: index(h, ['grupo b', 'equipo b']),
  }
  return table.slice(1).map((r, i) => {
    const round = Number(cellAt(r, col.round))
    const row: MatchIn = {
      line: i + 2,
      round,
      base: spaces(cellAt(r, col.base)),
      teamA: spaces(cellAt(r, col.a)),
      teamB: spaces(cellAt(r, col.b)),
      errors: [],
    }
    if (!Number.isInteger(round) || round < 1) row.errors.push('La ronda debe ser un número entero desde 1.')
    if (!row.base) row.errors.push('Falta la base.')
    if (!row.teamA || !row.teamB) row.errors.push('Faltan los dos grupos del cruce.')
    return row
  })
}

function readTiempos(table: string[][]): LegIn[] {
  const h = table[0]
  const col = {
    from: index(h, ['desde', 'origen']),
    to: index(h, ['hasta', 'destino']),
    minutes: index(h, ['minutos', 'tiempo', 'tiempo minutos', 'min']),
  }
  return table.slice(1).map((r, i) => {
    const minutes = Number(cellAt(r, col.minutes))
    const row: LegIn = { line: i + 2, from: spaces(cellAt(r, col.from)), to: spaces(cellAt(r, col.to)), minutes, errors: [] }
    if (!row.from || !row.to) row.errors.push('Faltan las bases del tramo (Desde y Hasta).')
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) row.errors.push('Los minutos deben ser un número entero entre 1 y 180.')
    return row
  })
}

function readCarrera(table: string[][]): CarreraIn {
  const out: CarreraIn = { name: '', maxMinutes: null, errors: [] }
  for (const r of table.slice(1)) {
    const key = headerKey(r[0] ?? '')
    const value = (r[1] ?? '').trim()
    if (key.includes('nombre') || key === 'carrera') out.name = spaces(value)
    else if (key.includes('tiempo') || key.includes('minutos') || key.includes('traslado')) {
      if (value !== '') {
        const n = Number(value)
        if (Number.isInteger(n) && n >= 1 && n <= 120) out.maxMinutes = n
        else out.errors.push('El tiempo máximo debe ser un número entero entre 1 y 120.')
      }
    }
  }
  if (!out.name) out.errors.push('Falta el nombre de la Carrera.')
  return out
}

// All the tables of a file -> everything it contains.
export function parseTables(tables: string[][][]): ParsedFile {
  const file = emptyFile()
  for (const raw of tables) {
    const table = raw.map((r) => r.map((c) => (c ?? '').toString().trim())).filter((r) => r.some((c) => c !== ''))
    if (table.length === 0) continue
    const kind = classifyTable(table[0])
    if (!kind) {
      file.notes.push(`Se ignoró una tabla que no se reconoce (columnas: ${table[0].filter(Boolean).join(', ') || 'vacías'}).`)
      continue
    }
    if (kind === 'carrera') file.carrera = readCarrera(table)
    else if (kind === 'grupos') file.grupos.push(...readGrupos(table))
    else if (kind === 'bases') file.bases.push(...readBases(table))
    else if (kind === 'personas') file.personas.push(...readPersonas(table))
    else if (kind === 'cruces') file.cruces.push(...readCruces(table))
    else file.tiempos.push(...readTiempos(table))
  }
  return file
}

// ---------- Validation across the whole file ----------

export interface ExistingData {
  usernames: Set<string>
  teams: Set<string> // nameKey of teams that already exist in the target Carrera
  bases: Set<string>
  matches: { round: number; base: string; a: string; b: string }[] // nameKeys, already in the Carrera
}

// Fills in missing usernames and passwords and checks duplicates (inside the file and against the
// users that already exist). Returns new rows; does not touch the input.
export function completeRows(rows: BulkRow[], existingUsernames: Set<string>): BulkRow[] {
  const taken = new Set(existingUsernames)
  const out = rows.map((r) => ({ ...r, errors: [...r.errors] }))

  // Explicit usernames first, so generated ones never steal them.
  const explicitSeen = new Set<string>()
  for (const r of out) {
    if (!r.username || !USERNAME_PATTERN.test(r.username)) continue
    if (existingUsernames.has(r.username)) r.errors.push(`El usuario "${r.username}" ya existe (los usuarios son únicos en todas las Carreras: usa otro, por ejemplo con el año).`)
    else if (explicitSeen.has(r.username)) r.errors.push(`El usuario "${r.username}" está repetido en el archivo.`)
    explicitSeen.add(r.username)
    taken.add(r.username)
  }
  for (const r of out) {
    if (!r.username && r.fullName) {
      let base = suggestUsername(r.fullName) || 'usuario'
      while (base.length < 3) base += '1'
      base = base.slice(0, 26)
      let candidate = base
      for (let n = 2; taken.has(candidate); n++) candidate = `${base}${n}`
      r.username = candidate
      taken.add(candidate)
    }
    if (!r.password) r.password = generatePassword()
  }

  // A person listed twice would be created twice.
  const names = new Map<string, number>()
  for (const r of out) {
    const key = nameKey(r.fullName)
    if (key) names.set(key, (names.get(key) ?? 0) + 1)
  }
  for (const r of out) {
    if ((names.get(nameKey(r.fullName)) ?? 0) > 1) r.errors.push('Esta persona aparece más de una vez en el archivo.')
  }
  return out
}

// Adds the errors that need the whole picture: duplicates, names that do not exist anywhere,
// repeated matchups, a team or base used twice in a round, and so on.
export function validateFile(parsed: ParsedFile, existing: ExistingData): ParsedFile {
  const file: ParsedFile = {
    ...parsed,
    carrera: parsed.carrera ? { ...parsed.carrera, errors: [...parsed.carrera.errors] } : null,
    grupos: parsed.grupos.map((r) => ({ ...r, errors: [...r.errors] })),
    bases: parsed.bases.map((r) => ({ ...r, errors: [...r.errors] })),
    cruces: parsed.cruces.map((r) => ({ ...r, errors: [...r.errors] })),
    tiempos: parsed.tiempos.map((r) => ({ ...r, errors: [...r.errors] })),
    personas: completeRows(parsed.personas, existing.usernames),
  }

  const dupes = <T extends { name: string; errors: string[] }>(rows: T[], what: string) => {
    const seen = new Set<string>()
    for (const r of rows) {
      const k = nameKey(r.name)
      if (!k) continue
      if (seen.has(k)) r.errors.push(`${what} "${r.name}" está repetido en el archivo.`)
      seen.add(k)
    }
  }
  dupes(file.grupos, 'El grupo')
  dupes(file.bases, 'La base')

  // Names that will exist once the file is imported.
  const teams = new Set(existing.teams)
  const bases = new Set(existing.bases)
  file.grupos.forEach((g) => g.name && teams.add(nameKey(g.name)))
  file.bases.forEach((b) => b.name && bases.add(nameKey(b.name)))
  for (const p of file.personas) {
    if (!p.assignment) continue
    if (p.role === 'runner') teams.add(nameKey(p.assignment))
    else if (p.role === 'base') bases.add(nameKey(p.assignment))
  }

  // Matches: no repeated pair, a team plays once per round, a base hosts one match per round.
  const pairs = new Set(existing.matches.map((m) => [m.a, m.b].sort().join('|')))
  const teamRound = new Set(existing.matches.flatMap((m) => [`${m.round}|${m.a}`, `${m.round}|${m.b}`]))
  const baseRound = new Set(existing.matches.map((m) => `${m.round}|${m.base}`))
  for (const m of file.cruces) {
    const a = nameKey(m.teamA)
    const b = nameKey(m.teamB)
    const base = nameKey(m.base)
    if (m.base && !bases.has(base)) m.errors.push(`La base "${m.base}" no existe: agrégala en Bases o en Personas.`)
    for (const [raw, k] of [[m.teamA, a], [m.teamB, b]] as const) {
      if (raw && !teams.has(k)) m.errors.push(`El grupo "${raw}" no existe: agrégalo en Grupos o en Personas.`)
    }
    if (a && a === b) m.errors.push('Un grupo no puede enfrentarse a sí mismo.')
    if (a && b && a !== b) {
      const pair = [a, b].sort().join('|')
      if (pairs.has(pair)) m.errors.push(`${m.teamA} y ${m.teamB} ya se enfrentan en otra fila o ronda.`)
      pairs.add(pair)
      for (const k of [a, b]) {
        if (teamRound.has(`${m.round}|${k}`)) m.errors.push(`Un grupo ya juega en la ronda ${m.round} (no puede estar en dos bases a la vez).`)
        teamRound.add(`${m.round}|${k}`)
      }
    }
    if (base && baseRound.has(`${m.round}|${base}`)) m.errors.push(`La base "${m.base}" ya tiene un cruce en la ronda ${m.round}.`)
    if (base) baseRound.add(`${m.round}|${base}`)
  }

  // Travel times between bases.
  const legs = new Set<string>()
  for (const l of file.tiempos) {
    const from = nameKey(l.from)
    const to = nameKey(l.to)
    if (l.from && !bases.has(from)) l.errors.push(`La base "${l.from}" no existe.`)
    if (l.to && !bases.has(to)) l.errors.push(`La base "${l.to}" no existe.`)
    if (from && from === to) l.errors.push('El tramo debe ir entre dos bases distintas.')
    if (from && to) {
      if (legs.has(`${from}>${to}`)) l.errors.push('Este tramo está repetido en el archivo.')
      legs.add(`${from}>${to}`)
    }
  }
  return file
}

export function countErrors(file: ParsedFile): number {
  const rows = [...file.grupos, ...file.bases, ...file.personas, ...file.cruces, ...file.tiempos]
  return rows.filter((r) => r.errors.length > 0).length + (file.carrera && file.carrera.errors.length > 0 ? 1 : 0)
}

export function isEmpty(file: ParsedFile): boolean {
  return (
    !file.carrera &&
    file.grupos.length + file.bases.length + file.personas.length + file.cruces.length + file.tiempos.length === 0
  )
}

// ---------- Reading the files ----------

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()

// Word: mammoth turns the .docx into HTML; every <table> is a section.
export function tablesFromHtml(html: string): string[][][] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((t) =>
    [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
      [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])),
    ),
  )
}

// CSV (comma or semicolon, quotes allowed).
export function tableFromCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export async function readTablesFromFile(file: File): Promise<string[][][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return tablesFromHtml(value)
  }
  if (name.endsWith('.xlsx')) {
    const { default: readXlsx } = await import('read-excel-file/browser')
    const sheets = (await readXlsx(file)).filter((s) => !/^instruccion/i.test(s.sheet)) // every other sheet is a section
    return sheets.map((s) => s.data.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)))))
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) return [tableFromCsv(await file.text())]
  throw new Error('Formato no admitido. Usa un archivo .docx (Word), .xlsx (Excel) o .csv.')
}
