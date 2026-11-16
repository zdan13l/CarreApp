// The schedule generator (what the coordinator's screen proposes) against the real database rules,
// for many sizes: whatever it proposes must be accepted, and it must be complete and fair.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { playMatch, scheduleWithGenerator, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

const SIZES: [teams: number, bases: number][] = [
  [2, 1], [3, 1], [4, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 2], [8, 4], [9, 4], [10, 5], [12, 3], [12, 6],
]

describe('generator output is always accepted by the database', () => {
  it.each(SIZES)('%i groups, %i bases', async (teams, bases) => {
    const c = await seedCarrera(db, { teams, bases, runnersPerTeam: 0, complete: false })
    const rounds = teams % 2 === 0 ? teams - 1 : teams // full round robin
    const matches = await scheduleWithGenerator(db, c, rounds) // would throw on any rule violation

    // no group twice in a round, no base twice in a round, no pair twice
    const key = (r: number, id: string) => `${r}|${id}`
    const seen = new Set<string>()
    const pairs = new Set<string>()
    for (const m of matches) {
      for (const id of [m.teamA, m.teamB, m.baseId]) {
        expect(seen.has(key(m.round, id))).toBe(false)
        seen.add(key(m.round, id))
      }
      const pair = [m.teamA, m.teamB].sort().join('|')
      expect(pairs.has(pair)).toBe(false)
      pairs.add(pair)
    }

    // complete when there are enough bases for every match of a round; otherwise it drops the extra ones
    const perRound = Math.floor(teams / 2)
    const expectedMatches = rounds * Math.min(perRound, bases)
    expect(matches).toHaveLength(expectedMatches)
    if (bases >= perRound) expect(pairs.size).toBe((teams * (teams - 1)) / 2)
  })
})

describe('at the scale of a big Carrera', () => {
  it('20 groups, 10 bases, 19 rounds, 190 matches: scheduled and played in a few seconds', async () => {
    const started = Date.now()
    const c = await seedCarrera(db, { teams: 20, bases: 10, runnersPerTeam: 2 })
    const matches = await scheduleWithGenerator(db, c, 19)
    expect(matches).toHaveLength(190)
    for (const round of Array.from({ length: 19 }, (_, i) => i + 1)) {
      for (const m of matches.filter((x) => x.round === round)) await playMatch(db, c, m, [m.teamA, m.teamB, m.teamA])
    }
    const [{ n }] = await db.sql<{ n: string }>(`select count(*)::text as n from public.matches where event_id = $1 and status = 'finished'`, [c.eventId])
    expect(Number(n)).toBe(190)
    const total = (await db.sql<{ points: string }>(`select points from public.team_standings where event_id = $1`, [c.eventId])).reduce((a, r) => a + Number(r.points), 0)
    expect(total).toBe(190 * 3)
    expect(Date.now() - started).toBeLessThan(30_000)
  })
})
