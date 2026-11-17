// Migration 0019: one active Carrera, the points are private, one runner is enough, alerts to the base.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type PushItem, type TestDb } from './harness'
import { activate, insertMatch, playMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 's3cr3t')`)
})
afterAll(async () => {
  await db.close()
})

const sent = async (): Promise<PushItem[]> => (await db.httpCalls()).flatMap((call) => call.body.notifications)

describe('only one Carrera can be active', () => {
  it('a second activation is refused; deactivating the first makes room for it', async () => {
    const one = await seedCarrera(db)
    const two = await seedCarrera(db)
    await db.asUser(one.admin).sql(`update public.events set is_active = true where id = $1`, [one.eventId])
    await expect(db.asUser(one.admin).sql(`update public.events set is_active = true where id = $1`, [two.eventId])).rejects.toThrow(/events_single_active/)
    const active = async () => (await db.sql<{ id: string }>(`select id from public.events where is_active`)).map((r) => r.id)
    expect(await active()).toEqual([one.eventId]) // the first one stays on
    await db.asUser(one.admin).sql(`update public.events set is_active = false where id = $1`, [one.eventId])
    await db.asUser(one.admin).sql(`update public.events set is_active = true where id = $1`, [two.eventId])
    expect(await active()).toEqual([two.eventId])
    await db.asUser(one.admin).sql(`update public.events set is_active = false where id = $1`, [two.eventId])
  })
})

describe('a group needs only one user (a pair can share it)', () => {
  it('a Carrera with a single runner per group can be activated; a group with none cannot', async () => {
    const ok = await seedCarrera(db, { runnersPerTeam: 1 })
    expect((await db.sql<{ p: string[] }>(`select public.event_problems($1) as p`, [ok.eventId]))[0].p).toEqual([])
    const none = await seedCarrera(db, { runnersPerTeam: 0 })
    expect((await db.sql<{ p: string[] }>(`select public.event_problems($1) as p`, [none.eventId]))[0].p.join(' ')).toContain('no tiene ningún corredor')
  })
})

describe('nobody can know who leads before it is announced', () => {
  it('scores are readable only by the coordinator, the inductor of that base and the runners of that match', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
    await playMatch(db, c, m1, [c.teams[0].id, c.teams[0].id, c.teams[1].id])
    const read = async (id: string) => (await db.asUser(id).sql(`select 1 from public.match_scores where match_id = $1`, [m1.id])).length
    expect(await read(c.admin)).toBe(3)
    expect(await read(c.bases[0].staff)).toBe(3)
    expect(await read(c.teams[0].runners[0])).toBe(3)
    expect(await read(c.teams[1].runners[0])).toBe(3)
    expect(await read(c.bases[1].staff)).toBe(0) // another base
    expect(await read(c.teams[2].runners[0])).toBe(0) // a group that did not play it
    // and the standings (a view over those rows) show a runner only the points of their own matches
    const pts = async (id: string) => (await db.asUser(id).sql<{ p: string }>(`select coalesce(sum(points), 0)::text as p from public.team_standings where event_id = $1`, [c.eventId]))[0].p
    expect(Number(await pts(c.teams[2].runners[0]))).toBe(0)
    expect(Number(await pts(c.admin))).toBe(3)
  })
})

describe('alerts from the coordinator to the BASE', () => {
  it('reach the inductors of that base (and only them), are hidden from the runners, and a base cannot send one', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.clearHttpCalls()
    await db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message, target) values ($1, $2, 'Apúrense con el juego', 'base')`, [c.eventId, m.id])
    const notified = (await sent()).flatMap((n) => n.user_ids)
    expect(notified).toEqual([c.bases[0].staff])
    expect(await db.asUser(c.bases[0].staff).sql(`select 1 from public.alerts where match_id = $1`, [m.id])).toHaveLength(1)
    expect(await db.asUser(c.teams[0].runners[0]).sql(`select 1 from public.alerts where match_id = $1`, [m.id])).toHaveLength(0)
    await expect(db.asUser(c.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message, target) values ($1, $2, 'x', 'base')`, [c.eventId, m.id])).rejects.toThrow(/row-level security/)
  })

  it('an alert for the groups still goes to the runners and not to the inductor', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.clearHttpCalls()
    await db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense')`, [c.eventId, m.id])
    const notified = (await sent()).flatMap((n) => n.user_ids)
    expect(notified).not.toContain(c.bases[0].staff)
    for (const id of [...c.teams[0].runners, ...c.teams[1].runners]) expect(notified).toContain(id)
  })
})
