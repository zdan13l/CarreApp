// The personal passport (migration 0023), checked statically: who can open what, what each version of the booklet reads,
// and the traps that already bit once (the control-tower class on the booklet itself hid its cover).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findChains, rootPath, sourceFiles } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('who opens the passport', () => {
  const app = read('src/App.tsx')
  const auth = read('src/lib/auth.tsx')

  it('/pasaporte is for the personal login only, and signing in sends it there', () => {
    expect(app).toMatch(/path="\/pasaporte" element=\{<RequireRole role="member"><MemberHome \/><\/RequireRole>\}/)
    expect(auth).toMatch(/member: '\/pasaporte'/)
  })

  it('a login without profile is looked up as a passport; a missing table is not mistaken for a network failure', () => {
    expect(auth).toMatch(/from\('passports'\)\.select\('id, username, full_name, photo_path'\)/)
    expect(auth).toMatch(/role: 'member'/)
    expect(auth).toMatch(/failed: Boolean\(passport\.error && !passport\.error\.code\)/)
  })

  it('the coordinator creates it through the server (the service role), as a passport and never as a profile', () => {
    const api = read('api/users.ts')
    expect(api).toMatch(/role === 'member'\s*\n?\s*\? await admin\.from\('passports'\)/)
    expect(read('src/lib/usersApi.ts')).toMatch(/createPassportUser[\s\S]*role: 'member'/)
  })
})

describe('the passport screen reads only the passport', () => {
  const tables = (file: string) => new Set(findChains(sourceFiles('src').filter((s) => s.file.endsWith(file))).map((c) => c.table))

  it('MemberHome touches no table of the live operation (teams, bases, matches, scores, profiles…)', () => {
    expect([...tables('pages/MemberHome.tsx')].sort()).toEqual(['passport_records', 'passport_stamps', 'passports'])
    const text = read('src/pages/MemberHome.tsx')
    expect(text).toMatch(/rpc\('my_passport_context'\)/)
    expect(text).toMatch(/rpc\('my_live_stamps'\)/)
  })

  it('it refreshes when a Carrera starts or ends (the stamps are archived then)', () => {
    expect(read('src/pages/MemberHome.tsx')).toMatch(/useRealtimeReload\(\['events'\]/)
  })

  it('a refresh that fails keeps the passport on screen instead of showing it empty', () => {
    const text = read('src/pages/MemberHome.tsx')
    expect(text).toMatch(/setFailed\(true\)/)
    expect(text).toMatch(/if \(data\) return <MemberPage data=\{data\} \/>/)
  })
})

describe('three versions of the same booklet', () => {
  const pass = read('src/components/MemberPassport.tsx')
  const page = read('src/components/MemberPage.tsx')
  const css = read('src/index.css')

  it('each role has its own cover, words and class (runner, base, coordinator)', () => {
    for (const role of ['runner', 'base', 'coordinator']) {
      expect(pass).toMatch(new RegExp(`${role}: \\{ kicker:`))
    }
    for (const role of ['base', 'coordinator']) expect(css).toMatch(new RegExp(`\\.member\\.role-${role}`)) // the runner is the default paper
    expect(pass).toMatch(/`booklet member role-\$\{role\} culture-\$\{culture\.key\}`/)
  })

  it('the control tower wraps the whole page, never the booklet (".tower > *" would lift the cover under the page)', () => {
    expect(/booklet member role-.*/.exec(pass)![0]).not.toMatch(/tower/) // the className of the booklet itself
    expect(page).toMatch(/role === 'coordinator' \? <div className="tower member-tower">/)
    expect(css).toMatch(/\.tower > \* \{ position: relative; z-index: 1; \}/) // the rule that made the wrapper necessary
  })

  it('the cover opens on a tap and waits for it, like the passport of the group', () => {
    expect(pass).toMatch(/setPhase\('opening'\)/)
    expect(pass).toMatch(/Toca para abrir/)
  })

  it('every culture has its colour, its emblem and its border', () => {
    const emblem = read('src/components/CultureEmblem.tsx')
    for (const c of ['nordica', 'griega', 'mexicana', 'china', 'egipcia']) {
      expect(css).toMatch(new RegExp(`\\.culture-${c} \\{ --culture-bright`))
      expect(emblem).toMatch(new RegExp(`${c}: `))
    }
    for (const o of ['griega', 'nordica', 'mexicana', 'china']) expect(emblem).toMatch(new RegExp(`culture === '${o}'`))
  })

  it('the cover leaves nothing of the page showing under it (it is as tall as the booklet)', () => {
    expect(css).toMatch(/\.member \.cover \{ height: 100%; \}/)
  })

  it('a theme or culture this version does not know never breaks the page', () => {
    const themes = read('src/lib/themes.ts')
    expect(themes).toMatch(/THEMES\[key \?\? ''\] \?\? THEMES\[DEFAULT_THEME\]/)
    expect(themes).toMatch(/\?\? t\.cultures\[0\]/)
  })
})

describe('the coordinator\'s list of inductors', () => {
  const page = read('src/pages/admin/Inductores.tsx')

  it('is in the preparation menu and routed', () => {
    expect(read('src/pages/admin/AdminNav.tsx')).toMatch(/to: '\/admin\/inductores', label: 'Inductores'/)
    expect(read('src/App.tsx')).toMatch(/path="inductores" element=\{<Inductores \/>\}/)
  })

  it('creates the logins through the server, asks before deleting, and never uses window.confirm', () => {
    expect(page).toMatch(/createPassportUser\(/)
    expect(page).toMatch(/confirmDialog\(/)
    expect(page).not.toMatch(/window\.(confirm|prompt)/)
  })

  it('gives the Excel with the @ and the password back at the end, and again on demand', () => {
    expect(page).toMatch(/downloadBlob\(await credentialsWorkbook\(s\.rows, s\.term, s\.theme\)/)
    expect(page).toMatch(/Descargar de nuevo/)
  })

  it('a login that cannot be given its semester record is removed (no orphan login)', () => {
    expect(page).toMatch(/deleteUser\(id\)/)
  })

  it('changing the role clears the group and the base (a runner has a group, a base has a base)', () => {
    expect(page).toMatch(/update\(p, \{ role, team_id: null, base_id: null \}\)/)
  })

  it('tells the coordinator when migration 0023 is not applied yet', () => {
    expect(page).toMatch(/Falta aplicar la migración 0023/)
  })
})

describe('the migration', () => {
  const sql = read('supabase/migrations/0023_passports.sql')

  it('archives the stamps BEFORE the progress is reset: same event, alphabetical order of the triggers', () => {
    expect('events_archive_stamps' < 'events_reset_on_deactivate').toBe(true)
    expect(sql).toMatch(/create trigger events_archive_stamps after update of is_active on public\.events/)
  })

  it('does not touch the enum of roles (a new value cannot be used in the same script) nor the profiles table', () => {
    expect(sql).not.toMatch(/alter type/i)
    expect(sql).not.toMatch(/alter table public\.profiles/i)
  })

  it('every new table has row level security', () => {
    for (const t of ['terms', 'passports', 'passport_records', 'passport_stamps']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`))
    }
  })

  it('the internal functions are not callable by the users; the two the passport needs are', () => {
    for (const f of ['archive_event_stamps(uuid)', 'events_archive_stamps()', 'validate_passport_record()', 'events_default_term()']) {
      expect(sql).toContain(`revoke all on function public.${f} from public, anon, authenticated`)
    }
    for (const f of ['my_passport_context()', 'my_live_stamps()']) expect(sql).toContain(`grant execute on function public.${f} to authenticated`)
  })
})

describe('docs', () => {
  it('the wiki explains the passport where each piece of information lives', () => {
    expect(read('docs/wiki/Pantallas.md')).toMatch(/Inductores/)
    expect(read('docs/wiki/Pantallas.md')).toMatch(/Pasaporte personal/)
    expect(read('docs/wiki/Roles-y-permisos.md')).toMatch(/pasaporte personal/i)
    expect(read('docs/wiki/Modelo-de-datos.md')).toMatch(/passport_records/)
  })
})
