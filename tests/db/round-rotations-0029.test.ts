// Migration 0029: the coordinator says "you can rotate" for a round and each base confirms it let its groups go.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, getAdmin, insertMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

async function newRotation(eventId: string, round = 1): Promise<string> {
  const [r] = await db.sql<{ id: string }>(`insert into public.round_rotations (event_id, round_number) values ($1, $2) returning id`, [eventId, round])
  return r.id
}

describe('rotation between rounds (0029)', () => {
  it('only the coordinator announces a rotation, once per round', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await activate(db, c)
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`insert into public.round_rotations (event_id, round_number) values ($1, 1)`, [c.eventId])
    await expect(db.asUser(admin).sql(`insert into public.round_rotations (event_id, round_number) values ($1, 1)`, [c.eventId])).rejects.toThrow()
    for (const who of [c.bases[0].staff, c.teams[0].runners[0]]) {
      await expect(db.asUser(who).sql(`insert into public.round_rotations (event_id, round_number) values ($1, 2)`, [c.eventId])).rejects.toThrow()
    }
  })

  it('the base and the runners of that Carrera read it; someone from another Carrera does not', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const other = await seedCarrera(db, { teams: 2, bases: 1 })
    await activate(db, c)
    await newRotation(c.eventId)
    expect(await db.asUser(c.bases[0].staff).sql(`select 1 from public.round_rotations where event_id = $1`, [c.eventId])).toHaveLength(1)
    expect(await db.asUser(other.bases[0].staff).sql(`select 1 from public.round_rotations where event_id = $1`, [c.eventId])).toHaveLength(0)
  })

  it('a base confirms for itself, once, and only while its Carrera is active', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    await activate(db, c)
    const id = await newRotation(c.eventId)
    const [b1, b2] = c.bases
    await db.asUser(b1.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, b1.id])
    await expect(db.asUser(b1.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, b1.id])).rejects.toThrow() // once
    await expect(db.asUser(b1.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, b2.id])).rejects.toThrow() // not for another base
    // another Carrera becomes the active one: this base can no longer act
    const next = await seedCarrera(db, { teams: 2, bases: 1 })
    await activate(db, next)
    await expect(db.asUser(b2.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, b2.id])).rejects.toThrow()
  })

  it('the coordinator sees who already confirmed; a runner sees none of it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    await activate(db, c)
    const id = await newRotation(c.eventId)
    await db.asUser(c.bases[0].staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, c.bases[0].id])
    const admin = await getAdmin(db)
    expect(await db.asUser(admin).sql(`select 1 from public.rotation_acks where rotation_id = $1`, [id])).toHaveLength(1)
    expect(await db.asUser(c.teams[0].runners[0]).sql(`select 1 from public.rotation_acks`)).toHaveLength(0)
    expect(await db.asUser(c.bases[1].staff).sql(`select 1 from public.rotation_acks where rotation_id = $1`, [id])).toHaveLength(0) // not another base's confirmation
  })

  it('deactivating the Carrera resets the rotations with the rest of its progress', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await activate(db, c)
    const id = await newRotation(c.eventId)
    await db.asUser(c.bases[0].staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [id, c.bases[0].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    expect(await db.sql(`select 1 from public.round_rotations where event_id = $1`, [c.eventId])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.rotation_acks where rotation_id = $1`, [id])).toHaveLength(0)
  })
})
