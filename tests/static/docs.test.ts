// The documentation is part of the product (the coordinator changes every semester and the wiki is
// how the next one understands the system), so these checks keep it in step with the code.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { migrationFiles } from '../db/harness'
import { rootPath, sourceFiles } from './helpers'

const read = (...p: string[]) => fs.readFileSync(rootPath(...p), 'utf8')

describe('SQL log (docs/wiki/Registro-SQL.md)', () => {
  const log = read('docs/wiki/Registro-SQL.md')

  it('mentions every migration file, so nobody has to guess what was applied', () => {
    const missing = migrationFiles().filter((f) => !log.includes(f))
    expect(missing).toEqual([])
  })

  it('has a detailed section (what, why, how to revert) for every migration', () => {
    const missing = migrationFiles().map((f) => f.slice(0, 4)).filter((n) => !new RegExp(`^## ${n} — `, 'm').test(log))
    expect(missing).toEqual([])
  })

  it('does not list migrations that do not exist', () => {
    const listed = [...log.matchAll(/`(\d{4}_[\w]+\.sql)`/g)].map((m) => m[1])
    const existing = new Set(migrationFiles())
    expect(listed.filter((f) => !existing.has(f))).toEqual([])
  })
})

describe('wiki', () => {
  it('has every page the sidebar links to', () => {
    const sidebar = read('docs/wiki/_Sidebar.md')
    const pages = [...sidebar.matchAll(/\]\(([\w-]+)\)/g)].map((m) => m[1])
    expect(pages.length).toBeGreaterThan(5)
    expect(pages.filter((p) => !fs.existsSync(rootPath('docs/wiki', `${p}.md`)))).toEqual([])
  })

  it('lists every wiki page in the sidebar', () => {
    const sidebar = read('docs/wiki/_Sidebar.md')
    const pages = fs.readdirSync(rootPath('docs/wiki')).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'Home.md')
    expect(pages.filter((p) => !sidebar.includes(`(${p.replace('.md', '')})`))).toEqual([])
  })
})

describe('environment variables (.env.example)', () => {
  const example = read('.env.example')

  it('documents every variable the browser code reads', () => {
    const used = new Set(sourceFiles('src').flatMap((s) => [...s.text.matchAll(/import\.meta\.env\.(VITE_\w+)/g)].map((m) => m[1])))
    expect([...used].filter((v) => !example.includes(v))).toEqual([])
    expect(used.size).toBeGreaterThanOrEqual(4)
  })

  it('documents every variable the serverless functions read', () => {
    const used = new Set(sourceFiles('api').flatMap((s) => [...s.text.matchAll(/process\.env\.(\w+)/g)].map((m) => m[1])))
    expect([...used].filter((v) => !example.includes(v))).toEqual([])
  })

  it('never contains real secrets (only placeholders)', () => {
    for (const line of example.split('\n').filter((l) => /^[A-Z_]+=/.test(l))) {
      const value = line.split('=')[1]
      expect(value, line).toMatch(/your|example|placeholder|xxx|<|^$/i)
    }
  })
})

describe('repository hygiene', () => {
  it('ignores local secrets and tooling configuration', () => {
    const ignore = read('.gitignore')
    expect(ignore).toContain('*.local')
    expect(ignore).toContain('node_modules')
  })

  it('has no secret-looking keys committed in the sources or the docs', () => {
    const files = [...sourceFiles('src'), ...sourceFiles('api'), ...sourceFiles('docs', ['.md']), ...sourceFiles('supabase', ['.sql'])]
    const patterns: [RegExp, string][] = [
      [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'a JWT (Supabase key)'],
      [/pk\.eyJ[A-Za-z0-9_-]{20,}/, 'a Mapbox token'],
      [/sk\.eyJ[A-Za-z0-9_-]{20,}/, 'a Mapbox SECRET token'],
      [/service_role["']?\s*[:=]\s*["']ey/, 'a service role key'],
    ]
    const found = files.flatMap(({ file, text }) => patterns.filter(([re]) => re.test(text)).map(([, what]) => `${file}: ${what}`))
    expect(found).toEqual([])
  })
})
