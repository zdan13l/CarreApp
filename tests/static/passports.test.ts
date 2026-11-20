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
    expect([...tables('pages/MemberHome.tsx')].sort()).toEqual(['passport_records', 'passport_stamps', 'passports', 'term_committees'])
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
    expect(text).toMatch(/if \(data\) return <MemberPage data=\{data\} actions=\{actions\} \/>/)
  })
})

describe('one passport for the whole life in the induction', () => {
  const pass = read('src/components/MemberPassport.tsx')
  const page = read('src/components/MemberPage.tsx')
  const css = read('src/index.css')

  it('the cover and the identity page are general: the mark of the career, never a theme, a committee, a role or a partner', () => {
    const cover = pass.slice(pass.indexOf('<button type="button" className={`cover'), pass.indexOf('function SlotView'))
    expect(cover).toMatch(/<CareerEmblem career=\{career\}/)
    expect(cover).toMatch(/Inducción Javeriana/)
    for (const word of ['theme', 'culture', 'committee', 'role', 'ctx', 'partners']) expect(cover, word).not.toContain(word)
    const dni = pass.slice(pass.indexOf("if (spec.kind === 'dni')"), pass.indexOf("} else if (spec.kind === 'induction'"))
    for (const word of ['theme', 'culture', 'committee', 'role', 'partners', 'ctx']) expect(dni, word).not.toMatch(new RegExp(`\\b${word}\\b`))
    expect(dni).toMatch(/Ingresó a inducción/)
    expect(dni).toMatch(/Generación/)
  })

  it('it looks the same for everyone: no version per role and no control tower', () => {
    expect(pass).toMatch(/<section className="booklet member"/)
    expect(css).not.toMatch(/\.member\.role-/)
    expect(page).not.toMatch(/tower/)
    expect(read('src/index.css')).not.toMatch(/\.member-tower/)
  })

  it('every induction has its own pages in its own theme: the induction, the committee and the visas; blank pages wait at the end', () => {
    expect(pass).toMatch(/specs\.push\(\{ kind: 'induction', record \}\)/)
    expect(pass).toMatch(/mine\.forEach\(\(m, i\) => specs\.push\(\{ kind: 'committee'/) // one page for each committee of the person
    expect(pass).toMatch(/export const BLANK_PAGES = 3/)
    expect(pass).toMatch(/Inducción \{record\.term\.name\}/)
    expect(pass).toMatch(/Temática \{theme\.name\}/)
    expect(pass).toMatch(/Palabras de tus coordinadores/)
  })

  it('the golden stamp with a photo: the group of a runner, the base of a base inductor', () => {
    expect(pass).toMatch(/record\.role === 'runner' && ctx\?\.team_name/)
    expect(pass).toMatch(/record\.role === 'base' && ctx\?\.base_name/)
    expect(read('src/components/Seals.tsx')).toMatch(/export function PhotoSeal/)
  })

  it('the cover opens on a tap and waits for it, like the passport of the group', () => {
    expect(pass).toMatch(/setPhase\('opening'\)/)
    expect(pass).toMatch(/Toca para abrir/)
  })

  it('every culture has its colour, its mark and its border', () => {
    const emblem = read('src/components/CultureEmblem.tsx')
    for (const c of ['nordica', 'griega', 'mexicana', 'china', 'egipcia']) {
      expect(css).toMatch(new RegExp(`\\.culture-${c} \\{ --culture-bright`))
      expect(emblem).toMatch(new RegExp(`${c}: `))
    }
    for (const o of ['griega', 'nordica', 'mexicana', 'china', 'general']) expect(emblem).toMatch(new RegExp(`culture === '${o}'`))
  })

  it('the cover leaves nothing of the page showing under it (it is as tall as the booklet)', () => {
    expect(css).toMatch(/\.member \.cover \{ height: 100%; \}/)
  })

  it('a theme this version does not know (the next induction) gets a neutral page, never another theme\'s cultures', () => {
    const themes = read('src/lib/themes.ts')
    expect(themes).toMatch(/THEMES\[k\] \?\? \{ key: k, name: pretty\(k \|\| 'Temática'\), cultures: \[GENERAL\]/)
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

describe('the identity of the passport (migration 0024)', () => {
  const sql = read('supabase/migrations/0024_passport_identity.sql')

  it('lets a person update only their own passport row, and the trigger limits it to nickname and symbol', () => {
    expect(sql).toMatch(/create policy passports_self_update on public\.passports for update to authenticated\s+using \(id = auth\.uid\(\)\) with check \(id = auth\.uid\(\)\)/)
    expect(sql).toMatch(/auth\.uid\(\) is not null and not public\.is_admin\(\)/) // the server (no user) and the coordinator may change anything
    for (const column of ['username', 'full_name', 'photo_path', 'generation', 'joined_term']) expect(sql).toContain(`new.${column} is distinct from old.${column}`)
    expect(sql).not.toMatch(/new\.(nickname|symbol)/) // those two are the person's
  })

  it('a committee may have several coordinators: 0026 drops the unique index of 0024', () => {
    expect(read('supabase/migrations/0026_committee_coordinators.sql')).toMatch(/drop index if exists public\.passport_records_committee_lead/)
  })

  it('the app keeps working before it is applied: every query that asks for the new columns retries without them', () => {
    expect(read('src/pages/MemberHome.tsx')).toMatch(/if \(missingColumn\(p\.error\) \|\| missingColumn\(r\.error\)\) \[p, r\] = await read\(0\)/)
    expect(read('src/pages/MemberHome.tsx')).toMatch(/\[p, r\] = await read\(1\)/) // without the extra committees of 0027
    expect(read('src/pages/admin/Inductores.tsx')).toMatch(/const without = missingColumn\(p\.error\) \|\| missingColumn\(r\.error\)/)
    expect(read('src/pages/admin/Inductores.tsx')).toMatch(/0027_more_committees\.sql/)
    expect(read('src/pages/admin/Inductores.tsx')).toMatch(/Falta aplicar la migración <span className="mono">0024_passport_identity\.sql<\/span>/)
  })
})

describe('Mi perfil, the password and the @', () => {
  const profile = read('src/components/MemberProfile.tsx')
  const home = read('src/pages/MemberHome.tsx')
  const api = read('api/account.ts')

  it('asks for the current password to change the @ or the password, and checks the two new ones match', () => {
    expect(profile).toMatch(/disabled=\{busy \|\| !usernameOk \|\| !userPassword\}/)
    expect(profile).toMatch(/disabled=\{busy \|\| !current \|\| next\.length < 8 \|\| !again\}/)
    expect(profile).toMatch(/Las dos contraseñas nuevas no coinciden/)
    expect(home).toMatch(/updateAccount\(\{ current_password: currentPassword, username \}\)/)
  })

  it('the server checks the current password with the PUBLIC key and only serves logins that have a passport', () => {
    expect(api).toMatch(/process\.env\.VITE_SUPABASE_ANON_KEY/)
    expect(api).toMatch(/signInWithPassword/)
    expect(api).toMatch(/from\('passports'\)\.select\('id, username'\)/)
    expect(read('.env.example')).toContain('VITE_SUPABASE_ANON_KEY')
  })

  it('does not edit the nickname or the symbol (they are set once, by the coordinator) and never writes to the passport row', () => {
    expect(profile).not.toMatch(/nickname|symbol|SYMBOLS/i)
    expect(home).not.toMatch(/saveAlias|update\(alias\)|from\('passports'\)\.update/)
    expect(profile).not.toMatch(/supabase/)
  })

  it('the PDF is built on demand, never in the first load of the app', () => {
    expect(home).toMatch(/import\('\.\.\/lib\/passportPdf'\)/)
    expect(read('src/lib/passportPdf.ts')).toMatch(/import\('react-dom\/server'\)/)
    expect(read('vite.config.ts')).toMatch(/globIgnores:[^\n]*passportPdf-[^\n]*server\.browser-/)
  })

  it('the page has the two tabs and keeps the passport mounted while the profile is open', () => {
    const page = read('src/components/MemberPage.tsx')
    expect(page).toMatch(/id: 'pasaporte'[\s\S]*id: 'perfil'/)
    expect(page).toMatch(/<div hidden=\{tab !== 'pasaporte'\}>/)
  })
})

describe('the stamps of the passport', () => {
  it('the mark of a culture is drawn from places and never from the figures of the base stamps', () => {
    const emblem = read('src/components/CultureEmblem.tsx')
    for (const place of ['Drakkar', 'Templo', 'Piramide', 'Pagoda', 'Piramides']) expect(emblem).toContain(`function ${place}(`)
    for (const figure of ['Mjolnir', 'Medusa', 'Dragon', 'OjoDeHorus', 'PiedraDelSol']) expect(emblem).not.toContain(`function ${figure}(`)
  })

  it('the committees have their stamps (Bienvenida and Meraki with a silhouette of their own) and the golden one made of the foil variables', () => {
    const seal = read('src/components/CommitteeSeal.tsx')
    for (const fn of ['Clausura', 'Conzumo', 'Carrera', 'Caos']) expect(seal).toContain(`function ${fn}(`)
    expect(seal).toContain('<ShapeSeal kind="shield" art="vest"')
    expect(seal).toContain('<ShapeSeal kind="oval" art="butterfly"')
    expect(read('src/components/InkSeals.tsx')).toMatch(/var\(--foil-a\)/)
    expect(seal).toMatch(/var\(--foil-a\)/)
    expect(read('src/index.css')).toMatch(/--foil-a: #a47c28; --foil-b: #f7de8f; --foil-c: #b98b30; --foil-d: #f4d575;/)
  })

  it('a real passport has pages left: empty visa pages in every induction and blank pages for the next ones', () => {
    expect(read('src/components/MemberPassport.tsx')).toMatch(/export const MIN_VISA_PAGES = 2/)
    expect(read('src/components/MemberPassport.tsx')).toMatch(/export const BLANK_PAGES = 3/)
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
