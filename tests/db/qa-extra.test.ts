// QA review, fifth run: scenarios not covered elsewhere (big Carrera, voids flipping a winner, concurrent
// scoring, role escalation with PostgREST-style statements, alert bursts, base moved mid-race, reset 0020).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, addUser, insertMatch, playMatch, scheduleWithGenerator, seedCarrera } from './seed'

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

const standings = async (eventId: string) =>
  Object.fromEntries(
    (await db.sql<{ team_id: string; points: string }>(`select team_id, points::text from public.team_standings where event_id = $1`, [eventId])).map((r) => [
      r.team_id,
      Number(r.points),
    ]),
  )

describe('a big Carrera', () => {
  it('20 groups, 10 bases, 5 rounds: the schedule is valid and the points add up to 3 per played match', async () => {
    const c = await seedCarrera(db, { teams: 20, bases: 10, runnersPerTeam: 1 })
    const ms = await scheduleWithGenerator(db, c, 5)
    expect(ms).toHaveLength(50)
    for (const m of ms.slice(0, 20)) await playMatch(db, c, m, [m.teamA, m.teamB, m.teamA])
    const s = await standings(c.eventId)
    expect(Object.values(s).reduce((a, b) => a + b, 0)).toBe(60)
  }, 60000)
})

describe('voided items', () => {
  it('voiding the deciding item by the coordinator flips the winner; the base cannot void or edit', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, b.id, a.id]) // a wins 2-1
    expect((await standings(c.eventId))[a.id]).toBe(2)
    await expect(db.asUser(c.bases[0].staff).sql(`update public.match_scores set voided = true, winner_team_id = null where match_id = $1 and item = 'barra'`, [m.id])).resolves.toBeDefined()
    // (a base update must not have changed anything: RLS filters the row)
    expect((await standings(c.eventId))[a.id]).toBe(2)
    await db.asUser(c.admin).sql(`update public.match_scores set voided = true, winner_team_id = null where match_id = $1 and item = 'minijuego'`, [m.id])
    const s = await standings(c.eventId)
    expect(s[a.id]).toBe(1)
    expect(s[b.id]).toBe(1)
  })
})

describe('concurrency', () => {
  it('two inductors/clients scoring the same item at once: exactly one row survives', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await activate(db, c)
    const as = db.asUser(c.bases[0].staff)
    await as.sql(`select public.confirm_arrival($1)`, [m.id])
    const res = await Promise.allSettled([
      as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, a.id]),
      as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, b.id]),
    ])
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rows = await db.sql(`select 1 from public.match_scores where match_id = $1`, [m.id])
    expect(rows).toHaveLength(1)
  })
})

describe('role escalation with PostgREST-style statements', () => {
  it('a runner and an inductor cannot promote themselves, join a base, touch events, audit or other teams', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const runner = c.teams[0].runners[0]
    const staff = c.bases[0].staff
    for (const [who, id] of [['runner', runner], ['base', staff]] as const) {
      const as = db.asUser(id)
      await as.sql(`update public.profiles set role = 'admin' where id = $1`, [id])
      const [p] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [id])
      expect(p.role, who).toBe(who)
      await expect(as.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [c.bases[0].id, id])).rejects.toThrow()
      await expect(as.sql(`insert into public.team_members (team_id, user_id) values ($1, $2)`, [c.teams[1].id, id])).rejects.toThrow()
      await as.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
      expect((await db.sql<{ is_active: boolean }>(`select is_active from public.events where id = $1`, [c.eventId]))[0].is_active, who).toBe(false)
      await as.sql(`delete from public.matches`)
      await as.sql(`update public.teams set name = 'hack'`)
      expect(await as.sql(`select * from public.score_audit`)).toHaveLength(0)
      expect(await as.sql(`select * from public.base_details`)).toHaveLength(who === 'base' ? 1 : 0)
      await expect(as.sql(`select public.reset_event_progress($1)`, [c.eventId])).rejects.toThrow()
    }
    expect(await db.sql(`select 1 from public.teams where name = 'hack'`)).toHaveLength(0)
  })
})

describe('alerts and bases', () => {
  it('30 simultaneous coordinator alerts all go out as separate pushes (nothing coalesced server side)', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.clearHttpCalls()
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message, target) values ($1, $2, $3, 'groups')`, [c.eventId, m.id, `aviso ${i}`]),
      ),
    )
    const items = (await db.httpCalls()).flatMap((x) => x.body.notifications)
    expect(items.length).toBe(30)
    expect(items.every((n) => n.user_ids.length === 4)).toBe(true) // 4 runners (2 groups x 2)
    expect(new Set(items.map((n) => n.tag)).size).toBe(items.length)
  })

  it('moving a match to another base mid-race: the old inductor loses it, the new one can score it; a double booking is refused', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const [t1, t2, t3, t4] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
    await activate(db, c)
    await expect(db.sql(`update public.matches set base_id = $2 where id = $1`, [m.id, c.bases[1].id])).rejects.toThrow()
    const m2 = await insertMatch(db, c, 2, c.bases[0].id, t1.id, t3.id)
    await db.sql(`update public.matches set base_id = $2 where id = $1`, [m2.id, c.bases[1].id])
    await expect(db.asUser(c.bases[0].staff).sql(`select public.confirm_arrival($1)`, [m2.id])).rejects.toThrow()
    await db.asUser(c.bases[1].staff).sql(`select public.confirm_arrival($1)`, [m2.id])
  })
})

describe('reset on deactivate (0020) edge cases', () => {
  it('finishing the Carrera destroys the final standings: nothing is readable afterwards (documented risk)', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, a.id, b.id])
    expect((await standings(c.eventId))[a.id]).toBe(2)
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    expect((await standings(c.eventId))[a.id] ?? 0).toBe(0)
    expect(await db.sql(`select 1 from public.score_audit where event_id = $1`, [c.eventId])).toHaveLength(0)
  })

  it('deactivating one Carrera never touches the progress of another one', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const mb = await insertMatch(db, b, 1, b.bases[0].id, b.teams[0].id, b.teams[1].id)
    await playMatch(db, b, mb, [b.teams[0].id, b.teams[0].id, b.teams[0].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [b.eventId])
    await activate(db, a)
    await db.sql(`update public.events set is_active = false where id = $1`, [a.eventId])
    expect((await db.sql(`select 1 from public.matches where event_id = $1`, [b.eventId])).length).toBe(1)
  })

  it('a replacement user added after the reset still works on the re-activated Carrera', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const r = await addUser(db, 'nuevo.corredor', 'runner')
    await db.sql(`update public.profiles set event_id = $2 where id = $1`, [r, c.eventId])
    await activate(db, c)
    expect(await db.sql(`select status from public.matches where id = $1`, [m.id])).toEqual([{ status: 'pending' }])
  })
})
