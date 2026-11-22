// Migration 0028: deactivating a Carrera keeps a readable copy of its scores before the reset of 0020.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin, insertMatch, playMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

interface Archive {
  event_name: string
  matches_played: number
  standings: { team: string; points: number }[]
  results: { round: number; base: string; team_a: string; team_b: string; item: string; winner: string | null; voided: boolean }[]
}
const archivesOf = (eventId: string) => db.sql<Archive>(`select event_name, matches_played, standings, results from public.event_archives where event_id = $1`, [eventId])

describe('the history of scores (0028)', () => {
  it('saves the final table and every point before the reset, with the names written out', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, a.id, b.id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const [arch] = await archivesOf(c.eventId)
    expect(arch.matches_played).toBe(1)
    expect(arch.standings).toEqual([{ team: a.name, points: 2 }, { team: b.name, points: 1 }])
    expect(arch.results).toHaveLength(3)
    expect(arch.results.every((r) => r.round === 1 && r.base === c.bases[0].name && [a.name, b.name].includes(r.winner ?? ''))).toBe(true)
    // the reset of 0020 still happens afterwards
    expect(await db.sql(`select 1 from public.match_scores s join public.matches m on m.id = s.match_id where m.event_id = $1`, [c.eventId])).toHaveLength(0)
  })

  it('a Carrera that was never played leaves no history', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    expect(await archivesOf(c.eventId)).toHaveLength(0)
  })

  it('every time it is deactivated after being played again, a new copy is kept', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, a.id, a.id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    await playMatch(db, c, m, [b.id, b.id, b.id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const all = await archivesOf(c.eventId)
    expect(all).toHaveLength(2)
    expect(all.map((x) => x.standings[0].team).sort()).toEqual([a.name, b.name].sort())
  })

  it('survives deleting the Carrera: the history keeps its names', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, b.id, a.id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const [{ id }] = await db.sql<{ id: string }>(`select id from public.event_archives where event_id = $1`, [c.eventId])
    await db.sql(`delete from public.events where id = $1`, [c.eventId])
    const [row] = await db.sql<{ event_id: string | null; standings: { team: string; points: number }[] }>(`select event_id, standings from public.event_archives where id = $1`, [id])
    expect(row.event_id).toBeNull()
    expect(row.standings[0]).toEqual({ team: a.name, points: 2 })
  })

  it('only the coordinator reads it, and nobody else can write it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [a, b] = c.teams
    const m = await insertMatch(db, c, 1, c.bases[0].id, a.id, b.id)
    await playMatch(db, c, m, [a.id, a.id, a.id])
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    const admin = await getAdmin(db)
    expect((await db.asUser(admin).sql(`select id from public.event_archives where event_id = $1`, [c.eventId])).length).toBe(1)
    for (const who of [a.runners[0], c.bases[0].staff]) {
      expect(await db.asUser(who).sql(`select id from public.event_archives`)).toHaveLength(0)
      await expect(db.asUser(who).sql(`insert into public.event_archives (event_name) values ('x')`)).rejects.toThrow()
    }
    await expect(db.asUser(admin).sql(`select public.archive_event_scores($1)`, [c.eventId])).rejects.toThrow() // not callable by the app
  })
})
