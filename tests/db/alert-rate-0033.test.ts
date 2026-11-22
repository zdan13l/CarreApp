// Migration 0033: a base may send a hurry alert again after 15 seconds, and the notification says "Aviso del coordi".
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, insertMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 's3cr3t')`)
})
afterAll(async () => {
  await db.close()
})

describe('alert rate and title (0033)', () => {
  it('waits 15 s between two alerts of a base, not 20', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    const send = () => db.asUser(c.bases[0].staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'ya')`, [c.eventId, m.id])
    await send()
    await expect(send()).rejects.toThrow(/Espera unos segundos/)
    await db.sql(`update public.alerts set created_at = now() - interval '16 seconds' where match_id = $1`, [m.id])
    await send()
  })

  it('tells the inductor "Aviso del coordi"', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    await db.clearHttpCalls()
    await db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message, target) values ($1, $2, 'x', 'base')`, [c.eventId, m.id])
    const sent = (await db.httpCalls()).flatMap((call) => call.body.notifications)
    expect(sent[0].title).toBe('Aviso del coordi')
  })
})
