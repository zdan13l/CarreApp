// QA review, sixth run: the base "visa counter" and the privacy migrations seen from each phone (0019, 0020, 0021).
// Scenarios not covered elsewhere: contacts for a user without a Carrera, shared users, other bases of the same Carrera,
// arrival rules (who may confirm, idempotence, inactive Carrera), scoring order with voided items, odd number of groups.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, addUser, insertMatch, playMatch, scheduleWithGenerator, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})
beforeEach(async () => {
  await db.sql(`update public.events set is_active = false`)
})

type Contact = { team_id: string; username: string }
const ITEMS = ['barra', 'pregunta', 'minijuego']

describe('team_contacts() edge cases (0021)', () => {
  it('a runner that belongs to no Carrera, and a runner of a deactivated Carrera, get no leak: empty or only their own Carrera', async () => {
    const c = await seedCarrera(db, { teams: 2 })
    const lonely = await addUser(db, 'sin.carrera', 'runner') // profiles.event_id is null
    expect(await db.asUser(lonely).sql<Contact>(`select * from public.team_contacts()`)).toEqual([])
    // A deactivated Carrera still shows its own groups to its own runners (only usernames, nothing else).
    const rows = await db.asUser(c.teams[0].runners[0]).sql<Contact>(`select * from public.team_contacts()`)
    expect(new Set(rows.map((r) => r.team_id))).toEqual(new Set(c.teams.map((t) => t.id)))
  })

  it('a pair that shares one user shows one row for that group; a removed runner disappears from the list', async () => {
    const c = await seedCarrera(db, { teams: 2, runnersPerTeam: 1 })
    const asRunner = db.asUser(c.teams[0].runners[0])
    const before = await asRunner.sql<Contact>(`select * from public.team_contacts()`)
    expect(before.filter((r) => r.team_id === c.teams[1].id)).toHaveLength(1)
    await db.sql(`delete from public.team_runners where user_id = $1`, [c.teams[1].runners[0]])
    const after = await asRunner.sql<Contact>(`select * from public.team_contacts()`)
    expect(after.filter((r) => r.team_id === c.teams[1].id)).toHaveLength(0)
  })

  it('the coordinator sees the contacts of every Carrera; a base inductor of the active Carrera still gets nothing', async () => {
    const one = await seedCarrera(db, { teams: 2 })
    const two = await seedCarrera(db, { teams: 2 })
    await activate(db, one)
    const ids = new Set((await db.asUser(one.admin).sql<Contact>(`select * from public.team_contacts()`)).map((r) => r.team_id))
    for (const t of [...one.teams, ...two.teams]) expect(ids.has(t.id)).toBe(true)
    expect(await db.asUser(one.bases[0].staff).sql<Contact>(`select * from public.team_contacts()`)).toEqual([])
  })

  it('a runner cannot read the profiles of the others directly: team_contacts() is the only door, and it shows no names', async () => {
    const c = await seedCarrera(db, { teams: 2 })
    const me = c.teams[0].runners[0]
    const other = c.teams[1].runners[0]
    const direct = await db.asUser(me).sql(`select id from public.profiles where id = $1`, [other])
    expect(direct).toEqual([])
    const cols = Object.keys((await db.asUser(me).sql<Contact>(`select * from public.team_contacts()`))[0])
    expect(cols.sort()).toEqual(['team_id', 'username'])
  })
})

describe('what an inductor sees of the rest of his own Carrera', () => {
  it('cannot read the scores of another base nor the guide (info and questions) of another base', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const m2 = await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
    await playMatch(db, c, m1, [c.teams[0].id, c.teams[0].id, c.teams[1].id])
    await playMatch(db, c, m2, [c.teams[2].id, c.teams[3].id, c.teams[3].id])
    const staff1 = db.asUser(c.bases[0].staff)
    const seen = await staff1.sql<{ match_id: string }>(`select match_id from public.match_scores`)
    expect(new Set(seen.map((r) => r.match_id))).toEqual(new Set([m1.id]))
    expect(await staff1.sql(`select 1 from public.base_details where base_id = $1`, [c.bases[1].id])).toEqual([])
    expect(await staff1.sql(`select 1 from public.base_questions where base_id = $1`, [c.bases[1].id])).toEqual([])
    expect((await staff1.sql(`select 1 from public.base_details where base_id = $1`, [c.bases[0].id])).length).toBe(1)
    // The ranking view lists every group of the Carrera but counts only the scores this user may read: the other base's points are 0.
    const standings = await staff1.sql<{ team_id: string; points: string }>(`select team_id, points::text from public.team_standings`)
    for (const s of standings) if (s.team_id === c.teams[2].id || s.team_id === c.teams[3].id) expect(Number(s.points)).toBe(0)
    expect(standings.find((s) => s.team_id === c.teams[0].id)?.points).toBe('2')
  })

  it('a runner reads the scores of his own match only, even in the same Carrera and the same round', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const m2 = await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
    await playMatch(db, c, m1, [c.teams[0].id, c.teams[0].id, c.teams[0].id])
    await playMatch(db, c, m2, [c.teams[2].id, c.teams[2].id, c.teams[2].id])
    const rows = await db.asUser(c.teams[0].runners[0]).sql<{ match_id: string }>(`select match_id from public.match_scores`)
    expect(new Set(rows.map((r) => r.match_id))).toEqual(new Set([m1.id]))
    // and cannot read it through the other table either
    expect(await db.asUser(c.teams[0].runners[0]).sql(`select * from public.score_audit`)).toEqual([])
  })

  it('after the Carrera is deactivated the inductor reads no scores and cannot score; the coordinator still can', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const as = db.asUser(c.bases[0].staff)
    await expect(as.sql(`select public.confirm_arrival($1)`, [m.id])).rejects.toThrow()
    await expect(as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, c.teams[0].id])).rejects.toThrow()
    await db.asUser(c.admin).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, c.teams[0].id])
  })
})

describe('arrival and scoring order at the counter', () => {
  it('only the inductor of THAT match (or the coordinator) confirms arrival; a runner and another base cannot; it is idempotent', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await expect(db.asUser(c.bases[1].staff).sql(`select public.confirm_arrival($1)`, [m1.id])).rejects.toThrow(/Solo la base/)
    await expect(db.asUser(c.teams[0].runners[0]).sql(`select public.confirm_arrival($1)`, [m1.id])).rejects.toThrow()
    await expect(db.asAnon().sql(`select public.confirm_arrival($1)`, [m1.id])).rejects.toThrow()
    const owner = db.asUser(c.bases[0].staff)
    await owner.sql(`select public.confirm_arrival($1)`, [m1.id])
    const [first] = await db.sql<{ arrived_at: string; status: string }>(`select arrived_at::text, status::text from public.matches where id = $1`, [m1.id])
    expect(first.status).toBe('in_progress')
    await owner.sql(`select public.confirm_arrival($1)`, [m1.id])
    const [second] = await db.sql<{ arrived_at: string }>(`select arrived_at::text from public.matches where id = $1`, [m1.id])
    expect(second.arrived_at).toBe(first.arrived_at)
  })

  it('confirming arrival on an already finished match does not reopen it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await playMatch(db, c, m, [c.teams[0].id, c.teams[1].id, c.teams[0].id])
    await db.asUser(c.bases[0].staff).sql(`select public.confirm_arrival($1)`, [m.id])
    const [row] = await db.sql<{ status: string }>(`select status::text from public.matches where id = $1`, [m.id])
    expect(row.status).toBe('finished')
  })

  it('round order: round 2 is refused until round 1 has its three items; a voided item counts as resolved; the coordinator is not bound', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 1 })
    const [a, b, x, y] = c.teams.map((t) => t.id)
    const r1 = await insertMatch(db, c, 1, c.bases[0].id, a, b)
    const r2 = await insertMatch(db, c, 2, c.bases[0].id, x, y)
    await activate(db, c)
    const staff = db.asUser(c.bases[0].staff)
    const score = (m: string, item: string, w: string) => staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m, item, w])
    await staff.sql(`select public.confirm_arrival($1)`, [r1.id])
    await staff.sql(`select public.confirm_arrival($1)`, [r2.id])
    await expect(score(r2.id, 'barra', x)).rejects.toThrow(/ronda anterior/)
    await score(r1.id, 'barra', a)
    await score(r1.id, 'pregunta', b)
    await expect(score(r2.id, 'barra', x)).rejects.toThrow(/ronda anterior/) // two of three is not enough
    await db.asUser(c.admin).sql(`insert into public.match_scores (match_id, item, voided) values ($1, 'minijuego', true)`, [r1.id])
    await score(r2.id, 'barra', x) // the voided third item closed round 1
    // a winner outside the match is refused, and the base cannot edit or delete what it sent
    await expect(score(r2.id, 'pregunta', a)).rejects.toThrow(/uno de los dos grupos/)
    const edited = await staff.sql(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra' returning 1`, [r2.id, y])
    expect(edited).toEqual([])
    const deleted = await staff.sql(`delete from public.match_scores where match_id = $1 returning 1`, [r2.id])
    expect(deleted).toEqual([])
    const [w] = await db.sql<{ winner_team_id: string }>(`select winner_team_id from public.match_scores where match_id = $1 and item = 'barra'`, [r2.id])
    expect(w.winner_team_id).toBe(x)
  })

  it('0022: a base cannot score before it confirms the arrival; after confirming it can; the coordinator is not bound', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    const staff = db.asUser(c.bases[0].staff)
    const score = (item: string) => staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, c.teams[0].id])
    await expect(score('barra')).rejects.toThrow(/llegaron los dos grupos/)
    const [before] = await db.sql<{ arrived_at: string | null; status: string }>(`select arrived_at::text, status::text from public.matches where id = $1`, [m.id])
    expect(before.status).toBe('pending') // the refused score changed nothing
    expect(before.arrived_at).toBeNull()
    await staff.sql(`select public.confirm_arrival($1)`, [m.id])
    await score('barra')
    const [after] = await db.sql<{ arrived_at: string | null; status: string }>(`select arrived_at::text, status::text from public.matches where id = $1`, [m.id])
    expect(after.status).toBe('in_progress')
    expect(after.arrived_at).not.toBeNull()
    // the coordinator can load or fix results by hand on a match whose arrival was never confirmed
    const m2 = await insertMatch(db, c, 2, c.bases[0].id, c.teams[2].id, c.teams[3].id)
    await db.asUser(c.admin).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m2.id, c.teams[2].id])
    const [byAdmin] = await db.sql<{ arrived_at: string | null }>(`select arrived_at::text from public.matches where id = $1`, [m2.id])
    expect(byAdmin.arrived_at).toBeNull()
  })

  it('a base cannot score a match that is not in its own base even with a valid group', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m2 = await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
    await activate(db, c)
    await expect(db.asUser(c.bases[0].staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m2.id, c.teams[2].id])).rejects.toThrow()
  })
})

describe('an odd number of groups', () => {
  it('5 groups, 5 rounds with the generator: one group rests each round and the whole Carrera can be played and totals 3 points per match', async () => {
    const c = await seedCarrera(db, { teams: 5, bases: 2 })
    const matches = await scheduleWithGenerator(db, c, 5)
    expect(matches.length).toBeGreaterThan(0)
    for (let r = 1; r <= 5; r++) {
      const inRound = matches.filter((m) => m.round === r)
      expect(new Set(inRound.flatMap((m) => [m.teamA, m.teamB])).size).toBe(inRound.length * 2) // nobody twice in a round
    }
    for (const m of matches.sort((p, q) => p.round - q.round)) await playMatch(db, c, m, [m.teamA, m.teamB, m.teamA])
    const rows = await db.sql<{ points: string }>(`select points::text from public.team_standings where event_id = $1`, [c.eventId])
    expect(rows.reduce((n, r) => n + Number(r.points), 0)).toBe(matches.length * ITEMS.length)
  })
})
