// Bulk upload: reads the table of a Word / Excel / CSV file (fixed format) and validates it.
// Pure functions, no network: the screen shows the result before anything is created.
//
// Expected columns (the order does not matter, accents and capitals are ignored):
//   Nombre completo | Rol | Grupo o base | Usuario (optional) | GPS (optional) | Contraseña (optional)
import { generatePassword } from './password'
import { normalizeUsername, suggestUsername, USERNAME_PATTERN } from './username'

export type BulkRole = 'runner' | 'base'

export interface BulkRow {
  line: number // line in the file (the header is line 1)
  fullName: string
  username: string
  role: BulkRole | null
  assignment: string // team name (runner) or base name (inductor)
  gps: boolean
  password: string
  errors: string[]
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

type Field = 'fullName' | 'username' | 'role' | 'assignment' | 'gps' | 'password'
const HEADERS: Record<Field, string[]> = {
  fullName: ['nombre', 'nombre completo', 'nombres', 'persona'],
  username: ['usuario', 'username', 'user'],
  role: ['rol', 'tipo', 'cargo'],
  assignment: ['grupo o base', 'grupo', 'base', 'asignacion', 'asignado a', 'equipo', 'grupo base'],
  gps: ['gps', 'transmite gps', 'ubicacion', 'gps si no'],
  password: ['contrasena', 'clave', 'password', 'contrasena opcional'],
}

export function parseRole(raw: string): BulkRole | null {
  const v = fold(raw)
  if (['corredor', 'corredora', 'runner', 'corredores'].includes(v)) return 'runner'
  if (['base', 'inductor', 'inductora', 'inductor de base', 'inductores', 'inductor base'].includes(v)) return 'base'
  return null
}

const truthy = (raw: string) => ['si', 'x', '1', 'true', 'yes', 'y', 'verdadero'].includes(fold(raw))

// Collapses spaces so "Dioses  Griegos" and "dioses griegos" are the same group.
export const nameKey = (name: string) => fold(name)

export interface ParsedTable {
  rows: BulkRow[]
  error?: string // the file cannot be used at all (missing columns, empty)
}

export function rowsFromTable(table: string[][]): ParsedTable {
  const clean = table.map((r) => r.map((c) => (c ?? '').toString().trim())).filter((r) => r.some((c) => c !== ''))
  if (clean.length < 2) return { rows: [], error: 'El archivo no tiene filas de datos debajo del encabezado.' }

  const header = clean[0].map((h) => fold(h).replace(/opcional/g, '').replace(/ +/g, ' ').trim())
  const index: Partial<Record<Field, number>> = {}
  for (const field of Object.keys(HEADERS) as Field[]) {
    const i = header.findIndex((h) => HEADERS[field].includes(h))
    if (i >= 0) index[field] = i
  }
  const missing: string[] = []
  if (index.fullName === undefined) missing.push('Nombre completo')
  if (index.role === undefined) missing.push('Rol')
  if (index.assignment === undefined) missing.push('Grupo o base')
  if (missing.length > 0) {
    return { rows: [], error: `Faltan columnas en el encabezado: ${missing.join(', ')}. Usa la plantilla.` }
  }
  const cell = (r: string[], f: Field) => (index[f] === undefined ? '' : (r[index[f]!] ?? ''))

  const rows = clean.slice(1).map<BulkRow>((r, i) => {
    const role = parseRole(cell(r, 'role'))
    const row: BulkRow = {
      line: i + 2,
      fullName: cell(r, 'fullName').replace(/\s+/g, ' '),
      username: normalizeUsername(cell(r, 'username')),
      role,
      assignment: cell(r, 'assignment').replace(/\s+/g, ' '),
      gps: truthy(cell(r, 'gps')),
      password: cell(r, 'password'),
      errors: [],
    }
    if (!row.fullName) row.errors.push('Falta el nombre.')
    if (!role) row.errors.push(`Rol no válido ("${cell(r, 'role')}"). Usa "Corredor" o "Base".`)
    if (!row.assignment) row.errors.push(role === 'base' ? 'Falta la base.' : 'Falta el grupo.')
    if (row.username && !USERNAME_PATTERN.test(row.username)) {
      row.errors.push('Usuario no válido: 3 a 30 caracteres, letras minúsculas, números, punto, guion o guion bajo.')
    }
    if (row.password && row.password.length < 6) row.errors.push('La contraseña debe tener al menos 6 caracteres.')
    if (row.gps && role === 'base') row.errors.push('La columna GPS solo aplica a corredores.')
    return row
  })
  return { rows }
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
    if (existingUsernames.has(r.username)) r.errors.push(`El usuario "${r.username}" ya existe.`)
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
    if (!key) continue
    names.set(key, (names.get(key) ?? 0) + 1)
  }
  for (const r of out) {
    if ((names.get(nameKey(r.fullName)) ?? 0) > 1) r.errors.push('Esta persona aparece más de una vez en el archivo.')
  }
  return out
}

// ---------- Reading the files ----------

// Word: mammoth turns the .docx into HTML; the first table is the data.
export function tableFromHtml(html: string): string[][] {
  const table = /<table[\s\S]*?<\/table>/i.exec(html)?.[0]
  if (!table) return []
  const decode = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim()
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((tr) =>
    [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decode(c[1])),
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

export async function readTableFromFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth/mammoth.browser')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return tableFromHtml(value)
  }
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser')
    const rows = await readSheet(file) // first sheet
    return rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))))
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) return tableFromCsv(await file.text())
  throw new Error('Formato no admitido. Usa un archivo .docx (Word), .xlsx (Excel) o .csv.')
}
