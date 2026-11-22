// Migration 0031: a "hurry up" alert can go to ONE group of the match instead of both.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type PushItem, type TestDb } from './harness'
import { activate, insertMatch, seedCarrera } from './seed'

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

const items = async (): Promise<PushItem[]> => (await db.httpCalls()).flatMap((call) => call.body.notifications)

async function oneMatch() {
  const c = await seedCarrera(db, { teams: 3, bases: 1 })
  const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
  await activate(db, c)
  return { c, m }
}

describe('targeted alerts (0031)', () => {
  it('without a group the alert reaches the runners of both groups, as before', async () => {
    const { c, m } = await oneMatch()
    await db.asUser(c.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense')`, [c.eventId, m.id])
    const sent = await items()
    expect(sent).toHaveLength(1)
    expect(new Set(sent[0].user_ids)).toEqual(new Set([...c.teams[0].runners, ...c.teams[1].runners]))
  })

  it('with a group only the runners of that group are notified', async () => {
    const { c, m } = await oneMatch()
    await db.asUser(c.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message, team_id) values ($1, $2, 'Apúrense', $3)`, [c.eventId, m.id, c.teams[1].id])
    const sent = await items()
    expect(sent).toHaveLength(1)
    expect(new Set(sent[0].user_ids)).toEqual(new Set(c.teams[1].runners))
  })

  it('the group must play that match', async () => {
    const { c, m } = await oneMatch()
    await expect(
      db.asUser(c.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message, team_id) values ($1, $2, 'x', $3)`, [c.eventId, m.id, c.teams[2].id]),
    ).rejects.toThrow(/no juega/)
  })

  it('a runner only reads the alerts for both groups or for their own group', async () => {
    const { c, m } = await oneMatch()
    const base = c.bases[0].staff
    await db.asUser(base).sql(`insert into public.alerts (event_id, match_id, message, team_id) values ($1, $2, 'solo B', $3)`, [c.eventId, m.id, c.teams[1].id])
    await db.asUser(base).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'los dos')`, [c.eventId, m.id])
    const read = async (who: string) => (await db.asUser(who).sql<{ message: string }>(`select message from public.alerts order by message`)).map((r) => r.message)
    expect(await read(c.teams[0].runners[0])).toEqual(['los dos'])
    expect(await read(c.teams[1].runners[0])).toEqual(['los dos', 'solo B'])
    expect(await read(base)).toEqual(['los dos', 'solo B'])
  })

  it('the 20 s limit counts per recipient: group A and then group B right away is fine, group A twice is not', async () => {
    const { c, m } = await oneMatch()
    const base = c.bases[0].staff
    const send = (team: string) => db.asUser(base).sql(`insert into public.alerts (event_id, match_id, message, team_id) values ($1, $2, 'ya', $3)`, [c.eventId, m.id, team])
    await send(c.teams[0].id)
    await send(c.teams[1].id)
    await expect(send(c.teams[0].id)).rejects.toThrow(/Espera unos segundos/)
  })
})
