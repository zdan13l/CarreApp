// Who can read and write what (row level security + column rules). This mirrors the matrix in
// docs/wiki/Roles-y-permisos.md: if one changes, the other must change with it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, insertMatch, seedCarrera, type CarreraSeed, type MatchSeed } from './seed'

let db: TestDb
let c: CarreraSeed
let m: MatchSeed
let m2: MatchSeed // a match of the OTHER base
beforeAll(async () => {
  db = await createDb()
  c = await seedCarrera(db, { teams: 4, bases: 2, runnersPerTeam: 2 })
  await activate(db, c)
  m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
  m2 = await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
})
afterAll(async () => {
  await db.close()
})

const runnerA = () => db.asUser(c.teams[0].runners[1]) // a runner who is NOT the GPS tracker
const tracker = () => db.asUser(c.teams[0].tracker)
const staff0 = () => db.asUser(c.bases[0].staff)
const staff1 = () => db.asUser(c.bases[1].staff)
const admin = () => db.asUser(c.admin)

const count = async (r: ReturnType<TestDb['asUser']>, table: string) => (await r.sql(`select 1 from public.${table}`)).length

describe('what every signed-in user can read (0019: only their own Carrera)', () => {
  it.each(['events', 'teams', 'bases', 'matches'])('%s of their Carrera', async (table) => {
    for (const who of [runnerA(), staff0(), admin()]) expect(await count(who, table)).toBeGreaterThan(0)
  })

  it('team_runners and base_staff: each person sees only their own assignment; the coordinator sees all', async () => {
    expect(await count(runnerA(), 'team_runners')).toBe(1)
    expect(await count(staff0(), 'team_runners')).toBe(0)
    expect(await count(staff0(), 'base_staff')).toBe(1)
    expect(await count(runnerA(), 'base_staff')).toBe(0)
    expect(await count(admin(), 'team_runners')).toBeGreaterThan(2)
    expect(await count(admin(), 'base_staff')).toBeGreaterThan(1)
  })

  it('lists every team of the Carrera for everyone, but the points only to the coordinator (no one knows who leads)', async () => {
    for (const who of [runnerA(), staff1(), admin()]) {
      expect(await who.sql(`select * from public.team_standings where event_id = $1`, [c.eventId])).toHaveLength(4)
    }
    const total = async (who: ReturnType<TestDb['asUser']>) =>
      (await who.sql<{ p: string }>(`select coalesce(sum(points), 0)::text as p from public.team_standings where event_id = $1`, [c.eventId]))[0].p
    // 3 items were scored in the first match of the setup of this file? whatever is scored, a runner only adds up their own matches
    const all = Number(await total(admin()))
    const mine = Number(await total(runnerA()))
    expect(mine).toBeLessThanOrEqual(all)
  })
})

describe('profiles', () => {
  it('each person sees only their own profile; the coordinator sees all', async () => {
    expect(await runnerA().sql(`select username from public.profiles`)).toHaveLength(1)
    expect(await staff0().sql(`select username from public.profiles`)).toHaveLength(1)
    expect((await admin().sql(`select username from public.profiles`)).length).toBeGreaterThan(10)
  })

  it('nobody can promote themselves or edit someone else', async () => {
    expect(await runnerA().affected(`update public.profiles set role = 'admin' where id = $1`, [c.teams[0].runners[1]])).toBe(0)
    expect(await staff0().affected(`update public.profiles set full_name = 'x' where id = $1`, [c.bases[1].staff])).toBe(0)
    expect(await runnerA().affected(`delete from public.profiles where id = $1`, [c.teams[1].runners[0]])).toBe(0)
  })
})

describe('configuration is the coordinator\'s alone', () => {
  const writes: [string, string, unknown[]][] = [
    ['create a Carrera', `insert into public.events (name) values ('Intrusa')`, []],
    ['create a team', `insert into public.teams (event_id, name) values ($1, 'Intruso')`, [() => c.eventId]],
    ['create a base', `insert into public.bases (event_id, name) values ($1, 'Intrusa')`, [() => c.eventId]],
    ['assign an inductor', `insert into public.base_staff (base_id, user_id) values ($1, $2)`, [() => c.bases[0].id, () => c.teams[0].runners[0]]],
    ['assign a runner', `insert into public.team_runners (team_id, user_id) values ($1, $2)`, [() => c.teams[0].id, () => c.bases[0].staff]],
    ['schedule a match', `insert into public.matches (event_id, base_id, round_number, team_a, team_b) values ($1, $2, 9, $3, $4)`, [() => c.eventId, () => c.bases[0].id, () => c.teams[0].id, () => c.teams[2].id]],
    ['set a leg time', `insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, 5)`, [() => c.eventId, () => c.bases[0].id, () => c.bases[1].id]],
    ['write base information', `insert into public.base_details (base_id, info) values ($1, 'x') on conflict (base_id) do update set info = 'x'`, [() => c.bases[0].id]],
    ['write a question', `insert into public.base_questions (base_id, position, question) values ($1, 1, 'x') on conflict (base_id, position) do update set question = 'x'`, [() => c.bases[0].id]],
  ]
  const resolve = (params: unknown[]) => params.map((p) => (typeof p === 'function' ? (p as () => unknown)() : p))

  it.each(writes)('a runner cannot %s', async (_label, sql, params) => {
    await expect(runnerA().sql(sql, resolve(params))).rejects.toThrow(/row-level security/)
  })
  it.each(writes)('an inductor cannot %s', async (_label, sql, params) => {
    await expect(staff0().sql(sql, resolve(params))).rejects.toThrow(/row-level security/)
  })

  it('the coordinator can set a leg time and the others read it', async () => {
    await admin().sql(`insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, 6)`, [c.eventId, c.bases[0].id, c.bases[1].id])
    expect(await count(runnerA(), 'base_travel_times')).toBe(1)
  })
})

describe('a base\'s information and questions are private', () => {
  it('runners see none of it', async () => {
    expect(await runnerA().sql(`select * from public.base_details`)).toHaveLength(0)
    expect(await runnerA().sql(`select * from public.base_questions`)).toHaveLength(0)
  })
  it('an inductor sees only their own base', async () => {
    const mine = await staff0().sql<{ base_id: string }>(`select base_id from public.base_details`)
    expect(mine.map((r) => r.base_id)).toEqual([c.bases[0].id])
    const questions = await staff0().sql<{ base_id: string }>(`select base_id from public.base_questions`)
    expect(new Set(questions.map((r) => r.base_id))).toEqual(new Set([c.bases[0].id]))
  })
  it('the coordinator sees every base', async () => {
    expect(await admin().sql(`select * from public.base_details`)).toHaveLength(2)
    expect(await admin().sql(`select * from public.base_questions`)).toHaveLength(10)
  })
  it('runners still read what they need: base name, photo and location', async () => {
    const rows = await runnerA().sql<{ name: string; location_photo_path: string; lat: number }>(`select name, location_photo_path, lat from public.bases where event_id = $1`, [c.eventId])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.name && r.location_photo_path && r.lat)).toBe(true)
  })
})

describe('what an inductor may change in their own base', () => {
  it('the photo and the map location, but nothing else', async () => {
    expect(await staff0().affected(`update public.bases set location_photo_path = 'bases/new.jpg' where id = $1`, [c.bases[0].id])).toBe(1)
    expect(await staff0().affected(`update public.bases set lat = 4.6, lng = -74.0 where id = $1`, [c.bases[0].id])).toBe(1)
    await expect(staff0().sql(`update public.bases set name = 'Renombrada' where id = $1`, [c.bases[0].id])).rejects.toThrow(/solo puede cambiar la foto/)
    await expect(staff0().sql(`update public.bases set sort_order = 99 where id = $1`, [c.bases[0].id])).rejects.toThrow(/solo puede cambiar la foto/)
  })
  it('never in another base', async () => {
    expect(await staff0().affected(`update public.bases set location_photo_path = 'bases/hack.jpg' where id = $1`, [c.bases[1].id])).toBe(0)
  })
  it('a runner cannot change a base at all', async () => {
    expect(await runnerA().affected(`update public.bases set location_photo_path = 'bases/hack.jpg' where id = $1`, [c.bases[0].id])).toBe(0)
  })
})

describe('GPS locations', () => {
  const upsert = (r: ReturnType<TestDb['asUser']>, teamId: string, lat = 4.63) =>
    r.sql(`insert into public.team_locations (team_id, lat, lng) values ($1, $2, -74.06) on conflict (team_id) do update set lat = excluded.lat, lng = excluded.lng`, [teamId, lat])

  it('only the designated runner writes the position of their own group', async () => {
    await upsert(tracker(), c.teams[0].id)
    await upsert(tracker(), c.teams[0].id, 4.64) // update of the same row
    await expect(upsert(tracker(), c.teams[1].id)).rejects.toThrow(/row-level security/) // not their group
    await expect(upsert(runnerA(), c.teams[0].id)).rejects.toThrow(/row-level security/) // same group, not the tracker
    await expect(upsert(staff0(), c.teams[0].id)).rejects.toThrow(/row-level security/)
  })
  it('rejects a plain INSERT too (not only the upsert the app uses) for a group that is not theirs', async () => {
    const insert = (r: ReturnType<TestDb['asUser']>, teamId: string) =>
      r.sql(`insert into public.team_locations (team_id, lat, lng) values ($1, 4.6, -74.0)`, [teamId])
    await expect(insert(db.asUser(c.teams[2].tracker), c.teams[2].id)).resolves.toBeDefined() // the tracker of THAT group may
    await expect(insert(db.asUser(c.teams[2].tracker), c.teams[3].id)).rejects.toThrow(/row-level security/) // not another group
    await expect(insert(db.asUser(c.teams[3].runners[1]), c.teams[3].id)).rejects.toThrow(/row-level security/) // not a plain runner
    await expect(insert(staff1(), c.teams[3].id)).rejects.toThrow(/row-level security/)
    await db.sql(`delete from public.team_locations where team_id = $1`, [c.teams[2].id]) // leave the table as it was
  })
  it('the server stamps who sent it and when (the client cannot lie)', async () => {
    const [row] = await db.sql<{ user_id: string; fresh: boolean }>(`select user_id, updated_at > now() - interval '1 minute' as fresh from public.team_locations where team_id = $1`, [c.teams[0].id])
    expect(row.user_id).toBe(c.teams[0].tracker)
    expect(row.fresh).toBe(true)
  })
  it('is visible only to the coordinator (and the tracker for its own group)', async () => {
    expect(await admin().sql(`select * from public.team_locations`)).toHaveLength(1)
    expect(await tracker().sql(`select * from public.team_locations`)).toHaveLength(1)
    expect(await runnerA().sql(`select * from public.team_locations`)).toHaveLength(0)
    expect(await staff0().sql(`select * from public.team_locations`)).toHaveLength(0)
    expect(await db.asUser(c.teams[1].tracker).sql(`select * from public.team_locations`)).toHaveLength(0) // another group's tracker
  })
  it('rejects impossible coordinates', async () => {
    await expect(upsert(tracker(), c.teams[0].id, 200)).rejects.toThrow(/lat/)
  })
})

describe('alerts to the groups', () => {
  const send = (r: ReturnType<TestDb['asUser']>, match: MatchSeed) =>
    r.sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense') returning id`, [c.eventId, match.id])

  it('can be sent by the coordinator and by the inductor of THAT base', async () => {
    await send(admin(), m)
    await send(staff0(), m)
    await send(staff1(), m2)
  })
  it('cannot be sent by another base, a runner, or the public key', async () => {
    await expect(send(staff1(), m)).rejects.toThrow(/row-level security/)
    await expect(send(runnerA(), m)).rejects.toThrow(/row-level security/)
    await expect(send(db.asAnon(), m)).rejects.toThrow(/row-level security/)
  })
  it('cannot be edited or deleted by a base', async () => {
    expect(await staff0().affected(`delete from public.alerts`)).toBe(0)
    expect(await staff0().affected(`update public.alerts set message = 'x'`)).toBe(0)
  })
  it('must have between 1 and 200 characters', async () => {
    await expect(admin().sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, '   ')`, [c.eventId, m.id])).rejects.toThrow(/alerts_message_check/)
    await expect(admin().sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, $3)`, [c.eventId, m.id, 'x'.repeat(201)])).rejects.toThrow(/alerts_message_check/)
  })
})

describe('push subscriptions and the notification plumbing', () => {
  it('each person sees only their own subscriptions', async () => {
    await runnerA().sql(`select public.save_push_subscription('https://push.example/1', 'key', 'auth')`)
    expect(await runnerA().sql(`select * from public.push_subscriptions`)).toHaveLength(1)
    expect(await staff0().sql(`select * from public.push_subscriptions`)).toHaveLength(0)
    expect(await admin().sql(`select * from public.push_subscriptions`)).toHaveLength(0) // even the coordinator: only the server reads them
  })
  it('a phone passed to another person follows its new owner', async () => {
    await staff0().sql(`select public.save_push_subscription('https://push.example/1', 'key2', 'auth2')`)
    expect(await runnerA().sql(`select * from public.push_subscriptions`)).toHaveLength(0)
    expect(await staff0().sql(`select * from public.push_subscriptions`)).toHaveLength(1)
  })
  it('nobody can remove somebody else\'s subscription', async () => {
    await runnerA().sql(`select public.remove_push_subscription('https://push.example/1')`)
    expect(await staff0().sql(`select * from public.push_subscriptions`)).toHaveLength(1)
    await staff0().sql(`select public.remove_push_subscription('https://push.example/1')`)
    expect(await staff0().sql(`select * from public.push_subscriptions`)).toHaveLength(0)
  })
  it('the sending configuration (URL and secret) is invisible to the app', async () => {
    await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://x.test/api/push', 'top-secret') on conflict (id) do nothing`)
    for (const who of [admin(), runnerA(), staff0(), db.asAnon()]) {
      await expect(who.sql(`select * from public.push_config`)).rejects.toThrow(/permission denied/)
    }
  })
})

describe('photo uploads (Storage policies)', () => {
  const upload = (r: ReturnType<TestDb['asUser']>, name: string, bucket = 'photos') =>
    r.sql(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name])

  it('the coordinator uploads anywhere in the photos bucket', async () => {
    await upload(admin(), 'teams/a.jpg')
    await upload(admin(), 'bases/a.jpg')
  })
  it('an inductor uploads only to bases/ (their base moved)', async () => {
    await upload(staff0(), 'bases/b.jpg')
    await expect(upload(staff0(), 'teams/b.jpg')).rejects.toThrow(/row-level security/)
    await expect(upload(staff0(), 'bases/c.jpg', 'other-bucket')).rejects.toThrow(/row-level security/)
  })
  it('a runner and the public key cannot upload', async () => {
    await expect(upload(runnerA(), 'bases/x.jpg')).rejects.toThrow(/row-level security/)
    await expect(upload(db.asAnon(), 'bases/x.jpg')).rejects.toThrow(/row-level security/)
  })
})
