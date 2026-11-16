// Tiny source readers for the static tests: they look at the code the way a reviewer would
// (which tables, columns, functions and realtime channels the client uses) without running it.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
export const rootPath = (...parts: string[]) => path.join(ROOT, ...parts)

export interface Source {
  file: string // relative, forward slashes
  text: string
}

export function sourceFiles(dir: string, exts: string[] = ['.ts', '.tsx']): Source[] {
  const out: Source[] = []
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (exts.includes(path.extname(entry.name))) {
        out.push({ file: path.relative(ROOT, full).replace(/\\/g, '/'), text: fs.readFileSync(full, 'utf8') })
      }
    }
  }
  walk(rootPath(dir))
  return out
}

/** Index of the character that closes the bracket opened at `open`, skipping strings and comments. */
export function closing(text: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' }
  const stack: string[] = []
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i)
      if (i < 0) return -1
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i) + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++
      continue
    }
    if (pairs[ch]) stack.push(pairs[ch])
    else if (ch === stack[stack.length - 1]) {
      stack.pop()
      if (stack.length === 0) return i
    }
  }
  return -1
}

/** Splits at commas that are not inside brackets or strings. */
export function splitTop(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      for (i++; i < text.length && text[i] !== ch; i++) if (text[i] === '\\') i++
    } else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

export const stringLiteral = (arg: string): string | null => /^\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*$/.exec(arg)?.[2] ?? null

export interface Call {
  name: string
  args: string[]
}
export interface Chain {
  file: string
  line: number
  table: string
  calls: Call[]
}

/** Every `supabase.from('table')...` method chain in the sources (Storage buckets excluded). */
export function findChains(sources: Source[]): Chain[] {
  const chains: Chain[] = []
  for (const { file, text } of sources) {
    const re = /\.from\(\s*(['"`])(\w+)\1\s*\)/g
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (/\.storage\s*$/.test(text.slice(0, m.index))) continue // a Storage bucket, not a table
      const calls: Call[] = []
      let pos = re.lastIndex
      for (;;) {
        const rest = /^\s*\.(\w+)\(/.exec(text.slice(pos))
        if (!rest) break
        const open = pos + rest[0].length - 1
        const close = closing(text, open)
        if (close < 0) break
        calls.push({ name: rest[1], args: splitTop(text.slice(open + 1, close)) })
        pos = close + 1
      }
      chains.push({ file, line: text.slice(0, m.index).split('\n').length, table: m[2], calls })
    }
  }
  return chains
}

export type SelectItem = { column: string } | { table: string; items: SelectItem[] }

/** Parses a PostgREST select string: `id, name, matches(id, bases!inner(name))`. */
export function parseSelect(select: string): SelectItem[] {
  return splitTop(select).map((raw): SelectItem => {
    const embed = /^(?:\w+:)?(\w+)(?:![\w.]+)?\(([\s\S]*)\)$/.exec(raw)
    if (embed) return { table: embed[1], items: parseSelect(embed[2]) }
    return { column: raw.replace(/^\w+:/, '').replace(/::\w+$/, '').trim() }
  })
}

/** Top-level keys of an object literal passed to insert/update/upsert, or null if it is not one. */
export function objectKeys(arg: string): string[] | null {
  const t = arg.trim()
  if (!t.startsWith('{')) return null
  const body = t.slice(1, closing(t, 0))
  const keys: string[] = []
  for (const part of splitTop(body)) {
    if (part.startsWith('...')) continue
    const key = /^(['"]?)(\w+)\1\s*(?::|$)/.exec(part)
    if (key) keys.push(key[2])
  }
  return keys
}
