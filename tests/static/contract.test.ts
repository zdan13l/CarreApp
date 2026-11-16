// The contract between the client code and the database schema, checked statically: every table,
// column, relationship, RPC and realtime channel the app uses must exist in the migrations.
// It catches the classic "I changed the SQL but not the screen" (or the other way round) before a
// user does, e.g. a column that moved to another table or a table missing from the realtime publication.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from '../db/harness'
import { findChains, objectKeys, parseSelect, sourceFiles, stringLiteral, type Chain, type SelectItem } from './helpers'

let db: TestDb
const columns = new Map<string, Set<string>>() // table or view -> columns
const relations = new Set<string>() // "a|b": there is a foreign key between a and b (either direction)
const uniques = new Map<string, Set<string>[]>() // table -> sets of columns with a unique index/constraint
const publication = new Set<string>()
const functions = new Map<string, string[]>() // name -> parameter names

const sources = sourceFiles('src')
const chains: Chain[] = findChains(sources)

beforeAll(async () => {
  db = await createDb()
  for (const r of await db.sql<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  )) {
    if (!columns.has(r.table_name)) columns.set(r.table_name, new Set())
    columns.get(r.table_name)!.add(r.column_name)
  }
  for (const r of await db.sql<{ child: string; parent: string }>(
    `select cc.relname as child, pc.relname as parent from pg_constraint k
       join pg_class cc on cc.oid = k.conrelid join pg_class pc on pc.oid = k.confrelid
      where k.contype = 'f'`,
  )) {
    relations.add(`${r.child}|${r.parent}`)
    relations.add(`${r.parent}|${r.child}`)
  }
  for (const r of await db.sql<{ tbl: string; cols: string[] }>(
    `select c.relname as tbl, array_agg(a.attname::text order by a.attnum) as cols
       from pg_index i join pg_class c on c.oid = i.indrelid
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
      where i.indisunique and i.indpred is null group by c.relname, i.indexrelid`,
  )) {
    uniques.set(r.tbl, [...(uniques.get(r.tbl) ?? []), new Set(r.cols)])
  }
  for (const r of await db.sql<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)) {
    publication.add(r.tablename)
  }
  for (const r of await db.sql<{ proname: string; args: string[] | null }>(
    `select p.proname, p.proargnames as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`,
  )) {
    functions.set(r.proname, r.args ?? [])
  }
})
afterAll(async () => {
  await db.close()
})

const where = (c: Chain) => `${c.file}:${c.line}`

/** Problems of a select list against a table, recursively through the embedded relations. */
function selectProblems(table: string, items: SelectItem[]): string[] {
  const problems: string[] = []
  const cols = columns.get(table)
  for (const item of items) {
    if ('column' in item) {
      if (item.column !== '*' && cols && !cols.has(item.column)) problems.push(`${table} has no column "${item.column}"`)
    } else {
      if (!columns.has(item.table)) problems.push(`"${item.table}" is embedded in ${table} but is not a table`)
      else if (!relations.has(`${table}|${item.table}`)) problems.push(`no foreign key between ${table} and ${item.table}`)
      else problems.push(...selectProblems(item.table, item.items))
    }
  }
  return problems
}

describe('client queries match the schema', () => {
  it('finds the queries (guards the test itself)', () => {
    expect(chains.length).toBeGreaterThan(40)
    expect(chains.some((c) => c.table === 'matches' && c.calls.some((x) => x.name === 'select'))).toBe(true)
  })

  it('every table or view the client reads or writes exists', () => {
    const missing = chains.filter((c) => !columns.has(c.table)).map((c) => `${where(c)} uses unknown table "${c.table}"`)
    expect(missing).toEqual([])
  })

  it('every select() asks only for columns and relationships that exist', () => {
    const problems: string[] = []
    for (const c of chains) {
      for (const call of c.calls.filter((x) => x.name === 'select')) {
        const select = stringLiteral(call.args[0] ?? '')
        if (select === null || select === '*') continue
        for (const p of selectProblems(c.table, parseSelect(select))) problems.push(`${where(c)}: ${p}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every filter and ordering names a real column (also embedded ones like "base_staff.user_id")', () => {
    const problems: string[] = []
    const filters = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike', 'order']
    for (const c of chains) {
      for (const call of c.calls.filter((x) => filters.includes(x.name))) {
        const name = stringLiteral(call.args[0] ?? '')
        if (!name) continue
        const [first, second] = name.split('.')
        const [tbl, col] = second ? [first, second] : [c.table, first]
        if (!columns.get(tbl)?.has(col)) problems.push(`${where(c)}: .${call.name}('${name}') — ${tbl} has no column "${col}"`)
      }
    }
    expect(problems).toEqual([])
  })

  it('every insert/update/upsert writes only columns that exist', () => {
    const problems: string[] = []
    for (const c of chains) {
      for (const call of c.calls.filter((x) => ['insert', 'update', 'upsert'].includes(x.name))) {
        for (const key of objectKeys(call.args[0] ?? '') ?? []) {
          if (!columns.get(c.table)?.has(key)) problems.push(`${where(c)}: .${call.name}() sets "${key}" but ${c.table} has no such column`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('every upsert onConflict targets a unique index (otherwise Postgres rejects it at run time)', () => {
    const problems: string[] = []
    for (const c of chains) {
      for (const call of c.calls.filter((x) => x.name === 'upsert')) {
        const target = /onConflict:\s*['"`]([^'"`]+)['"`]/.exec(call.args[1] ?? '')?.[1]
        if (!target) continue
        const wanted = new Set(target.split(',').map((s) => s.trim()))
        const ok = (uniques.get(c.table) ?? []).some((u) => u.size === wanted.size && [...wanted].every((w) => u.has(w)))
        if (!ok) problems.push(`${where(c)}: onConflict '${target}' has no unique index on ${c.table}`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('RPC calls and realtime channels match the schema', () => {
  it('every rpc() calls an existing function with parameter names it declares', () => {
    const problems: string[] = []
    for (const { file, text } of sources) {
      const re = /\.rpc\(\s*'(\w+)'\s*(?:,\s*(\{[^}]*\}))?/g
      for (let m = re.exec(text); m; m = re.exec(text)) {
        const fn = functions.get(m[1])
        const at = `${file}:${text.slice(0, m.index).split('\n').length}`
        if (!fn) {
          problems.push(`${at}: rpc('${m[1]}') — no such function`)
          continue
        }
        for (const key of objectKeys(m[2] ?? '') ?? []) if (!fn.includes(key)) problems.push(`${at}: rpc('${m[1]}') has no parameter "${key}" (has ${fn.join(', ')})`)
      }
    }
    expect(problems).toEqual([])
    expect(sources.some((s) => /\.rpc\(/.test(s.text))).toBe(true)
  })

  it('every table a screen listens to is in the realtime publication', () => {
    const problems: string[] = []
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/useRealtimeReload\(\s*\[([^\]]*)\]/g)) {
        for (const t of m[1].match(/'(\w+)'/g) ?? []) {
          const table = t.slice(1, -1)
          if (!publication.has(table)) problems.push(`${file}: listens to "${table}" which is not in the supabase_realtime publication`)
        }
      }
      for (const m of text.matchAll(/postgres_changes'?,\s*\{[^}]*table:\s*'(\w+)'/g)) {
        if (!publication.has(m[1])) problems.push(`${file}: postgres_changes on "${m[1]}" which is not in the publication`)
      }
    }
    expect(problems).toEqual([])
  })

  it('the realtime publication contains what the live screens need', () => {
    for (const t of ['matches', 'match_scores', 'bases', 'team_locations', 'alerts']) expect(publication.has(t), t).toBe(true)
  })
})
