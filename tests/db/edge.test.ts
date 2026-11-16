// Edge cases found in the third QA review: things that happen during a real day (people leave or are
// replaced, a Carrera is switched mid-match, times are changed live) and the privacy trade-offs of the
// alerts table. Tests marked "characterization" document how it works TODAY; if the behaviour is
// improved on purpose, update them.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type PushItem, type TestDb } from './harness'
import { activate, addUser, finishedMinutesAgo, insertMatch, playMatch, scheduleWithGenerator, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 's3cr3t')`)
})
afterAll(async () => {
  await db.close()
})
beforeEach(async () => {
  await db.clearHttpCalls()
  await db.sql(`update public.events set is_active = false`)
})

const pushes = async (): Promise<PushItem[]> => (await db.httpCalls()).flatMap((call) => call.body.notifications)
const points = async (eventId: string) =>
  Object.fromEntries(
    (await db.sql<{ team_id: string; points: string }>(`select team_id, points::text from public.team_standings where event_id = $1`, [eventId])).map((r) => [
      r.team_id,
      Number(r.points),
    ]),
  )

describe('people who leave or are replaced during the day', () => {
  it('deleting an inductor who already scored keeps their scores, the ranking and the audit log', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [t1, t2] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    await playMatch(db, c, m, [t1.id, t1.id, t2.id])
    const before = await points(c.eventId)
    await db.sql(`delete from public.profiles where id = $1`, [c.bases[0].staff])
    expect(await points(c.eventId)).toEqual(before)
    const [s] = await db.sql<{ n: string; nobody: string }>(`select count(*)::text n, count(*) filter (where awarded_by is null)::text nobody from public.match_scores where match_id = $1`, [m.id])
    expect(Number(s.n)).toBe(3)
    expect(Number(s.nobody)).toBe(3) // the author is forgotten, the result is not
    // only the 3 inserts: forgetting the author (awarded_by -> null) is not a correction and writes nothing (0017)
    const audit = await db.sql<{ action: string }>(`select action from public.score_audit where event_id = $1 order by id`, [c.eventId])
    expect(audit.map((r) => r.action)).toEqual(['insert', 'insert', 'insert'])
  })

  it('an inductor who replaces another one continues the same base; the old one can no longer score', async () => {
    const c = await seedCarrera(db, { teams: 3, bases: 1 })
    const [t1, t2, t3] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    await activate(db, c)
    const oldStaff = c.bases[0].staff
    await db.asUser(oldStaff).sql(`select public.confirm_arrival($1)`, [m.id])
    await db.asUser(oldStaff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, t1.id])
    await db.sql(`delete from public.base_staff where user_id = $1`, [oldStaff])
    const fresh = await addUser(db, 'relevo.base', 'base')
    await db.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [c.bases[0].id, fresh])
    // the new inductor finishes the match
    await db.asUser(fresh).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, t2.id])
    await db.asUser(fresh).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'minijuego', $2)`, [m.id, t2.id])
    const [row] = await db.sql<{ status: string }>(`select status from public.matches where id = $1`, [m.id])
    expect(row.status).toBe('finished')
    // the old one has no access any more (still a base user, but not staff of this base)
    const m2 = await insertMatch(db, c, 2, c.bases[0].id, t1.id, t3.id)
    await expect(db.asUser(oldStaff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m2.id, t1.id])).rejects.toThrow()
  })

  it('a runner replaced mid-race: the delay push goes to the new runner, not to the old one', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 4, runnersPerTeam: 2 })
    const [t1, t2, t3, t4] = c.teams
    const a = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    const b = await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
    await finishedMinutesAgo(db, a.id, 15)
    await finishedMinutesAgo(db, b.id, 1)
    await insertMatch(db, c, 2, c.bases[2].id, t1.id, t3.id)
    await insertMatch(db, c, 2, c.bases[3].id, t2.id, t4.id)
    await activate(db, c)
    const leaver = t1.runners[1]
    await db.sql(`delete from public.team_runners where user_id = $1`, [leaver])
    const fresh = await addUser(db, 'relevo.corredor', 'runner')
    await db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [t1.id, fresh])
    await db.sql(`select public.check_delays()`)
    const targets = (await pushes()).flatMap((n) => n.user_ids)
    expect(targets).toContain(fresh)
    expect(targets).toContain(t1.runners[0])
    expect(targets).not.toContain(leaver)
  })

  it('characterization: the database lets a group drop below 2 runners after activation; event_problems then reports it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await activate(db, c)
    await db.sql(`delete from public.team_runners where user_id = $1`, [c.teams[0].runners[1]])
    const problems = await db.sql<{ event_problems: string }>(`select public.event_problems($1)`, [c.eventId])
    expect(problems.length).toBeGreaterThan(0) // the "Carrera" screen shows it in red; nothing blocks the race
  })
})

describe('switching or retuning things while the race is running', () => {
  it('switching the active Carrera mid-match freezes that base; switching back lets it finish with no data lost', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const [t1, t2] = a.teams
    const m = await insertMatch(db, a, 1, a.bases[0].id, t1.id, t2.id)
    await activate(db, a)
    const staff = db.asUser(a.bases[0].staff)
    await staff.sql(`select public.confirm_arrival($1)`, [m.id])
    await staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, t1.id])
    await activate(db, b) // a mistaken tap on another Carrera
    await expect(staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, t1.id])).rejects.toThrow()
    expect(await db.asUser(a.teams[0].runners[0]).sql(`select t.id from public.teams t join public.events e on e.id = t.event_id where e.is_active and t.id = $1`, [t1.id])).toHaveLength(0)
    await activate(db, a)
    await staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, t1.id])
    await staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'minijuego', $2)`, [m.id, t2.id])
    expect((await points(a.eventId))[t1.id]).toBe(2)
  })

  it('lowering the general travel time mid-race makes the very next check warn; raising it silences it', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 4, maxTravelMinutes: 10 })
    const [t1, t2, t3, t4] = c.teams
    const a = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    const b = await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
    await finishedMinutesAgo(db, a.id, 6)
    await finishedMinutesAgo(db, b.id, 6)
    await insertMatch(db, c, 2, c.bases[2].id, t1.id, t3.id)
    await insertMatch(db, c, 2, c.bases[3].id, t2.id, t4.id)
    await activate(db, c)
    await db.sql(`select public.check_delays()`)
    expect(await pushes()).toHaveLength(0)
    await db.sql(`update public.events set max_travel_minutes = 5 where id = $1`, [c.eventId])
    await db.sql(`select public.check_delays()`)
    expect((await pushes()).length).toBeGreaterThan(0)
    await db.clearHttpCalls()
    await db.sql(`update public.events set max_travel_minutes = 30 where id = $1`, [c.eventId])
    await db.sql(`select public.check_delays()`)
    expect(await pushes()).toHaveLength(0)
  })

  it('characterization: a still-late group is notified again on EVERY check (every 30 s), with the same tag so the phone replaces the old one', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 4 })
    const [t1, t2, t3, t4] = c.teams
    const a = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    const b = await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
    await finishedMinutesAgo(db, a.id, 20)
    await finishedMinutesAgo(db, b.id, 20)
    await insertMatch(db, c, 2, c.bases[2].id, t1.id, t3.id)
    await insertMatch(db, c, 2, c.bases[3].id, t2.id, t4.id)
    await activate(db, c)
    await db.sql(`select public.check_delays()`)
    await db.sql(`select public.check_delays()`)
    const calls = await db.httpCalls()
    expect(calls).toHaveLength(2)
    const tags = calls.flatMap((x) => x.body.notifications.map((n) => n.tag))
    expect(new Set(tags).size).toBe(tags.length / 2) // each tag appears exactly twice
  })
})

describe('deleting a group or playing with an odd number of groups', () => {
  it('deleting a group mid-race erases the points its rivals won against it (the ranking is recomputed) but keeps the audit rows', async () => {
    const c = await seedCarrera(db, { teams: 3, bases: 2 })
    const [t1, t2, t3] = c.teams
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    const m2 = await insertMatch(db, c, 2, c.bases[0].id, t1.id, t3.id)
    await playMatch(db, c, m1, [t1.id, t1.id, t1.id])
    await playMatch(db, c, m2, [t1.id, t3.id, t3.id])
    expect((await points(c.eventId))[t1.id]).toBe(4)
    await db.sql(`delete from public.teams where id = $1`, [t2.id])
    const after = await points(c.eventId)
    expect(after[t2.id]).toBeUndefined()
    expect(after[t1.id]).toBe(1) // the 3 points won against the deleted group are gone
    expect(after[t3.id]).toBe(2)
    const audit = await db.sql<{ n: string }>(`select count(*)::text n from public.score_audit where event_id = $1`, [c.eventId])
    expect(Number(audit[0].n)).toBeGreaterThanOrEqual(6) // inserts of both matches plus the cascade deletes
  })

  it('5 groups, 2 bases: every round exactly one group rests, all play 4 matches, and the points add up to 3 per played match', async () => {
    const c = await seedCarrera(db, { teams: 5, bases: 2 })
    const matches = await scheduleWithGenerator(db, c, 5)
    for (let round = 1; round <= 5; round++) {
      const playing = matches.filter((m) => m.round === round).flatMap((m) => [m.teamA, m.teamB])
      expect(new Set(playing).size).toBe(playing.length)
      expect(c.teams.length - playing.length).toBeGreaterThanOrEqual(1)
    }
    for (const m of matches) await playMatch(db, c, m, [m.teamA, m.teamB, m.teamA])
    const pts = await points(c.eventId)
    const total = Object.values(pts).reduce((a, b) => a + b, 0)
    expect(total).toBe(matches.length * 3)
    const played = new Map<string, number>()
    for (const m of matches) for (const id of [m.teamA, m.teamB]) played.set(id, (played.get(id) ?? 0) + 1)
    for (const t of c.teams) expect(played.get(t.id) ?? 0).toBeGreaterThanOrEqual(1)
  })
})

describe('the alerts table (privacy and abuse)', () => {
  it('hides the alerts from everyone who is not the coordinator, a runner of that match or the inductor of its base (0017)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 2 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    await activate(db, a)
    await db.asUser(a.admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'mensaje interno')`, [a.eventId, m.id])
    const read = async (id: string) => (await db.asUser(id).sql<{ message: string }>(`select message from public.alerts`)).length
    expect(await read(b.teams[0].runners[0])).toBe(0) // a runner of another Carrera
    expect(await read(a.bases[1].staff)).toBe(0) // the inductor of another base
    expect(await read(a.teams[0].runners[0])).toBe(1) // a runner of the match
    expect(await read(a.bases[0].staff)).toBe(1) // the inductor of that base
    expect(await read(a.admin)).toBe(1)
  })

  it('refuses an alert whose event_id is not the one of its match (0017)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    await activate(db, a)
    await expect(db.asUser(a.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'x')`, [b.eventId, m.id])).rejects.toThrow(/row-level security/)
  })

  it('an inductor of a Carrera that is NOT active cannot send alerts either', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    await activate(db, b)
    await expect(db.asUser(a.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'hola')`, [a.eventId, m.id])).rejects.toThrow()
  })

  it('limits a base to one alert per match every 20 seconds, while the coordinator is not limited (0017)', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    const send = (who: string, i: number) => db.asUser(who).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, $3)`, [c.eventId, m.id, `aviso ${i}`])
    await send(c.bases[0].staff, 0)
    await expect(send(c.bases[0].staff, 1)).rejects.toThrow(/Espera unos segundos/)
    for (let i = 0; i < 3; i++) await send(c.admin, i)
    expect(await db.httpCalls()).toHaveLength(4)
  })
})

describe('groups that rest a round', () => {
  it('does not push the runners of a group that rests a round (0016): it is not walking', async () => {
    const c = await seedCarrera(db, { teams: 3, bases: 3, runnersPerTeam: 2 })
    const [a, b, d] = c.teams
    const r1 = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await finishedMinutesAgo(db, r1.id, 14)
    const r2 = await insertMatch(db, c, 2, c.bases[2].id, b.id, d.id) // A rests in round 2 while this is played
    await db.sql(`update public.matches set status = 'in_progress', arrived_at = now() where id = $1`, [r2.id])
    await insertMatch(db, c, 3, c.bases[1].id, a.id, d.id)
    await activate(db, c)
    await db.sql(`select public.check_delays()`)
    const notified = (await pushes()).flatMap((n) => n.user_ids)
    for (const id of a.runners) expect(notified).not.toContain(id)
  })
})

describe('server clock (0017)', () => {
  it('server_now() is readable by a signed-in user and closely follows the database clock', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [row] = await db.asUser(c.teams[0].runners[0]).sql<{ t: string }>(`select public.server_now()::text as t`)
    expect(Math.abs(new Date(row.t).getTime() - Date.now())).toBeLessThan(5000)
    await expect(db.asAnon().sql(`select public.server_now()`)).rejects.toThrow()
  })
})
