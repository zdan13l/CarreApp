// Business rules enforced by the database: what must be impossible no matter what the client does.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, getAdmin, insertMatch, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

describe('schedule rules', () => {
  it('rejects a repeated matchup, also with the groups reversed, in any later round or base', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const [a, b, x, y] = c.teams.map((t) => t.id)
    await insertMatch(db, c, 1, c.bases[0].id, a, b)
    await expect(insertMatch(db, c, 2, c.bases[0].id, a, b)).rejects.toThrow(/matches_no_repeat_pair/)
    await expect(insertMatch(db, c, 2, c.bases[1].id, b, a)).rejects.toThrow(/matches_no_repeat_pair/)
    await insertMatch(db, c, 2, c.bases[0].id, a, x) // a different rival is fine
    await insertMatch(db, c, 3, c.bases[1].id, b, y)
  })

  it('does not let a group be in two bases during the same round', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const [a, b, x] = c.teams.map((t) => t.id)
    await insertMatch(db, c, 1, c.bases[0].id, a, b)
    await expect(insertMatch(db, c, 1, c.bases[1].id, a, x)).rejects.toThrow(/dos bases durante la misma ronda/)
    await expect(insertMatch(db, c, 1, c.bases[1].id, x, b)).rejects.toThrow(/dos bases durante la misma ronda/)
  })

  it('lets a base host only one match per round', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 1 })
    const [a, b, x, y] = c.teams.map((t) => t.id)
    await insertMatch(db, c, 1, c.bases[0].id, a, b)
    await expect(insertMatch(db, c, 1, c.bases[0].id, x, y)).rejects.toThrow(/matches_base_id_round_number_key/)
    await insertMatch(db, c, 2, c.bases[0].id, x, y)
  })

  it('does not let a group play itself', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await expect(insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[0].id)).rejects.toThrow(/matches_check/)
  })

  it('refuses groups or bases from another Carrera', async () => {
    const one = await seedCarrera(db, { teams: 2, bases: 1 })
    const two = await seedCarrera(db, { teams: 2, bases: 1 })
    await expect(insertMatch(db, one, 1, one.bases[0].id, one.teams[0].id, two.teams[0].id)).rejects.toThrow(/misma Carrera/)
    await expect(insertMatch(db, one, 1, two.bases[0].id, one.teams[0].id, one.teams[1].id)).rejects.toThrow(/misma Carrera/)
  })

  it('frees the pair when the match is deleted', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await db.sql(`delete from public.matches where id = $1`, [m.id])
    await insertMatch(db, c, 2, c.bases[0].id, c.teams[1].id, c.teams[0].id)
  })
})

describe('staffing rules', () => {
  it('lets an inductor staff only ONE base per Carrera, but another one in a different Carrera', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    await expect(db.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [c.bases[1].id, c.bases[0].staff])).rejects.toThrow(
      /ya está asignado a otra base de esta Carrera/,
    )
    const other = await seedCarrera(db, { teams: 2, bases: 1 })
    await db.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [other.bases[0].id, c.bases[0].staff])
  })

  it('lets a runner belong to only ONE group per Carrera', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await expect(db.sql(`insert into public.team_runners (team_id, user_id) values ($1, $2)`, [c.teams[1].id, c.teams[0].runners[1]])).rejects.toThrow(
      /ya está en otro grupo de esta Carrera/,
    )
  })

  it('allows a single GPS tracker per group', async () => {
    const c = await seedCarrera(db, { teams: 1, bases: 1, runnersPerTeam: 2 })
    await expect(
      db.sql(`update public.team_runners set is_gps_tracker = true where team_id = $1 and user_id = $2`, [c.teams[0].id, c.teams[0].runners[1]]),
    ).rejects.toThrow(/team_single_gps_tracker/)
  })

  it('validates usernames (3-30 chars, lowercase letters, digits . _ -) and their uniqueness', async () => {
    const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ('x@carreapp.test') returning id`)
    const insert = (name: string) => db.sql(`insert into public.profiles (id, username, full_name, role) values ($1, $2, 'X', 'runner')`, [u.id, name])
    for (const bad of ['ab', 'Mayuscula', 'con espacio', 'ñandú', 'a'.repeat(31), 'tilde.é']) {
      await expect(insert(bad), `username "${bad}"`).rejects.toThrow(/profiles_username_check/)
    }
    await insert('valido.user-1_ok')
    const [v] = await db.sql<{ id: string }>(`insert into auth.users (email) values ('y@carreapp.test') returning id`)
    await expect(db.sql(`insert into public.profiles (id, username, full_name, role) values ($1, 'valido.user-1_ok', 'Y', 'runner')`, [v.id])).rejects.toThrow(/duplicate key/)
  })
})

describe('activating a Carrera', () => {
  const problems = async (eventId: string) => (await db.sql<{ p: string[] }>(`select public.event_problems($1) as p`, [eventId]))[0].p

  it('works when everything is complete', async () => {
    const c = await seedCarrera(db)
    expect(await problems(c.eventId)).toEqual([])
    await db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
    const [e] = await db.sql<{ is_active: boolean }>(`select is_active from public.events where id = $1`, [c.eventId])
    expect(e.is_active).toBe(true)
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId]) // switching off is always allowed
  })

  it('lists and blocks every missing piece', async () => {
    const c = await seedCarrera(db, { complete: false, runnersPerTeam: 1 })
    const list = (await problems(c.eventId)).join(' | ')
    expect(list).toContain('El grupo "Grupo 1" no tiene foto')
    expect(list).toContain('tiene 1 de 2 corredores')
    expect(list).toContain('La base "Base 1" no tiene foto del lugar')
    expect(list).toContain('no tiene la información que se da')
    expect(list).toContain('tiene 0 de 3 preguntas')
    await expect(db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])).rejects.toThrow(/No se puede activar la Carrera/)
  })

  it('needs at least 2 groups and 1 base', async () => {
    const c = await seedCarrera(db, { teams: 1, bases: 1 })
    expect((await problems(c.eventId)).join(' ')).toContain('al menos 2 grupos')
    const empty = await seedCarrera(db, { teams: 2, bases: 0 })
    expect((await problems(empty.eventId)).join(' ')).toContain('al menos 1 base')
  })

  it('allows only one active Carrera at a time', async () => {
    const one = await seedCarrera(db)
    const two = await seedCarrera(db)
    await db.sql(`update public.events set is_active = true where id = $1`, [one.eventId])
    await expect(db.sql(`update public.events set is_active = true where id = $1`, [two.eventId])).rejects.toThrow(/events_single_active/)
    await db.sql(`update public.events set is_active = false where id = $1`, [one.eventId])
    await db.sql(`update public.events set is_active = true where id = $1`, [two.eventId])
    await db.sql(`update public.events set is_active = false where id = $1`, [two.eventId])
  })

  it('keeps the general travel time between 1 and 120 minutes', async () => {
    const c = await seedCarrera(db)
    for (const bad of [0, 121, -5]) {
      await expect(db.sql(`update public.events set max_travel_minutes = $2 where id = $1`, [c.eventId, bad])).rejects.toThrow(/max_travel_minutes/)
    }
  })
})

describe('arrival confirmation', () => {
  it('can be given only by the inductor of that base (or the coordinator) and starts the match', async () => {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const status = async () => (await db.sql<{ status: string; arrived: boolean }>(`select status, arrived_at is not null as arrived from public.matches where id = $1`, [m.id]))[0]
    expect(await status()).toEqual({ status: 'pending', arrived: false })

    await expect(db.asUser(c.bases[1].staff).sql(`select public.confirm_arrival($1)`, [m.id])).rejects.toThrow(/Solo la base de este cruce/)
    await expect(db.asUser(c.teams[0].runners[0]).sql(`select public.confirm_arrival($1)`, [m.id])).rejects.toThrow(/Solo la base de este cruce/)
    expect(await status()).toEqual({ status: 'pending', arrived: false })

    await db.asUser(c.bases[0].staff).sql(`select public.confirm_arrival($1)`, [m.id])
    expect(await status()).toEqual({ status: 'in_progress', arrived: true })
    const [{ at }] = await db.sql<{ at: string }>(`select arrived_at::text as at from public.matches where id = $1`, [m.id])
    await db.asUser(c.admin).sql(`select public.confirm_arrival($1)`, [m.id]) // idempotent: keeps the first time
    expect((await db.sql<{ at: string }>(`select arrived_at::text as at from public.matches where id = $1`, [m.id]))[0].at).toBe(at)
  })
})

describe('scoring rules', () => {
  async function setup() {
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const m2 = await insertMatch(db, c, 2, c.bases[0].id, c.teams[0].id, c.teams[2].id)
    const other = await insertMatch(db, c, 1, c.bases[1].id, c.teams[2].id, c.teams[3].id)
    return { c, m1, m2, other, base: db.asUser(c.bases[0].staff), admin: db.asUser(c.admin) }
  }
  const score = (as: ReturnType<TestDb['asUser']>, matchId: string, item: string, winner: string | null, voided = false) =>
    as.sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, $2, $3, $4)`, [matchId, item, winner, voided])
  const state = async (id: string) =>
    (await db.sql<{ status: string; finished: boolean }>(`select status, finished_at is not null as finished from public.matches where id = $1`, [id]))[0]

  it('moves a match pending → in progress → finished and stamps who scored and when it ended', async () => {
    const { c, m1, base } = await setup()
    expect(await state(m1.id)).toEqual({ status: 'pending', finished: false })
    await score(base, m1.id, 'barra', m1.teamA)
    expect(await state(m1.id)).toEqual({ status: 'in_progress', finished: false })
    await score(base, m1.id, 'pregunta', m1.teamB)
    await score(base, m1.id, 'minijuego', m1.teamA)
    expect(await state(m1.id)).toEqual({ status: 'finished', finished: true })
    const rows = await db.sql<{ awarded_by: string }>(`select awarded_by from public.match_scores where match_id = $1`, [m1.id])
    expect(new Set(rows.map((r) => r.awarded_by))).toEqual(new Set([c.bases[0].staff]))
  })

  it('lets a base score only its own matches', async () => {
    const { c, other } = await setup()
    await expect(score(db.asUser(c.bases[0].staff), other.id, 'barra', other.teamA)).rejects.toThrow(/row-level security/)
    await expect(score(db.asUser(c.teams[2].runners[0]), other.id, 'barra', other.teamA)).rejects.toThrow(/row-level security/)
  })

  it('never accepts a tie, a winner from outside the match, or the same item twice', async () => {
    const { c, m1, base } = await setup()
    await expect(score(base, m1.id, 'barra', null)).rejects.toThrow(/match_scores_winner_or_void/)
    await expect(score(base, m1.id, 'barra', c.teams[3].id)).rejects.toThrow(/uno de los dos grupos/)
    await score(base, m1.id, 'barra', m1.teamA)
    await expect(score(base, m1.id, 'barra', m1.teamB)).rejects.toThrow(/match_scores_match_id_item_key/)
  })

  it('does not let a base edit or delete what it already sent; only the coordinator can', async () => {
    const { m1, base, admin } = await setup()
    await score(base, m1.id, 'barra', m1.teamA)
    expect(await base.affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m1.id, m1.teamB])).toBe(0)
    expect(await base.affected(`delete from public.match_scores where match_id = $1`, [m1.id])).toBe(0)
    expect(await admin.affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m1.id, m1.teamB])).toBe(1)
    const [row] = await db.sql<{ winner_team_id: string }>(`select winner_team_id from public.match_scores where match_id = $1`, [m1.id])
    expect(row.winner_team_id).toBe(m1.teamB)
  })

  it('lets only the coordinator void an item; nobody scores it and the match can still finish', async () => {
    const { m1, base, admin } = await setup()
    await expect(score(base, m1.id, 'barra', null, true)).rejects.toThrow(/Solo el coordinador puede invalidar/)
    await score(admin, m1.id, 'barra', null, true)
    await score(admin, m1.id, 'pregunta', null, true)
    expect(await state(m1.id)).toEqual({ status: 'in_progress', finished: false })
    await expect(score(base, m1.id, 'barra', m1.teamA)).rejects.toThrow(/match_scores_match_id_item_key/) // already resolved
    await score(base, m1.id, 'minijuego', m1.teamB)
    expect(await state(m1.id)).toEqual({ status: 'finished', finished: true })
    const points = await db.sql<{ team_id: string; points: string }>(`select team_id, points from public.team_standings where team_id in ($1, $2)`, [m1.teamA, m1.teamB])
    expect(Object.fromEntries(points.map((p) => [p.team_id, Number(p.points)]))).toEqual({ [m1.teamA]: 0, [m1.teamB]: 1 })
  })

  it('lets the coordinator void all 3 items so the base can move on without playing', async () => {
    const { c, m1, m2, base, admin } = await setup()
    await expect(score(base, m2.id, 'barra', m2.teamA)).rejects.toThrow(/Primero termina de calificar la ronda anterior/)
    for (const item of ['barra', 'pregunta', 'minijuego']) await score(admin, m1.id, item, null, true)
    expect(await state(m1.id)).toEqual({ status: 'finished', finished: true })
    await score(db.asUser(c.bases[0].staff), m2.id, 'barra', m2.teamA) // round 2 unlocked
  })

  it('makes a base finish round 1 before it can score round 2 (the coordinator is exempt)', async () => {
    const { m1, m2, base, admin } = await setup()
    await expect(score(base, m2.id, 'barra', m2.teamA)).rejects.toThrow(/Primero termina de calificar la ronda anterior/)
    await score(base, m1.id, 'barra', m1.teamA)
    await score(base, m1.id, 'pregunta', m1.teamA)
    await expect(score(base, m2.id, 'barra', m2.teamA)).rejects.toThrow(/Primero termina de calificar la ronda anterior/) // 2 of 3 is not enough
    await score(admin, m2.id, 'barra', m2.teamA) // the coordinator may score out of order
    await score(base, m1.id, 'minijuego', m1.teamB)
    await score(base, m2.id, 'pregunta', m2.teamA)
  })

  it('writes every change to the audit log and reopens the match when a score is deleted', async () => {
    const { c, m1, base, admin } = await setup()
    await db.asUser(c.bases[0].staff).sql(`select public.confirm_arrival($1)`, [m1.id])
    await score(base, m1.id, 'barra', m1.teamA)
    await score(base, m1.id, 'pregunta', m1.teamA)
    await score(base, m1.id, 'minijuego', m1.teamA)
    expect((await state(m1.id)).status).toBe('finished')
    await admin.sql(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m1.id, m1.teamB])
    await admin.sql(`delete from public.match_scores where match_id = $1 and item = 'minijuego'`, [m1.id])
    expect(await state(m1.id)).toEqual({ status: 'in_progress', finished: false }) // reopened, finish time cleared
    const log = await db.sql<{ action: string; item: string }>(`select action, item from public.score_audit where match_id = $1 order by id`, [m1.id])
    expect(log.map((r) => `${r.action}:${r.item}`)).toEqual(['insert:barra', 'insert:pregunta', 'insert:minijuego', 'update:barra', 'delete:minijuego'])
    // after deleting every score a match that had its arrival confirmed stays in progress
    await admin.sql(`delete from public.match_scores where match_id = $1`, [m1.id])
    expect((await state(m1.id)).status).toBe('in_progress')
  })

  it('shows the audit log only to the coordinator', async () => {
    const { c, m1, base } = await setup()
    await score(base, m1.id, 'barra', m1.teamA)
    expect((await db.asUser(c.admin).sql(`select * from public.score_audit`)).length).toBeGreaterThan(0)
    expect(await db.asUser(c.bases[0].staff).sql(`select * from public.score_audit`)).toHaveLength(0)
    expect(await db.asUser(c.teams[0].runners[0]).sql(`select * from public.score_audit`)).toHaveLength(0)
  })

  it('computes the standings from the scores (1 point per item won)', async () => {
    const { c, m1, base } = await setup()
    await score(base, m1.id, 'barra', m1.teamA)
    await score(base, m1.id, 'pregunta', m1.teamA)
    await score(base, m1.id, 'minijuego', m1.teamB)
    const table = await db.asUser(c.teams[3].runners[0]).sql<{ team_id: string; points: string }>(`select team_id, points from public.team_standings where event_id = $1`, [c.eventId])
    const points = Object.fromEntries(table.map((r) => [r.team_id, Number(r.points)]))
    expect(points[m1.teamA]).toBe(2)
    expect(points[m1.teamB]).toBe(1)
    expect(points[c.teams[2].id]).toBe(0)
    expect(points[c.teams[3].id]).toBe(0)
  })
})

describe('behaviours worth knowing (characterization)', () => {
  it('the database lets a base score before arrival is confirmed: only the screen enforces it', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await db.asUser(c.bases[0].staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, m.teamA])
    const [row] = await db.sql<{ arrived: boolean; status: string }>(`select arrived_at is not null as arrived, status from public.matches where id = $1`, [m.id])
    expect(row).toEqual({ arrived: false, status: 'in_progress' })
  })

  it('an admin account cannot be created through the profile table by someone else', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const outsider = await addUser(db, `intruso.${Date.now()}`, 'runner')
    await expect(
      db.asUser(c.teams[0].runners[0]).sql(`update public.profiles set role = 'admin' where id = $1`, [outsider]),
    ).resolves.toEqual([]) // RLS hides the row: nothing is updated
    const [row] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [outsider])
    expect(row.role).toBe('runner')
    expect(await getAdmin(db)).toBeTruthy()
  })
})
