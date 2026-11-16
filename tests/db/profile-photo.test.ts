// Migration 0018: a photo for each person, set by the coordinator.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

describe('profile photo (0018)', () => {
  it('the coordinator sets and clears a person photo; the person reads it, nobody else can change it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const runner = c.teams[0].runners[0]
    await db.asUser(c.admin).sql(`update public.profiles set photo_path = 'users/abc.jpg' where id = $1`, [runner])
    const [own] = await db.asUser(runner).sql<{ photo_path: string | null }>(`select photo_path from public.profiles where id = $1`, [runner])
    expect(own.photo_path).toBe('users/abc.jpg')
    // another runner cannot change it (RLS leaves no row to update) and cannot even set their own
    const other = c.teams[1].runners[0]
    const r = await db.asUser(other).sql(`update public.profiles set photo_path = 'users/hack.jpg' where id = $1 returning id`, [runner])
    expect(r).toHaveLength(0)
    await db.asUser(c.admin).sql(`update public.profiles set photo_path = null where id = $1`, [runner])
    const [cleared] = await db.sql<{ photo_path: string | null }>(`select photo_path from public.profiles where id = $1`, [runner])
    expect(cleared.photo_path).toBeNull()
  })
})
