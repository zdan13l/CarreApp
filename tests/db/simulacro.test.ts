// SIMULACRO: the ready-made test Carrera (public/plantillas/carrera-de-prueba.xlsx) is loaded through
// the SAME code the app uses (src/lib/bulk.ts), replayed against the database step by step like
// src/pages/admin/BulkImport.tsx does, and then docs/wiki/Prueba-en-vivo.md is walked through as a
// checklist, acting as each real role (admin / inductor / runner) with RLS on. At the end the Carrera is
// deleted like src/pages/admin/Carrera.tsx (DeleteEvent) does and nothing of it may be left.
//   npx vitest run tests/db/simulacro.test.ts --reporter=verbose      (prints the story)
//
// What this cannot replace: real phones (sound, push on a locked iPhone, GPS, the venue network).
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  countErrors, nameKey, parseTables, readTablesFromFile, validateFile, type ExistingData, type ParsedFile,
} from '../../src/lib/bulk'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'
import { isLocationFresh, LOCATION_HIDE_AFTER_MS } from '../../src/lib/geo'
import { legKey } from '../../src/lib/travel'
import { USERNAME_PATTERN } from '../../src/lib/username'
import { createDb, type PushItem, type TestDb } from './harness'
import { getAdmin, playMatch, seedCarrera, type CarreraSeed } from './seed'

const log: string[] = []
const say = (line: string) => log.push(line)

// ───────────────────────────── the file, exactly as the screen reads it ─────────────────────────────
const FILE = 'carrera-de-prueba.xlsx'
const NONE: ExistingData = { usernames: new Set(), teams: new Set(), bases: new Set(), matches: [] }
async function readFile(): Promise<ParsedFile> {
  const f = new File([fs.readFileSync(`public/plantillas/${FILE}`)], FILE)
  return parseTables(await readTablesFromFile(f))
}

// What BulkImport.loadExisting() reads (as the coordinator, RLS on) to validate a file.
async function loadExisting(db: TestDb, admin: string, eventId: string | null) {
  const as = db.asUser(admin)
  const usernames = new Set((await as.sql<{ username: string }>(`select username from public.profiles`)).map((x) => x.username))
  if (!eventId) return { existing: { ...NONE, usernames }, trackers: new Set<string>() }
  const teams = await as.sql<{ id: string; name: string }>(`select id, name from public.teams where event_id = $1`, [eventId])
  const bases = await as.sql<{ id: string; name: string }>(`select id, name from public.bases where event_id = $1`, [eventId])
  const tracked = await as.sql<{ team_id: string }>(
    `select tr.team_id from public.team_runners tr join public.teams t on t.id = tr.team_id where t.event_id = $1 and tr.is_gps_tracker`, [eventId])
  const ms = await as.sql<{ round_number: number; team_a: string; team_b: string; base_id: string }>(
    `select round_number, team_a, team_b, base_id from public.matches where event_id = $1`, [eventId])
  const tn = new Map(teams.map((x) => [x.id, nameKey(x.name)]))
  const bn = new Map(bases.map((x) => [x.id, nameKey(x.name)]))
  return {
    existing: {
      usernames,
      teams: new Set(tn.values()),
      bases: new Set(bn.values()),
      matches: ms.map((x) => ({ round: x.round_number, base: bn.get(x.base_id) ?? '', a: tn.get(x.team_a) ?? '', b: tn.get(x.team_b) ?? '' })),
    } satisfies ExistingData,
    trackers: new Set(tracked.map((x) => x.team_id)),
  }
}

// api/users.ts POST, as the service role would do it (auth user + profile with the Carrera).
async function createUserLikeApi(db: TestDb, u: { username: string; password: string; full_name: string; role: 'runner' | 'base'; event_id: string }) {
  const username = u.username.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username)) throw new Error('El usuario debe tener 3-30 caracteres.')
  if (u.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
  const email = `${username}@carreapp.test`
  // GoTrue refuses a second user with the same email: "Ese usuario ya existe"
  if ((await db.sql(`select 1 from auth.users where email = $1`, [email])).length > 0) throw new Error('Ese usuario ya existe (los nombres de usuario son únicos en todas las Carreras).')
  const [au] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])
  try {
    await db.sql(`insert into public.profiles (id, username, full_name, role, event_id) values ($1, $2, $3, $4, $5)`, [au.id, username, u.full_name, u.role, u.event_id])
  } catch {
    await db.sql(`delete from auth.users where id = $1`, [au.id]) // the API rolls back
    throw new Error('No se pudo crear el perfil del usuario.')
  }
  return { id: au.id }
}

interface Imported {
  eventId: string
  report: { done: string[]; problems: string[]; users: { username: string; ok: boolean; note: string; id?: string }[] }
}

// A faithful replay of BulkImport.run(): same order, same upserts, same GPS-tracker choice.
async function runImport(db: TestDb, admin: string, file: ParsedFile, target: { id: string | null; name: string }, trackers: Set<string>): Promise<Imported> {
  const sb = db.asUser(admin)
  const out: Imported['report'] = { done: [], problems: [], users: [] }
  let eventId = target.id ?? ''
  try {
    if (!eventId) {
      const [e] = await sb.sql<{ id: string }>(`insert into public.events (name) values ($1) returning id`, [target.name])
      eventId = e.id
    }
    if (file.carrera?.maxMinutes) await sb.sql(`update public.events set max_travel_minutes = $2 where id = $1`, [eventId, file.carrera.maxMinutes])

    const teams = new Map<string, string>()
    for (const t of await sb.sql<{ id: string; name: string }>(`select id, name from public.teams where event_id = $1`, [eventId])) teams.set(nameKey(t.name), t.id)
    for (const name of [...file.grupos.map((g) => g.name), ...file.personas.filter((p) => p.role === 'runner').map((p) => p.assignment)]) {
      if (!name || teams.has(nameKey(name))) continue
      const [t] = await sb.sql<{ id: string }>(`insert into public.teams (event_id, name, sort_order) values ($1, $2, $3) returning id`, [eventId, name, teams.size])
      teams.set(nameKey(name), t.id)
    }

    const bases = new Map<string, string>()
    for (const b of await sb.sql<{ id: string; name: string }>(`select id, name from public.bases where event_id = $1`, [eventId])) bases.set(nameKey(b.name), b.id)
    for (const name of [...file.bases.map((b) => b.name), ...file.personas.filter((p) => p.role === 'base').map((p) => p.assignment)]) {
      if (!name || bases.has(nameKey(name))) continue
      const [b] = await sb.sql<{ id: string }>(`insert into public.bases (event_id, name, sort_order) values ($1, $2, $3) returning id`, [eventId, name, bases.size])
      bases.set(nameKey(name), b.id)
    }
    for (const b of file.bases) {
      const id = bases.get(nameKey(b.name))!
      if (b.lat !== null && b.lng !== null) await sb.sql(`update public.bases set lat = $2, lng = $3 where id = $1`, [id, b.lat, b.lng])
      if (b.info) await sb.sql(`insert into public.base_details (base_id, info) values ($1, $2) on conflict (base_id) do update set info = excluded.info`, [id, b.info])
      for (const [i, q] of b.questions.entries()) {
        await sb.sql(`insert into public.base_questions (base_id, position, question) values ($1, $2, $3) on conflict (base_id, position) do update set question = excluded.question`, [id, i + 1, q])
      }
    }

    const tracker = new Map<string, number>()
    const runners = file.personas.filter((p) => p.role === 'runner')
    for (const r of runners) {
      const id = teams.get(nameKey(r.assignment))!
      if (!trackers.has(id) && r.gps && !tracker.has(id)) tracker.set(id, r.line)
    }
    for (const r of runners) {
      const id = teams.get(nameKey(r.assignment))!
      if (!trackers.has(id) && !tracker.has(id)) tracker.set(id, r.line)
    }
    for (const p of file.personas) {
      try {
        const created = await createUserLikeApi(db, { username: p.username, password: p.password, full_name: p.fullName, role: p.role!, event_id: eventId })
        if (p.role === 'runner') {
          const teamId = teams.get(nameKey(p.assignment))!
          try {
            await sb.sql(`insert into public.team_runners (team_id, user_id, is_gps_tracker) values ($1, $2, $3)`, [teamId, created.id, tracker.get(teamId) === p.line])
            out.users.push({ username: p.username, ok: true, note: '', id: created.id })
          } catch (e) { out.users.push({ username: p.username, ok: false, note: `Creado, pero no se pudo asignar al grupo: ${(e as Error).message}`, id: created.id }) }
        } else {
          try {
            await sb.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [bases.get(nameKey(p.assignment))!, created.id])
            out.users.push({ username: p.username, ok: true, note: '', id: created.id })
          } catch (e) { out.users.push({ username: p.username, ok: false, note: `Creado, pero no se pudo asignar a la base: ${(e as Error).message}`, id: created.id }) }
        }
      } catch (e) {
        out.users.push({ username: p.username, ok: false, note: (e as Error).message })
      }
    }

    for (const m of [...file.cruces].sort((a, b) => a.round - b.round)) {
      try {
        await sb.sql(`insert into public.matches (event_id, base_id, round_number, team_a, team_b) values ($1, $2, $3, $4, $5)`,
          [eventId, bases.get(nameKey(m.base))!, m.round, teams.get(nameKey(m.teamA))!, teams.get(nameKey(m.teamB))!])
      } catch (e) { out.problems.push(`Cruce de la ronda ${m.round} (${m.teamA} vs ${m.teamB}): ${(e as Error).message}`) }
    }

    for (const l of file.tiempos) {
      await sb.sql(
        `insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, $4)
         on conflict (from_base_id, to_base_id) do update set minutes = excluded.minutes`,
        [eventId, bases.get(nameKey(l.from))!, bases.get(nameKey(l.to))!, l.minutes],
      )
    }
  } catch (e) {
    out.problems.push((e as Error).message)
  }
  return { eventId, report: out }
}

const ORPHAN_AUDIT_ROWS = 0 // 0019: deleting a Carrera leaves no orphan audit rows
const TABLES = ['events', 'teams', 'bases', 'base_details', 'base_questions', 'matches', 'match_scores', 'score_audit', 'alerts',
  'team_locations', 'base_travel_times', 'team_runners', 'base_staff', 'push_subscriptions', 'profiles'] as const
async function counts(db: TestDb): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const t of TABLES) out[t] = Number((await db.sql<{ n: string }>(`select count(*)::text as n from public.${t}`))[0].n)
  out.auth_users = Number((await db.sql<{ n: string }>(`select count(*)::text as n from auth.users`))[0].n)
  return out
}

// ───────────────────────────── the simulacro ─────────────────────────────
let db: TestDb
let admin: string
// Switching a Carrera off now resets its progress (0020). These tests need ANOTHER Carrera that keeps its played data while
// it is off (to prove nothing leaks between Carreras), so the reset trigger is paused just for that switch-off.
async function switchOffKeepingProgress(id: string) {
  await db.sql(`alter table public.events disable trigger events_reset_on_deactivate`)
  try {
    await db.sql(`update public.events set is_active = false where id = $1`, [id])
  } finally {
    await db.sql(`alter table public.events enable trigger events_reset_on_deactivate`)
  }
}

let other: CarreraSeed // another Carrera (e.g. the real one) that must survive the whole thing
let baseline: Record<string, number>
let imp: Imported
let file: ParsedFile

interface Team { id: string; name: string; runners: string[]; tracker: string }
interface Base { id: string; name: string; staff: string }
interface Match { id: string; round: number; base: Base; a: Team; b: Team }
const teams = new Map<string, Team>() // by name
const bases = new Map<string, Base>()
let matches: Match[] = []
const roundOf = (r: number) => matches.filter((m) => m.round === r)
const expected = new Map<string, number>()
let voided = 0
let corrected = 0
const stateOf = async (id: string) => (await db.sql<{ status: string }>(`select status from public.matches where id = $1`, [id]))[0].status
const pushes = async (): Promise<PushItem[]> => (await db.httpCalls()).flatMap((c) => c.body.notifications)
const usersOf = (...ts: Team[]) => new Set(ts.flatMap((t) => t.runners))

beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 'secret')`)
  admin = await getAdmin(db)
  // Another Carrera that already lived: played, with an alert, a position and a travel time.
  other = await seedCarrera(db, { teams: 4, bases: 2 })
  const { scheduleWithGenerator } = await import('./seed')
  const ms = await scheduleWithGenerator(db, other, 2)
  await playMatch(db, other, ms[0], [ms[0].teamA, ms[0].teamB, ms[0].teamA])
  await db.asUser(admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'aviso de la otra Carrera')`, [other.eventId, ms[1].id])
  await db.asUser(other.teams[0].tracker).sql(`insert into public.team_locations (team_id, lat, lng) values ($1, 4.6, -74.0)`, [other.teams[0].id])
  await db.sql(`insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, 6)`, [other.eventId, other.bases[0].id, other.bases[1].id])
  await db.sql(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.test/other', 'k', 'a')`, [other.teams[0].runners[0]])
  await switchOffKeepingProgress(other.eventId)
  baseline = await counts(db)
  file = await readFile()
})
afterAll(async () => {
  console.info(`\n──────── SIMULACRO (Carrera de prueba) ────────\n${log.join('\n')}\n`)
  await db.close()
})

describe('1. load the test Carrera file exactly like "Cargar la Carrera desde un archivo"', () => {
  it('the file validates with no errors against an empty database (a new Carrera)', async () => {
    const ld = await loadExisting(db, admin, null)
    // the usernames of the OTHER Carrera exist; none of them is prueba.*
    const checked = validateFile(file, ld.existing)
    expect(countErrors(checked)).toBe(0)
    expect(checked.carrera?.name).toBe('Prueba 20 de enero')
    expect(checked.carrera?.maxMinutes).toBe(8)
    file = checked
    say('Archivo: "Prueba 20 de enero", 6 grupos, 3 bases, 9 personas, 15 cruces, 6 tiempos entre bases. 0 errores en la vista previa.')
  })

  it('"Cargar todo" creates the Carrera, groups, bases (info, 3 questions, lat/lng), users, assignments, matches and times', async () => {
    imp = await runImport(db, admin, file, { id: null, name: file.carrera!.name }, new Set())
    expect(imp.report.problems).toEqual([])
    expect(imp.report.users.filter((u) => !u.ok)).toEqual([])

    const [ev] = await db.sql<{ is_active: boolean; max_travel_minutes: number }>(`select is_active, max_travel_minutes from public.events where id = $1`, [imp.eventId])
    expect(ev).toEqual({ is_active: false, max_travel_minutes: 8 }) // draft until activated
    for (const t of await db.sql<{ id: string; name: string; photo_path: string | null }>(`select id, name, photo_path from public.teams where event_id = $1`, [imp.eventId])) {
      expect(t.photo_path).toBeNull() // photos are uploaded afterwards
      teams.set(t.name, { id: t.id, name: t.name, runners: [], tracker: '' })
    }
    expect(teams.size).toBe(6)
    for (const b of await db.sql<{ id: string; name: string; lat: number; lng: number }>(`select id, name, lat, lng from public.bases where event_id = $1`, [imp.eventId])) {
      expect(b.lat).toBeTypeOf('number')
      expect(b.lng).toBeTypeOf('number')
      bases.set(b.name, { id: b.id, name: b.name, staff: '' })
    }
    expect(bases.size).toBe(3)
    for (const b of bases.values()) {
      expect(await db.sql(`select 1 from public.base_details where base_id = $1 and length(info) > 0`, [b.id])).toHaveLength(1)
      expect(await db.sql(`select 1 from public.base_questions where base_id = $1`, [b.id])).toHaveLength(3)
    }

    // 9 users: profiles carry the Carrera (like api/users.ts), role and assignment match the file
    const people = await db.sql<{ id: string; username: string; role: string; event_id: string }>(`select id, username, role, event_id from public.profiles where event_id = $1`, [imp.eventId])
    expect(people).toHaveLength(9)
    expect(people.filter((p) => p.role === 'runner')).toHaveLength(6)
    expect(people.filter((p) => p.role === 'base')).toHaveLength(3)
    const byName = new Map(people.map((p) => [p.username, p.id]))
    const tracked = await db.sql<{ team_id: string; user_id: string; is_gps_tracker: boolean }>(
      `select tr.team_id, tr.user_id, tr.is_gps_tracker from public.team_runners tr join public.teams t on t.id = tr.team_id where t.event_id = $1`, [imp.eventId])
    expect(tracked).toHaveLength(6)
    expect(tracked.filter((r) => r.is_gps_tracker)).toHaveLength(6)
    for (const p of file.personas) {
      const id = byName.get(p.username)!
      if (p.role === 'runner') {
        const t = teams.get(p.assignment)!
        t.runners.push(id)
        if (p.gps) t.tracker = id
        expect(tracked.find((r) => r.user_id === id)).toMatchObject({ team_id: t.id, is_gps_tracker: p.gps })
      } else {
        bases.get(p.assignment)!.staff = id
        expect(await db.sql(`select 1 from public.base_staff where base_id = $1 and user_id = $2`, [bases.get(p.assignment)!.id, id])).toHaveLength(1)
      }
    }
    for (const t of teams.values()) expect(t.runners).toHaveLength(1) // one shared user per group, which is also its GPS tracker

    const ms = await db.sql<{ id: string; round_number: number; base_id: string; team_a: string; team_b: string }>(`select id, round_number, base_id, team_a, team_b from public.matches where event_id = $1 order by round_number`, [imp.eventId])
    expect(ms).toHaveLength(15)
    const T = new Map([...teams.values()].map((t) => [t.id, t]))
    const B = new Map([...bases.values()].map((b) => [b.id, b]))
    matches = ms.map((m) => ({ id: m.id, round: m.round_number, base: B.get(m.base_id)!, a: T.get(m.team_a)!, b: T.get(m.team_b)! }))
    expect(await db.sql(`select 1 from public.base_travel_times where event_id = $1`, [imp.eventId])).toHaveLength(6)
    for (const t of teams.values()) expected.set(t.id, 0)
    say(`Carga completa: 1 Carrera (borrador), 6 grupos, 3 bases con información, 6 corredores (con GPS), 3 inductores, 15 cruces, 6 tiempos. Nada se mezcló con la otra Carrera.`)
  })

  it('everything went to the new Carrera: the other one is untouched', async () => {
    const now = await counts(db)
    expect(now.events).toBe(baseline.events + 1)
    expect(now.teams).toBe(baseline.teams + 6)
    expect(now.bases).toBe(baseline.bases + 3)
    expect(now.profiles).toBe(baseline.profiles + 9)
    expect(now.matches).toBe(baseline.matches + 15)
    expect(now.match_scores).toBe(baseline.match_scores)
    expect(now.alerts).toBe(baseline.alerts)
  })

  it('the passwords are never stored: the file has none and the database has no column for them', async () => {
    const cols = await db.sql<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'profiles'`)
    expect(cols.map((c) => c.column_name).join()).not.toMatch(/pass/)
    expect(file.personas.every((p) => p.password.length >= 6)).toBe(true) // generated on upload, shown once
  })
})

describe('2. Prueba-en-vivo, steps 2-4: photos, then activate', () => {
  it('activation is BLOCKED until the 6 + 3 photos exist, and the message lists exactly what is missing', async () => {
    const [{ p }] = await db.asUser(admin).sql<{ p: string[] }>(`select public.event_problems($1) as p`, [imp.eventId])
    expect(p).toHaveLength(9)
    expect(p.filter((x) => /grupo/.test(x))).toHaveLength(6)
    expect(p.filter((x) => /base/.test(x) && /foto/.test(x))).toHaveLength(3)
    await expect(db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [imp.eventId])).rejects.toThrow(/No se puede activar la Carrera/)
    say('Activar sin fotos: bloqueado (9 problemas: 6 fotos de grupo + 3 fotos de base).')
  })

  it('adding only the team photos is still not enough', async () => {
    for (const t of teams.values()) await db.asUser(admin).sql(`update public.teams set photo_path = $2 where id = $1`, [t.id, `teams/${t.id}.jpg`])
    const [{ p }] = await db.asUser(admin).sql<{ p: string[] }>(`select public.event_problems($1) as p`, [imp.eventId])
    expect(p).toHaveLength(3)
    await expect(db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [imp.eventId])).rejects.toThrow(/foto del lugar/)
  })

  it('with every photo it activates; while the other Carrera is active only one can be (and the real one is switched off first)', async () => {
    for (const b of bases.values()) await db.asUser(admin).sql(`update public.bases set location_photo_path = $2 where id = $1`, [b.id, `bases/${b.id}.jpg`])
    expect((await db.asUser(admin).sql<{ p: string[] }>(`select public.event_problems($1) as p`, [imp.eventId]))[0].p).toEqual([])
    await db.sql(`update public.events set is_active = true where id = $1`, [other.eventId]) // the real Carrera was active
    await expect(db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [imp.eventId])).rejects.toThrow(/events_single_active/)
    await switchOffKeepingProgress(other.eventId)
    await db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [imp.eventId])
    const [ev] = await db.sql<{ is_active: boolean }>(`select is_active from public.events where id = $1`, [imp.eventId])
    expect(ev.is_active).toBe(true)
    say('Fotos subidas y Carrera ACTIVA (la otra se desactivó primero: solo puede haber una).')
  })

  it('a runner sees their Carrera; nothing of the OTHER Carrera is readable (0019), nor private data', async () => {
    const g = teams.get('Samuráis')!
    const r = db.asUser(g.runners[0])
    expect(await r.sql(`select id from public.matches where event_id = $1`, [imp.eventId])).toHaveLength(15)
    // 0019: every table of a Carrera is readable only by the people of that Carrera (and the coordinator).
    expect(await r.sql(`select id from public.matches where event_id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select id from public.teams where event_id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select id from public.bases where event_id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select id from public.events where id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select base_id from public.base_details where base_id = any($1)`, [other.bases.map((b) => b.id)])).toHaveLength(0)
    expect(await r.sql(`select base_id from public.base_questions where base_id = any($1)`, [other.bases.map((b) => b.id)])).toHaveLength(0)
    expect(await r.sql(`select id from public.alerts where event_id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select id from public.score_audit where event_id = $1`, [other.eventId])).toHaveLength(0)
    expect(await r.sql(`select 1 from public.team_locations where team_id = any($1)`, [other.teams.map((t) => t.id)])).toHaveLength(0)
    expect(await r.sql(`select 1 from public.push_subscriptions where user_id = $1`, [other.teams[0].runners[0]])).toHaveLength(0)
    // and it cannot act on it
    await expect(db.asUser(g.runners[0]).sql(`select public.confirm_arrival($1)`, [(await db.sql<{ id: string }>(`select id from public.matches where event_id = $1 limit 1`, [other.eventId]))[0].id])).rejects.toThrow()
  })
})

describe('3. playing the 5 rounds as the real roles', () => {
  async function playRound(round: number) {
    say(`\nRonda ${round}`)
    const rows = roundOf(round)
    for (const [idx, m] of rows.entries()) {
      const as = db.asUser(m.base.staff)
      await as.sql(`select public.confirm_arrival($1)`, [m.id])
      expect(await stateOf(m.id)).toBe('in_progress')
      const label = `${m.base.name}: ${m.a.name} vs ${m.b.name}`
      if (round === 2 && idx === 0) {
        // nobody has time for the minigame: only the coordinator can void it
        await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, m.a.id])
        await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, m.b.id])
        expected.set(m.a.id, expected.get(m.a.id)! + 1)
        expected.set(m.b.id, expected.get(m.b.id)! + 1)
        await expect(as.sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, 'minijuego', null, true)`, [m.id])).rejects.toThrow()
        await db.asUser(admin).sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, 'minijuego', null, true)`, [m.id])
        voided++
        say(`  ${label} — minijuego INVALIDADO por el coordinador (el inductor no pudo)`)
      } else if (round === 4 && idx === 0) {
        for (const item of ['barra', 'pregunta', 'minijuego']) {
          await db.asUser(admin).sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, $2, null, true)`, [m.id, item])
          voided++
        }
        say(`  ${label} — CANCELADO: 3 ítems invalidados`)
      } else {
        const win = new Map<string, number>([[m.a.id, 0], [m.b.id, 0]])
        for (const [k, item] of ['barra', 'pregunta', 'minijuego'].entries()) {
          const w = (k + round + idx) % 2 === 0 ? m.a : m.b // deterministic, mixes winners
          await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, w.id])
          expected.set(w.id, expected.get(w.id)! + 1)
          win.set(w.id, win.get(w.id)! + 1)
        }
        say(`  ${label}: ${win.get(m.a.id)}–${win.get(m.b.id)}`)
      }
      expect(await stateOf(m.id)).toBe('finished')
    }
  }

  it('an inductor cannot score a match of another base, nor skip ahead, nor edit a score', async () => {
    const r1 = roundOf(1)[0]
    const stranger = roundOf(1).find((m) => m.base.id !== r1.base.id)!.base.staff
    await expect(db.asUser(stranger).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [r1.id, r1.a.id])).rejects.toThrow()
    const later = matches.find((m) => m.base.id === r1.base.id && m.round === 2)!
    await expect(db.asUser(r1.base.staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [later.id, later.a.id])).rejects.toThrow(/Primero termina de calificar la ronda anterior/)
    await expect(db.asUser(r1.base.staff).sql(`select public.confirm_arrival($1)`, [stranger ? matches.find((m) => m.base.staff === stranger && m.round === 1)!.id : ''])).rejects.toThrow()
  })

  it('a runner can neither score nor confirm arrival', async () => {
    const m = roundOf(1)[0]
    await expect(db.asUser(m.a.runners[0]).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, m.a.id])).rejects.toThrow()
    await expect(db.asUser(m.a.runners[0]).sql(`select public.confirm_arrival($1)`, [m.id])).rejects.toThrow()
  })

  it('round 1', () => playRound(1))
  it('round 2 (one item voided by the coordinator)', () => playRound(2))

  describe('a group walks too slowly: per-leg times (3-5 min) instead of the general 8 min', () => {
    // round 2 -> 3 legs, from the file: Vikingos and Dioses Nórdicos walk a 4-min leg, Griegos and Gladiadores a 5-min leg;
    // Samuráis and Guerreros Aztecas play again at the base where they already are (they do not walk).
    const legMin = new Map<string, number>()
    const timed = async () => db.sql<TimedMatch>(`select id, round_number, base_id, team_a, team_b, status, arrived_at::text, finished_at::text from public.matches where event_id = $1`, [imp.eventId])
    const travel = async () => {
      const rows = await db.sql<{ from_base_id: string; to_base_id: string; minutes: number }>(`select from_base_id, to_base_id, minutes from public.base_travel_times where event_id = $1`, [imp.eventId])
      return new Map(rows.map((r) => [legKey(r.from_base_id, r.to_base_id), r.minutes]))
    }
    const ago = (s: number) => db.sql(`update public.matches set finished_at = now() - make_interval(secs => $2) where event_id = $1 and round_number = 2`, [imp.eventId, s])
    // independent model: who SHOULD be late `elapsed` seconds after round 2 (hand-written from the file, not from the code under test)
    const model = (elapsedSeconds: number): Team[] => {
      const late: Team[] = []
      for (const m3 of roundOf(3)) {
        for (const t of [m3.a, m3.b]) {
          const prev = roundOf(2).find((m) => m.a.id === t.id || m.b.id === t.id)!
          if (prev.base.id === m3.base.id) continue // does not walk
          const allowed = legMin.get(legKey(prev.base.id, m3.base.id)) ?? 8
          if (Math.floor(elapsedSeconds / 60) >= allowed) late.push(t)
        }
      }
      return late
    }

    it('4 min 20 s after round 2: with the general 8 min nobody is late, with the leg times Vikingos and Nórdicos are', async () => {
      for (const r of await db.sql<{ from_base_id: string; to_base_id: string; minutes: number }>(`select from_base_id, to_base_id, minutes from public.base_travel_times where event_id = $1`, [imp.eventId])) {
        legMin.set(legKey(r.from_base_id, r.to_base_id), r.minutes)
      }
      await ago(260)
      const rows = await timed()
      expect(lateTeams(rows, 8, Date.now())).toHaveLength(0) // general only
      const late = lateTeams(rows, 8, Date.now(), await travel())
      expect(new Set(late.map((l) => l.teamId))).toEqual(new Set([teams.get('Vikingos')!.id, teams.get('Dioses Nórdicos')!.id]))
      expect(new Set(model(260).map((t) => t.id))).toEqual(new Set(late.map((l) => l.teamId)))

      await db.clearHttpCalls()
      await db.sql(`select public.check_delays()`)
      const sent = await pushes()
      expect(new Set(sent.flatMap((n) => n.user_ids))).toEqual(usersOf(teams.get('Vikingos')!, teams.get('Dioses Nórdicos')!)) // only THEIR runners
      expect(sent).toHaveLength(2)
      expect(sent.every((n) => /Apúrate hacia (Atrio|Cancha de Fútbol) \(máximo 4 min\)/.test(n.body))).toBe(true)
      say(`\nDemora a los 4 min 20 s (tiempos por tramo): Vikingos y Dioses Nórdicos (4 min). Con el general de 8 min no habría alerta. Notificados solo sus 4 corredores.`)
    })

    it('the group that repeats its base (Samuráis, Guerreros Aztecas) is never warned, however long it takes', async () => {
      await ago(20 * 60)
      await db.clearHttpCalls()
      await db.sql(`select public.check_delays()`)
      const notified = new Set((await pushes()).flatMap((n) => n.user_ids))
      for (const name of ['Samuráis', 'Guerreros Aztecas']) for (const u of teams.get(name)!.runners) expect(notified.has(u)).toBe(false)
      // everyone who really walks is late after 20 min: 4 groups
      expect(notified).toEqual(usersOf(...['Vikingos', 'Dioses Nórdicos', 'Dioses Griegos', 'Gladiadores'].map((n) => teams.get(n)!)))
      const rows = await timed()
      expect(lateTeams(rows, 8, Date.now(), await travel())).toHaveLength(4)
    })

    it('a group that RESTS a round is not warned either (checked in a transaction that is rolled back)', async () => {
      const m = roundOf(3).find((x) => x.a.name === 'Vikingos' || x.b.name === 'Vikingos')! // Vikingos v Samuráis
      await db.pg.exec('begin')
      try {
        await db.sql(`delete from public.matches where id = $1`, [m.id]) // nobody plays this match: both rest in round 3
        await db.clearHttpCalls()
        await db.sql(`select public.check_delays()`)
        const notified = new Set((await pushes()).flatMap((n) => n.user_ids))
        for (const t of [m.a, m.b]) for (const u of t.runners) expect(notified.has(u), `${t.name} rests`).toBe(false)
        expect(notified).toEqual(usersOf(...['Dioses Nórdicos', 'Dioses Griegos', 'Gladiadores'].map((n) => teams.get(n)!)))
      } finally {
        await db.pg.exec('rollback')
      }
      expect(await db.sql(`select 1 from public.matches where id = $1`, [m.id])).toHaveLength(1)
    })

    it('manual alerts: coordinator and a base reach only the runners of that match; a base is limited to one per 20 s, the coordinator is not', async () => {
      const target = roundOf(3).find((m) => m.a.name === 'Gladiadores' || m.b.name === 'Gladiadores')! // Gladiadores v Nórdicos at the Cancha
      const both = usersOf(target.a, target.b)
      await db.clearHttpCalls()
      await db.asUser(admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense, la base los espera')`, [imp.eventId, target.id])
      await db.asUser(admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Otra vez')`, [imp.eventId, target.id]) // no limit for the coordinator
      await db.asUser(target.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Seguimos esperando')`, [imp.eventId, target.id])
      const sent = await pushes()
      expect(sent).toHaveLength(3)
      for (const n of sent) expect(new Set(n.user_ids)).toEqual(both)

      // 2nd alert of the base to the same match within 20 s: refused, and nothing is pushed
      await expect(
        db.asUser(target.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Ya')`, [imp.eventId, target.id]),
      ).rejects.toThrow(/Espera unos segundos/)
      expect(await pushes()).toHaveLength(3)
      // other bases are not blocked by this one, and 21 s later it can alert again
      const otherMatch = roundOf(3).find((m) => m.base.id !== target.base.id)!
      await db.asUser(otherMatch.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Hola')`, [imp.eventId, otherMatch.id])
      await db.sql(`update public.alerts set created_at = now() - interval '21 seconds' where match_id = $1 and created_by = $2`, [target.id, target.base.staff])
      await db.asUser(target.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Ahora sí')`, [imp.eventId, target.id])
      // a base cannot alert a match of another base nor stamp another Carrera
      await expect(db.asUser(target.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'x')`, [imp.eventId, otherMatch.id])).rejects.toThrow()
      await expect(db.asUser(target.base.staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'x')`, [other.eventId, target.id])).rejects.toThrow()
      // a runner of ANOTHER match cannot read it
      const outsider = roundOf(3).find((m) => m.id !== target.id && ![m.a.id, m.b.id].some((id) => [target.a.id, target.b.id].includes(id)))
      if (outsider) expect(await db.asUser(outsider.a.runners[0]).sql(`select id from public.alerts where match_id = $1`, [target.id])).toHaveLength(0)
      expect((await db.asUser(target.a.runners[0]).sql(`select id from public.alerts where match_id = $1`, [target.id])).length).toBe(4)
      say('Avisos manuales: el coordinador sin límite; una base, 1 cada 20 s por cruce (el segundo fue rechazado y no generó notificación).')
    })

    it('when the inductors confirm arrival, the warnings stop', async () => {
      for (const m of roundOf(3)) await db.asUser(m.base.staff).sql(`select public.confirm_arrival($1)`, [m.id])
      await db.clearHttpCalls()
      await db.sql(`select public.check_delays()`)
      expect(await pushes()).toHaveLength(0)
    })
  })

  it('round 3 (arrival already confirmed) + the coordinator corrects a score', async () => {
    // the arrivals were confirmed above; score the round
    say(`\nRonda 3`)
    for (const [idx, m] of roundOf(3).entries()) {
      const win = new Map<string, number>([[m.a.id, 0], [m.b.id, 0]])
      for (const [k, item] of ['barra', 'pregunta', 'minijuego'].entries()) {
        const w = (k + 3 + idx) % 2 === 0 ? m.a : m.b
        await db.asUser(m.base.staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, w.id])
        expected.set(w.id, expected.get(w.id)! + 1)
        win.set(w.id, win.get(w.id)! + 1)
      }
      say(`  ${m.base.name}: ${m.a.name} ${win.get(m.a.id)}–${win.get(m.b.id)} ${m.b.name}`)
      expect(await stateOf(m.id)).toBe('finished')
    }
    const m = roundOf(3)[1]
    const [row] = await db.sql<{ winner_team_id: string }>(`select winner_team_id from public.match_scores where match_id = $1 and item = 'barra'`, [m.id])
    const [from, to] = row.winner_team_id === m.a.id ? [m.a, m.b] : [m.b, m.a]
    expect(await db.asUser(m.base.staff).affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m.id, to.id])).toBe(0) // the base cannot take it back
    expect(await db.asUser(admin).affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m.id, to.id])).toBe(1)
    expected.set(from.id, expected.get(from.id)! - 1)
    expected.set(to.id, expected.get(to.id)! + 1)
    corrected++
    say(`  Corrección del coordinador (barra, ${m.a.name} vs ${m.b.name}): ${from.name} → ${to.name}`)
  })

  it('round 4 (a match is cancelled)', () => playRound(4))

  describe('GPS: the 6 tracker runners report; Prueba-en-vivo says a silent group goes to "Sin señal" and disappears after 1 hour', () => {
    it('each tracker writes its own group; the second runner of a group and other groups cannot', async () => {
      for (const [i, t] of [...teams.values()].entries()) {
        await db.asUser(t.tracker).sql(
          `insert into public.team_locations (team_id, lat, lng, accuracy) values ($1, $2, $3, 8) on conflict (team_id) do update set lat = excluded.lat, lng = excluded.lng`,
          [t.id, 4.628 + i / 5000, -74.064 - i / 5000],
        )
      }
      expect(await db.asUser(admin).sql(`select 1 from public.team_locations where team_id = any($1)`, [[...teams.values()].map((t) => t.id)])).toHaveLength(6)
      const g = teams.get('Samuráis')!
      const second = teams.get('Gladiadores')!.tracker // another group's phone
      expect(await db.asUser(second).affected(`update public.team_locations set lat = 0 where team_id = $1`, [g.id])).toBe(0)
      await expect(db.asUser(second).sql(`insert into public.team_locations (team_id, lat, lng) values ($1, 1, 1) on conflict (team_id) do update set lat = 1`, [g.id])).rejects.toThrow()
      const v = teams.get('Vikingos')!
      expect(await db.asUser(g.tracker).affected(`update public.team_locations set lat = 0 where team_id = $1`, [v.id])).toBe(0)
      expect(await db.asUser(g.runners[0]).sql(`select * from public.team_locations where team_id = $1`, [v.id])).toHaveLength(0)
      say('\nGPS: los 6 corredores designados reportaron; el coordinador ve 6; un corredor sin GPS o de otro grupo no escribe ni lee.')
    })

    it('the live map hides a position older than 1 hour (client rule): 5 of 6 groups remain', async () => {
      const g = teams.get('Gladiadores')!
      await db.sql(`alter table public.team_locations disable trigger team_locations_stamp`)
      await db.sql(`update public.team_locations set updated_at = now() - interval '61 minutes' where team_id = $1`, [g.id])
      await db.sql(`update public.team_locations set updated_at = now() - interval '10 minutes' where team_id = $1`, [teams.get('Vikingos')!.id])
      await db.sql(`alter table public.team_locations enable trigger team_locations_stamp`)
      const rows = await db.asUser(admin).sql<{ team_id: string; updated_at: string }>(`select team_id, updated_at::text as updated_at from public.team_locations where team_id = any($1)`, [[...teams.values()].map((t) => t.id)])
      const visible = rows.filter((r) => isLocationFresh(r.updated_at, Date.now()))
      expect(visible).toHaveLength(5)
      expect(visible.some((r) => r.team_id === g.id)).toBe(false)
      say('Mapa: Gladiadores lleva 61 min sin señal y desaparece; Vikingos (10 min) sigue visible como "sin señal reciente".')
    })

    it('isLocationFresh boundaries (the 1-hour rule lives on the client)', () => {
      const now = Date.parse('2027-01-20T15:00:00Z')
      const at = (ms: number) => new Date(now - ms).toISOString()
      expect(isLocationFresh(at(0), now)).toBe(true)
      expect(isLocationFresh(at(LOCATION_HIDE_AFTER_MS - 1), now)).toBe(true)
      expect(isLocationFresh(at(LOCATION_HIDE_AFTER_MS), now)).toBe(false) // exactly one hour is already hidden
      expect(isLocationFresh(at(LOCATION_HIDE_AFTER_MS + 1), now)).toBe(false)
      expect(isLocationFresh(at(-5 * 60 * 1000), now)).toBe(true) // a phone clock a little ahead never hides a live group
      expect(isLocationFresh('not a date', now)).toBe(false) // garbage is hidden, not shown as a ghost
    })
  })

  it('switching the Carrera off mid-race: the phones lose it at once and the inductor cannot act; switching it on again resumes', async () => {
    const m5 = roundOf(5)[0]
    await db.pg.exec('begin') // 0020: switching a Carrera off resets it, so this check is rolled back
    try {
      await db.asUser(admin).sql(`update public.events set is_active = false where id = $1`, [imp.eventId])
      // "Cambio de Carrera": the phones drop it because events is in Realtime and they filter on is_active (client-side).
      // They cannot ACT on it:
      // (a refused statement aborts the transaction, so each one runs inside a savepoint)
      const refused = async (run: () => Promise<unknown>) => {
        await db.pg.exec('savepoint refused')
        await expect(run()).rejects.toThrow()
        await db.pg.exec('rollback to savepoint refused')
      }
      await refused(() => db.asUser(m5.base.staff).sql(`select public.confirm_arrival($1)`, [m5.id]))
      await refused(() => db.asUser(m5.base.staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m5.id, m5.a.id]))
      expect(await db.sql(`select 1 from public.match_scores where match_id = $1`, [m5.id])).toHaveLength(0)
      // the coordinator still sees and can correct
      expect((await db.asUser(admin).sql(`select id from public.matches where event_id = $1`, [imp.eventId])).length).toBe(15)
      // no alert while it is off
      await db.sql(`update public.matches set finished_at = now() - interval '30 minutes' where event_id = $1 and round_number = 4`, [imp.eventId])
      await db.clearHttpCalls()
      await db.sql(`select public.check_delays()`)
      expect(await pushes()).toHaveLength(0)
      await db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [imp.eventId])
      expect(await db.asUser(m5.a.runners[0]).sql(`select id from public.matches where event_id = $1`, [imp.eventId])).toHaveLength(15)
      say('\nDesactivar a mitad de la Carrera: corredores e inductores dejan de verla, el inductor no puede confirmar ni calificar, no hay alertas. Reactivada, todo vuelve.')
    } finally {
      await db.pg.exec('rollback')
    }
  })

  it('round 5', async () => {
    await db.sql(`update public.matches set finished_at = now() - interval '30 seconds' where event_id = $1 and round_number = 4`, [imp.eventId])
    await playRound(5)
  })
})

describe('4. the final result and privacy', () => {
  it('all 15 matches finished with their finish time', async () => {
    const rows = await db.sql<{ status: string; f: boolean }>(`select status, finished_at is not null as f from public.matches where event_id = $1`, [imp.eventId])
    expect(rows.every((r) => r.status === 'finished' && r.f)).toBe(true)
  })

  it('the database standings equal an independent count of every point (voided items count for nobody)', async () => {
    const table = await db.asUser(admin).sql<{ team_id: string; name: string; points: string }>(`select team_id, name, points from public.team_standings where event_id = $1`, [imp.eventId])
    const actual = new Map(table.map((r) => [r.team_id, Number(r.points)]))
    for (const t of teams.values()) expect(actual.get(t.id), `points of ${t.name}`).toBe(expected.get(t.id))
    expect(voided).toBe(4)
    expect([...actual.values()].reduce((a, b) => a + b, 0)).toBe(45 - voided)
    say('\nRanking final')
    ;[...table].sort((a, b) => Number(b.points) - Number(a.points)).forEach((r, i) => say(`  ${i + 1}. ${r.name}  ${r.points} pts`))
  })

  it('every change is in the audit log with who made it: 45 inserts and 1 correction, attributed to this Carrera', async () => {
    const rows = await db.asUser(admin).sql<{ action: string; n: string }>(`select action, count(*)::text as n from public.score_audit where event_id = $1 group by action`, [imp.eventId])
    const by = Object.fromEntries(rows.map((r) => [r.action, Number(r.n)]))
    expect(by).toEqual({ insert: 45, update: corrected })
    const who = await db.sql<{ w: string }>(`select distinct changed_by as w from public.score_audit where event_id = $1`, [imp.eventId])
    const allowed = new Set([admin, ...[...bases.values()].map((b) => b.staff)])
    expect(who.every((r) => allowed.has(r.w))).toBe(true)
    // runners and inductors cannot read it
    expect(await db.asUser(teams.get('Samuráis')!.runners[0]).sql(`select 1 from public.score_audit`)).toHaveLength(0)
    expect(await db.asUser(bases.get('Atrio')!.staff).sql(`select 1 from public.score_audit`)).toHaveLength(0)
  })

  it('privacy: a runner never reads base info or questions; an inductor reads only his own base; the public key reads nothing', async () => {
    const r = db.asUser(teams.get('Dioses Griegos')!.runners[0])
    expect(await r.sql(`select * from public.base_details`)).toHaveLength(0)
    expect(await r.sql(`select * from public.base_questions`)).toHaveLength(0)
    expect(await r.sql(`select * from public.team_locations`)).toHaveLength(1) // only its own group (it is the tracker)
    const rb = db.asUser(bases.get('Atrio')!.staff)
    expect(await rb.sql(`select * from public.team_locations`)).toHaveLength(0) // an inductor sees no position at all
    const atrio = bases.get('Atrio')!
    const mine = await db.asUser(atrio.staff).sql<{ base_id: string }>(`select base_id from public.base_details`)
    expect(mine.map((x) => x.base_id)).toEqual([atrio.id])
    expect(await db.asUser(atrio.staff).sql(`select * from public.base_questions`)).toHaveLength(3)
    const anon = db.asAnon()
    for (const t of ['matches', 'teams', 'bases', 'base_details', 'match_scores', 'team_locations', 'alerts', 'profiles']) {
      expect(await anon.sql(`select * from public.${t}`), t).toHaveLength(0)
    }
    // none of the 9 people can read the other Carrera's base info either
    expect(await db.asUser(atrio.staff).sql(`select 1 from public.base_details where base_id = any($1)`, [other.bases.map((b) => b.id)])).toHaveLength(0)
  })

  it('role escalation attempts from a phone fail: a runner cannot make himself admin, move groups or edit the Carrera', async () => {
    const t = teams.get('Samuráis')!
    const r = db.asUser(t.runners[0])
    expect(await r.affected(`update public.profiles set role = 'admin' where id = $1`, [t.runners[0]])).toBe(0)
    expect(await r.affected(`update public.events set name = 'hackeado' where id = $1`, [imp.eventId])).toBe(0)
    expect(await r.affected(`delete from public.events where id = $1`, [imp.eventId])).toBe(0)
    expect(await r.affected(`update public.matches set status = 'finished' where event_id = $1`, [imp.eventId])).toBe(0)
    await expect(r.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [teams.get('Vikingos')!.id, t.runners[0]])).rejects.toThrow()
    const i = db.asUser(bases.get('Atrio')!.staff)
    expect(await i.affected(`update public.profiles set role = 'admin' where id = $1`, [bases.get('Atrio')!.staff])).toBe(0)
    expect(await i.affected(`update public.match_scores set winner_team_id = null, voided = true where match_id = any($1)`, [matches.map((m) => m.id)])).toBe(0)
    expect((await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [t.runners[0]]))[0].role).toBe('runner')
  })

  it('push subscriptions of three phones (written by /api/push with the service role): each user sees only their own', async () => {
    const a = teams.get('Samuráis')!.runners[0]
    const b = teams.get('Vikingos')!.runners[0]
    for (const [u, e] of [[a, 'https://push.test/a'], [b, 'https://push.test/b'], [bases.get('Atrio')!.staff, 'https://push.test/i']] as const) {
      await db.sql(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'k', 'a')`, [u, e])
    }
    expect(await db.asUser(a).sql(`select * from public.push_subscriptions`)).toHaveLength(1)
  })
})

describe('5. cleaning up: deactivate and DELETE the Carrera exactly like Carrera.tsx (DeleteEvent)', () => {
  it('only a DEACTIVATED Carrera can be deleted: the database refuses to delete an active one (0019)', async () => {
    await expect(db.asUser(admin).sql(`delete from public.events where id = $1`, [imp.eventId])).rejects.toThrow(/Desactiva la Carrera antes de eliminarla/)
    expect(await db.sql(`select 1 from public.events where id = $1`, [imp.eventId])).toHaveLength(1)
  })

  it('listing the people AFTER deleting the Carrera finds nobody (why DeleteEvent lists them first)', async () => {
    await db.pg.exec('begin')
    try {
      await db.asUser(admin).sql(`update public.events set is_active = false where id = $1`, [imp.eventId])
      await db.asUser(admin).sql(`delete from public.events where id = $1`, [imp.eventId])
      const people = await db.asUser(admin).sql(`select id from public.profiles where event_id = $1 and role <> 'admin'`, [imp.eventId])
      expect(people).toHaveLength(0)
      const orphans = await db.asUser(admin).sql(`select id from public.profiles where username like 'prueba.%' and event_id is null`)
      expect(orphans).toHaveLength(9) // they would stay as "Sin Carrera asignada"
    } finally {
      await db.pg.exec('rollback')
    }
  })

  it('deactivate, list the profiles, delete the event, delete those users: nothing of the Carrera is left', async () => {
    // the Carrera has real leftovers to clean: scores, audit, alerts, positions, times, subscriptions
    const before = await counts(db)
    expect(before.score_audit).toBeGreaterThan(baseline.score_audit + 40)
    expect(before.alerts).toBeGreaterThan(baseline.alerts)
    expect(before.team_locations).toBe(baseline.team_locations + 6)
    expect(before.push_subscriptions).toBe(baseline.push_subscriptions + 3)
    // switching it off RESETS the progress (0020): scores, audit, alerts and positions are gone, the structure stays
    await db.asUser(admin).sql(`update public.events set is_active = false where id = $1`, [imp.eventId])
    const reset = await counts(db)
    expect(reset.score_audit).toBe(baseline.score_audit)
    expect(reset.alerts).toBe(baseline.alerts)
    expect(reset.team_locations).toBe(baseline.team_locations)
    expect(reset.match_scores).toBe(baseline.match_scores)
    expect(reset.matches).toBe(before.matches) // the schedule stays
    expect(reset.teams).toBe(before.teams)
    expect(reset.bases).toBe(before.bases)

    // ---- DeleteEvent.remove(), step by step, with RLS as the coordinator ----
    const sb = db.asUser(admin)
    const people = await sb.sql<{ id: string }>(`select id from public.profiles where event_id = $1 and role <> 'admin'`, [imp.eventId])
    expect(people).toHaveLength(9)
    expect(await sb.affected(`delete from public.events where id = $1`, [imp.eventId])).toBe(1)
    for (const p of people) {
      // api/users.ts DELETE: auth.admin.deleteUser (the profile cascades). The API refuses to delete the caller.
      expect(p.id).not.toBe(admin)
      await db.sql(`delete from auth.users where id = $1`, [p.id])
    }

    // ---- nothing of it is left ----
    const after = await counts(db)
    // every table is exactly as before the file was loaded, the audit log included (0019)
    expect(after).toEqual({ ...baseline, score_audit: baseline.score_audit + ORPHAN_AUDIT_ROWS })
    const ev = imp.eventId
    expect(await db.sql(`select 1 from public.teams where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.bases where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.matches where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.score_audit where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.alerts where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.base_travel_times where event_id = $1`, [ev])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.profiles where username like 'prueba.%'`)).toHaveLength(0)
    expect(await db.sql(`select 1 from auth.users where email like 'prueba.%'`)).toHaveLength(0)
    // photos stay in Storage (the screen says so): the stub has no objects, nothing to check there
    say('\nEliminar Carrera: se borraron 1 Carrera, 6 grupos, 3 bases, 15 cruces, puntajes, auditoría, avisos, 6 ubicaciones, 6 tiempos, suscripciones y los 9 usuarios. Todas las tablas quedaron igual que antes de cargar el archivo.')
  })

  it('deleting a Carrera leaves no orphan audit rows (0019)', async () => {
    const orphans = await db.sql(`select 1 from public.score_audit where event_id is null`)
    expect(orphans).toHaveLength(0)
  })

  it('the other Carrera and the coordinator are untouched, and the coordinator can keep working', async () => {
    expect(await db.sql(`select 1 from public.profiles where id = $1 and role = 'admin'`, [admin])).toHaveLength(1)
    const o = await db.asUser(admin).sql<{ n: string }>(`select count(*)::text as n from public.match_scores where match_id in (select id from public.matches where event_id = $1)`, [other.eventId])
    expect(Number(o[0].n)).toBe(3)
    expect(await db.asUser(admin).sql(`select 1 from public.alerts where event_id = $1`, [other.eventId])).toHaveLength(1)
    expect(await db.asUser(admin).sql(`select 1 from public.score_audit where event_id = $1`, [other.eventId])).toHaveLength(3)
    await db.asUser(admin).sql(`update public.events set is_active = true where id = $1`, [other.eventId]) // and the real one can be activated again
    expect(await db.asUser(other.teams[0].runners[0]).sql(`select 1 from public.matches where event_id = $1`, [other.eventId])).not.toHaveLength(0)
    await db.asUser(admin).sql(`update public.events set is_active = false where id = $1`, [other.eventId])
  })

  it('the usernames of the deleted Carrera are free again: the same file can be loaded a second time as a new Carrera', async () => {
    const ld = await loadExisting(db, admin, null)
    const again = validateFile(await readFile(), ld.existing)
    expect(countErrors(again)).toBe(0)
    const r = await runImport(db, admin, again, { id: null, name: again.carrera!.name }, new Set())
    expect(r.report.problems).toEqual([])
    expect(r.report.users.every((u) => u.ok)).toBe(true)
    expect((await counts(db)).profiles).toBe(baseline.profiles + 9)
  })
})

describe('6. loading the same file twice must fail cleanly and corrupt nothing', () => {
  let db2: TestDb
  let admin2: string
  let first: Imported
  let snapshot: Record<string, number>

  beforeAll(async () => {
    db2 = await createDb()
    admin2 = await getAdmin(db2)
    const ld = await loadExisting(db2, admin2, null)
    first = await runImport(db2, admin2, validateFile(await readFile(), ld.existing), { id: null, name: 'Prueba 20 de enero' }, new Set())
    expect(first.report.problems).toEqual([])
    snapshot = await counts(db2)
  })
  afterAll(async () => db2.close())

  it('the preview of the second upload shows an error for every one of the 9 usernames and the button stays disabled', async () => {
    const ld = await loadExisting(db2, admin2, first.eventId) // same Carrera name -> same Carrera
    const checked = validateFile(await readFile(), ld.existing)
    expect(countErrors(checked)).toBeGreaterThan(0)
    expect(checked.personas.filter((p) => p.errors.length > 0)).toHaveLength(9)
    expect(checked.personas.every((p) => p.errors.join(' ').match(/ya existe|existe/i))).toBe(true)
    // and the matches / groups / bases that already exist are flagged too, so nothing silently duplicates
    expect(checked.cruces.filter((c) => c.errors.length > 0).length).toBe(15)
  })

  it('even forcing the load (a stale preview, two tabs): each user fails with a readable message, nothing is duplicated, nothing is deleted', async () => {
    const ld = await loadExisting(db2, admin2, first.eventId)
    const second = await runImport(db2, admin2, validateFile(await readFile(), ld.existing), { id: first.eventId, name: 'Prueba 20 de enero' }, ld.trackers)
    expect(second.eventId).toBe(first.eventId)
    expect(second.report.users).toHaveLength(9)
    expect(second.report.users.every((u) => !u.ok && /ya existe/i.test(u.note))).toBe(true)
    expect(second.report.problems).toHaveLength(15) // the 15 matches are refused by the unique rules
    expect(second.report.problems.every((p) => /Cruce de la ronda/.test(p))).toBe(true)
    expect(await counts(db2)).toEqual(snapshot) // identical to after the first load
    // the first load still works: its users keep their assignments and the Carrera can be activated after photos
    const people = await db2.sql<{ n: string }>(`select count(*)::text as n from public.team_runners tr join public.teams t on t.id = tr.team_id where t.event_id = $1 and tr.is_gps_tracker`, [first.eventId])
    expect(Number(people[0].n)).toBe(6)
  })

  it('loading it into a brand-new Carrera name still fails per user (usernames are global), and leaves no half-built people', async () => {
    const file = await readFile()
    const r = await runImport(db2, admin2, validateFile({ ...file, carrera: { ...file.carrera!, name: 'Otra Carrera' } }, (await loadExisting(db2, admin2, null)).existing), { id: null, name: 'Otra Carrera' }, new Set())
    expect(r.report.users.every((u) => !u.ok)).toBe(true)
    // the Carrera, groups, bases and matches of that second Carrera were created (the screen would have blocked it in the preview),
    // but no user or profile was duplicated: the 9 originals are the only ones
    expect(await db2.sql(`select 1 from public.profiles where username like 'prueba.%'`)).toHaveLength(9)
    expect(await db2.sql(`select 1 from auth.users where email like 'prueba.%'`)).toHaveLength(9)
    expect(await db2.sql(`select 1 from public.team_runners tr join public.teams t on t.id = tr.team_id where t.event_id = $1`, [r.eventId])).toHaveLength(0)
    // the first Carrera is intact
    expect(await db2.sql(`select 1 from public.matches where event_id = $1`, [first.eventId])).toHaveLength(15)
    say('\nCargar el mismo archivo dos veces: la vista previa marca los 9 usuarios, el botón queda bloqueado; forzándolo, cada usuario falla con "Ya existe" y no cambia ninguna tabla.')
  })
})
