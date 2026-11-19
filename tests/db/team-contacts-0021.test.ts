// Migration 0021: a runner sees the @ of the runners of the groups of ITS OWN Carrera, and nothing else.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

type Contact = { team_id: string; username: string }

describe('team_contacts()', () => {
  it('lists the usernames of every group of the own Carrera, only usernames', async () => {
    const c = await seedCarrera(db, { teams: 3 })
    const rows = await db.asUser(c.teams[0].runners[0]).sql<Contact>(`select * from public.team_contacts()`)
    const expected = (await db.sql<Contact>(`select tr.team_id, p.username from public.team_runners tr join public.profiles p on p.id = tr.user_id where tr.team_id = any($1)`, [c.teams.map((t) => t.id)])).length
    expect(rows.length).toBe(expected)
    expect(new Set(rows.map((r) => r.team_id))).toEqual(new Set(c.teams.map((t) => t.id)))
    expect(Object.keys(rows[0]).sort()).toEqual(['team_id', 'username'])
  })

  it('does not show the groups of another Carrera', async () => {
    const one = await seedCarrera(db, { teams: 2 })
    const two = await seedCarrera(db, { teams: 2 })
    const rows = await db.asUser(one.teams[0].runners[0]).sql<Contact>(`select * from public.team_contacts()`)
    const ids = new Set(rows.map((r) => r.team_id))
    for (const t of two.teams) expect(ids.has(t.id)).toBe(false)
  })

  it('is not for the base staff nor for anonymous users', async () => {
    const c = await seedCarrera(db, { teams: 2 })
    expect(await db.asUser(c.bases[0].staff).sql<Contact>(`select * from public.team_contacts()`)).toEqual([])
    await expect(db.asAnon().sql(`select * from public.team_contacts()`)).rejects.toThrow()
  })

  it('the coordinator sees them all', async () => {
    const c = await seedCarrera(db, { teams: 2 })
    const rows = await db.asUser(c.admin).sql<Contact>(`select * from public.team_contacts()`)
    expect(new Set(rows.map((r) => r.team_id)).has(c.teams[0].id)).toBe(true)
    await addUser(db, 'extra-runner', 'runner')
  })
})
