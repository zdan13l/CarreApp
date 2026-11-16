// Several Carreras in one database: users scoped per Carrera (0014), switching the active one,
// what each role can see when a Carrera is switched off, and the score audit log per Carrera.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, insertMatch, playMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

const setActive = async (eventId: string | null) => {
  await db.sql(`update public.events set is_active = false`)
  if (eventId) await db.sql(`update public.events set is_active = true where id = $1`, [eventId])
}
// The same idea as the runner / base screens: "my team / base in the ACTIVE Carrera".
const myActiveTeam = (userId: string) =>
  db.asUser(userId).sql(
    `select t.id from public.teams t join public.team_runners tr on tr.team_id = t.id join public.events e on e.id = t.event_id
      where tr.user_id = $1 and e.is_active`,
    [userId],
  )
const myActiveBase = (userId: string) =>
  db.asUser(userId).sql(
    `select b.id from public.bases b join public.base_staff bs on bs.base_id = b.id join public.events e on e.id = b.event_id
      where bs.user_id = $1 and e.is_active`,
    [userId],
  )
const profileEvent = async (id: string) => (await db.sql<{ event_id: string | null }>(`select event_id from public.profiles where id = $1`, [id]))[0].event_id
const auditPerEvent = async (admin: string, ids: string[]) => {
  const rows = await db.asUser(admin).sql<{ event_id: string; n: string }>(
    `select m.event_id, count(*)::text as n from public.score_audit s join public.matches m on m.id = s.match_id
      where m.event_id = any($1) group by m.event_id`,
    [ids],
  )
  return Object.fromEntries(rows.map((r) => [r.event_id, Number(r.n)]))
}

describe('users belong to one Carrera', () => {
  it('keeps the Carrera of a person after they leave a group (they cannot be moved to another Carrera)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const runner = a.teams[0].runners[1]
    await db.sql(`delete from public.team_runners where user_id = $1`, [runner])
    await expect(db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [b.teams[0].id, runner])).rejects.toThrow(/pertenece a otra Carrera/)
    await db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [a.teams[1].id, runner]) // same Carrera is fine
  })

  it('frees the people of a deleted Carrera (event_id becomes null) so another Carrera can adopt them', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const runner = a.teams[0].runners[0]
    const inductor = a.bases[0].staff
    await db.sql(`delete from public.events where id = $1`, [a.eventId])
    expect(await profileEvent(runner)).toBeNull()
    expect(await profileEvent(inductor)).toBeNull()
    await db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [b.teams[0].id, runner])
    expect(await profileEvent(runner)).toBe(b.eventId)
  })

  it('does not let a runner or inductor change their own Carrera or role (profiles are admin-write only)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    for (const who of [a.teams[0].runners[0], a.bases[0].staff]) {
      expect(await db.asUser(who).sql(`update public.profiles set event_id = $2 where id = $1 returning id`, [who, b.eventId])).toHaveLength(0)
      expect(await db.asUser(who).sql(`update public.profiles set role = 'admin' where id = $1 returning id`, [who])).toHaveLength(0)
    }
    expect(await profileEvent(a.teams[0].runners[0])).toBe(a.eventId)
  })

  it('shows each person only their own profile, never the users of another Carrera', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    await seedCarrera(db, { teams: 2, bases: 1 })
    const seen = await db.asUser(a.teams[0].runners[0]).sql<{ id: string }>(`select id from public.profiles`)
    expect(seen.map((r) => r.id)).toEqual([a.teams[0].runners[0]])
  })

  it('lets the coordinator adopt a user with no Carrera ("Asignar aquí"); afterwards a foreign group is refused', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const orphan = await addUser(db, 'huerfano' + Math.random().toString(36).slice(2, 7), 'runner')
    expect(await db.asUser(a.admin).sql(`update public.profiles set event_id = $2 where id = $1 returning event_id`, [orphan, a.eventId])).toHaveLength(1)
    await expect(db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [b.teams[0].id, orphan])).rejects.toThrow(/pertenece a otra Carrera/)
  })
})

describe('activating and switching Carreras', () => {
  it('allows only one active Carrera: activating B while A is active is refused', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    await setActive(a.eventId)
    await expect(db.sql(`update public.events set is_active = true where id = $1`, [b.eventId])).rejects.toThrow()
  })

  it('shows a runner and an inductor their team / base only while THEIR Carrera is the active one', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const [runA, runB] = [a.teams[0].runners[0], b.teams[0].runners[0]]
    const [baseA, baseB] = [a.bases[0].staff, b.bases[0].staff]

    await setActive(a.eventId)
    expect(await myActiveTeam(runA)).toHaveLength(1)
    expect(await myActiveBase(baseA)).toHaveLength(1)
    expect(await myActiveTeam(runB)).toHaveLength(0)
    expect(await myActiveBase(baseB)).toHaveLength(0)

    await setActive(null) // everything off: nobody has anything to do
    for (const u of [runA, runB]) expect(await myActiveTeam(u)).toHaveLength(0)
    for (const u of [baseA, baseB]) expect(await myActiveBase(u)).toHaveLength(0)

    await setActive(b.eventId) // switching Carreras flips who sees what
    expect(await myActiveTeam(runA)).toHaveLength(0)
    expect(await myActiveTeam(runB)).toHaveLength(1)
    expect(await myActiveBase(baseB)).toHaveLength(1)
  })

  it('lets every signed-in user read events and publishes events to Realtime (phones notice an activation)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    await setActive(a.eventId)
    for (const u of [a.teams[0].runners[0], a.bases[0].staff]) {
      const rows = await db.asUser(u).sql<{ is_active: boolean }>(`select is_active from public.events where id = $1`, [a.eventId])
      expect(rows[0]?.is_active).toBe(true)
    }
    const pub = await db.sql<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)
    expect(pub.map((p) => p.tablename)).toContain('events')
  })

  it('keeps the data of a deactivated Carrera intact for the coordinator (standings do not change)', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    await playMatch(db, a, m, [a.teams[0].id, a.teams[0].id, a.teams[1].id])
    await setActive(a.eventId)
    await setActive(null)
    const rows = await db.asUser(a.admin).sql<{ points: string }>(`select points from public.team_standings where event_id = $1 order by points desc`, [a.eventId])
    expect(rows.map((r) => Number(r.points))).toEqual([2, 1])
  })
})

describe('what a switched-off Carrera allows (0015)', () => {
  it('stops an inductor of an INACTIVE Carrera from scoring or confirming arrival, but not the coordinator', async () => {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    await setActive(null)
    const staff = db.asUser(a.bases[0].staff)
    await expect(staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, a.teams[0].id])).rejects.toThrow(/row-level security/)
    await expect(staff.sql(`select public.confirm_arrival($1)`, [m.id])).rejects.toThrow()
    // the coordinator can still correct any Carrera
    await db.asUser(a.admin).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, a.teams[0].id])
    // and the inductor works again as soon as the Carrera is the active one
    await setActive(a.eventId)
    await staff.sql(`select public.confirm_arrival($1)`, [m.id])
    await staff.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, a.teams[1].id])
  })
})

describe('score audit log per Carrera', () => {
  async function twoPlayed() {
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    const ma = await insertMatch(db, a, 1, a.bases[0].id, a.teams[0].id, a.teams[1].id)
    const mb = await insertMatch(db, b, 1, b.bases[0].id, b.teams[0].id, b.teams[1].id)
    await playMatch(db, a, ma, [a.teams[0].id, a.teams[0].id, a.teams[1].id])
    await playMatch(db, b, mb, [b.teams[0].id, b.teams[1].id, b.teams[1].id])
    return { a, b, ma, mb }
  }

  it('is one global table, but every row maps to exactly one Carrera through its match; a correction lands in its own Carrera', async () => {
    const { a, b, ma } = await twoPlayed()
    expect(await auditPerEvent(a.admin, [a.eventId, b.eventId])).toEqual({ [a.eventId]: 3, [b.eventId]: 3 })
    await db.asUser(a.admin).sql(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [ma.id, a.teams[1].id])
    expect(await auditPerEvent(a.admin, [a.eventId, b.eventId])).toEqual({ [a.eventId]: 4, [b.eventId]: 3 })
  })

  it('stays admin-only: runners and inductors of either Carrera read nothing', async () => {
    const { a, b } = await twoPlayed()
    for (const u of [a.teams[0].runners[0], b.teams[0].runners[0], a.bases[0].staff, b.bases[0].staff]) {
      expect(await db.asUser(u).sql(`select * from public.score_audit`)).toHaveLength(0)
    }
  })

  it('stamps every row with its Carrera (event_id), also when written by a trigger', async () => {
    const { a, b } = await twoPlayed()
    const rows = await db.asUser(a.admin).sql<{ event_id: string; n: string }>(
      `select event_id, count(*)::text as n from public.score_audit where event_id = any($1) group by event_id`,
      [[a.eventId, b.eventId]],
    )
    expect(Object.fromEntries(rows.map((r) => [r.event_id, Number(r.n)]))).toEqual({ [a.eventId]: 3, [b.eventId]: 3 })
  })

  it('keeps the rows of a deleted match inside their Carrera, so the log of a rescheduled Carrera is not lost', async () => {
    const { a, ma } = await twoPlayed()
    await db.sql(`delete from public.matches where id = $1`, [ma.id])
    const kept = await db.asUser(a.admin).sql(`select id from public.score_audit where event_id = $1 and match_id = $2`, [a.eventId, ma.id])
    expect(kept.length).toBeGreaterThan(0)
  })
})
