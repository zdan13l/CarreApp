// Migration 0023: the personal passport of each inductor (terms, records per semester, stamps kept for ever).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { activate, getAdmin, insertMatch, playMatch, seedCarrera, type CarreraSeed } from './seed'

let db: TestDb
let n = 0
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

async function newTerm(name = `2026-${++n}`, current = false): Promise<string> {
  if (current) await db.sql(`update public.terms set is_current = false`)
  const [t] = await db.sql<{ id: string }>(`insert into public.terms (name, theme, is_current) values ($1, 'mitologias', $2) returning id`, [name, current])
  return t.id
}

/** A personal login: an auth user with a passport and NO profile (it must not reach the live operation). */
async function addPassport(username: string, fullName = `Persona ${username}`): Promise<string> {
  const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${username}@carreapp.test`])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $3)`, [u.id, username, fullName])
  return u.id
}

async function addRecord(
  passport: string,
  term: string,
  role: 'runner' | 'base' | 'coordinator' = 'runner',
  extra: { team?: string | null; base?: string | null; career?: string; culture?: string } = {},
): Promise<string> {
  const [r] = await db.sql<{ id: string }>(
    `insert into public.passport_records (passport_id, term_id, role, career, culture, team_id, base_id) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [passport, term, role, extra.career ?? 'Ingeniería de Sistemas', extra.culture ?? 'nordica', extra.team ?? null, extra.base ?? null],
  )
  return r.id
}

/** A Carrera that belongs to a term and is ready to be played. */
async function carreraOf(term: string, opts: { teams?: number; bases?: number } = {}): Promise<CarreraSeed> {
  const c = await seedCarrera(db, { teams: opts.teams ?? 2, bases: opts.bases ?? 1 })
  await db.sql(`update public.events set term_id = $2 where id = $1`, [c.eventId, term])
  return c
}

describe('terms', () => {
  it('only one term is the current one', async () => {
    await newTerm(`vigente-${++n}`, true)
    await expect(db.sql(`insert into public.terms (name, is_current) values ($1, true)`, [`otra-${++n}`])).rejects.toThrow()
  })

  it('every authenticated user reads them, only the coordinator writes', async () => {
    const admin = await getAdmin(db)
    const me = await addPassport(`lector.${++n}`)
    const t = await newTerm()
    expect((await db.asUser(me).sql(`select * from public.terms where id = $1`, [t])).length).toBe(1)
    expect(await db.asUser(me).affected(`update public.terms set theme = 'otra' where id = $1`, [t])).toBe(0)
    expect(await db.asUser(me).affected(`delete from public.terms where id = $1`, [t])).toBe(0)
    expect(await db.asUser(admin).affected(`update public.terms set theme = 'griega-2' where id = $1`, [t])).toBe(1)
    expect((await db.asAnon().sql(`select * from public.terms`).catch(() => [])).length).toBe(0)
  })

  it('a new Carrera is created inside the current term', async () => {
    const t = await newTerm(`actual-${++n}`, true)
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const [e] = await db.sql<{ term_id: string }>(`select term_id from public.events where id = $1`, [c.eventId])
    expect(e.term_id).toBe(t)
  })
})

describe('passports and records are private', () => {
  it('each person reads only their own passport and records; the coordinator reads all; anonymous nothing', async () => {
    const admin = await getAdmin(db)
    const t = await newTerm()
    const a = await addPassport(`ana.${++n}`)
    const b = await addPassport(`beto.${++n}`)
    await addRecord(a, t)
    await addRecord(b, t, 'base')
    const mine = await db.asUser(a).sql<{ id: string }>(`select id from public.passports`)
    expect(mine.map((x) => x.id)).toEqual([a])
    expect((await db.asUser(a).sql(`select * from public.passport_records`)).length).toBe(1)
    expect((await db.asUser(admin).sql(`select * from public.passports where id in ($1, $2)`, [a, b])).length).toBe(2)
    expect((await db.asAnon().sql(`select * from public.passports`).catch(() => [])).length).toBe(0)
  })

  it('a person cannot edit their own role, photo or records (the coordinator does)', async () => {
    const t = await newTerm()
    const a = await addPassport(`ana.${++n}`)
    await addRecord(a, t)
    expect(await db.asUser(a).affected(`update public.passport_records set role = 'coordinator' where passport_id = $1`, [a])).toBe(0)
    expect(await db.asUser(a).affected(`update public.passports set photo_path = 'users/x.jpg' where id = $1`, [a])).toBe(0) // nothing of the passport is the person's
    await expect(db.asUser(a).sql(`insert into public.passport_records (passport_id, term_id, role, career, culture) values ($1, $2, 'runner', 'x', 'griega')`, [a, await newTerm()])).rejects.toThrow()
  })

  it('a personal login does not reach the live operation (no profile: it sees no Carrera at all)', async () => {
    const t = await newTerm()
    const c = await carreraOf(t)
    await activate(db, c)
    const a = await addPassport(`ana.${++n}`)
    for (const table of ['teams', 'bases', 'matches', 'match_scores', 'profiles', 'team_runners']) {
      const rows = await db.asUser(a).sql(`select * from public.${table}`)
      expect(rows.length, table).toBe(0)
    }
  })

  it('stamps are readable only by their owner and the coordinator', async () => {
    const admin = await getAdmin(db)
    const t = await newTerm()
    const a = await addPassport(`ana.${++n}`)
    const b = await addPassport(`beto.${++n}`)
    const ra = await addRecord(a, t)
    await db.sql(`insert into public.passport_stamps (record_id, event_name, kind, base_name, round_number) values ($1, 'Carrera X', 'visited', 'Atrio', 1)`, [ra])
    expect((await db.asUser(a).sql(`select * from public.passport_stamps`)).length).toBe(1)
    expect((await db.asUser(b).sql(`select * from public.passport_stamps`)).length).toBe(0)
    expect((await db.asUser(admin).sql(`select * from public.passport_stamps where record_id = $1`, [ra])).length).toBe(1)
    expect(await db.asUser(a).affected(`delete from public.passport_stamps`)).toBe(0)
  })
})

describe('the record of a semester', () => {
  it('is one per person and semester, and the same person can change role in another semester', async () => {
    const t1 = await newTerm()
    const t2 = await newTerm()
    const a = await addPassport(`ana.${++n}`)
    await addRecord(a, t1, 'runner')
    await expect(addRecord(a, t1, 'base')).rejects.toThrow()
    await addRecord(a, t2, 'base')
    expect((await db.sql(`select * from public.passport_records where passport_id = $1`, [a])).length).toBe(2)
  })

  it('a group is two people at most', async () => {
    const t = await newTerm()
    const c = await carreraOf(t)
    const [team] = c.teams
    const p = [await addPassport(`a.${++n}`), await addPassport(`b.${++n}`), await addPassport(`c.${++n}`)]
    await addRecord(p[0], t, 'runner', { team: team.id })
    await addRecord(p[1], t, 'runner', { team: team.id })
    await expect(addRecord(p[2], t, 'runner', { team: team.id })).rejects.toThrow(/dos personas/)
  })

  it('only a runner has a group and only a base has a base', async () => {
    const t = await newTerm()
    const c = await carreraOf(t)
    const a = await addPassport(`a.${++n}`)
    await expect(addRecord(a, t, 'base', { team: c.teams[0].id })).rejects.toThrow()
    await expect(addRecord(a, t, 'runner', { base: c.bases[0].id })).rejects.toThrow()
    await addRecord(a, t, 'base', { base: c.bases[0].id })
  })

  it('the group must be from a Carrera of the same term', async () => {
    const t1 = await newTerm()
    const t2 = await newTerm()
    const c = await carreraOf(t1)
    const a = await addPassport(`a.${++n}`)
    await expect(addRecord(a, t2, 'runner', { team: c.teams[0].id })).rejects.toThrow(/otro semestre/)
    await expect(addRecord(a, t2, 'base', { base: c.bases[0].id })).rejects.toThrow(/otro semestre/)
  })

  it('deleting the group leaves the person without group (the record stays)', async () => {
    const t = await newTerm()
    const c = await carreraOf(t)
    const a = await addPassport(`a.${++n}`)
    const r = await addRecord(a, t, 'runner', { team: c.teams[0].id })
    await db.sql(`delete from public.teams where id = $1`, [c.teams[0].id])
    const [row] = await db.sql<{ team_id: string | null }>(`select team_id from public.passport_records where id = $1`, [r])
    expect(row.team_id).toBeNull()
  })

  it('deleting the login removes the passport, its records and its stamps', async () => {
    const t = await newTerm()
    const a = await addPassport(`a.${++n}`)
    const r = await addRecord(a, t)
    await db.sql(`insert into public.passport_stamps (record_id, event_name, kind, round_number) values ($1, 'X', 'coordinated', 0)`, [r])
    await db.sql(`delete from auth.users where id = $1`, [a])
    expect((await db.sql(`select * from public.passport_records where id = $1`, [r])).length).toBe(0)
    expect((await db.sql(`select * from public.passport_stamps where record_id = $1`, [r])).length).toBe(0)
  })
})

describe('what the passport shows of the Carrera', () => {
  it('my_passport_context: my group, the person I run with, my base — and nobody else’s', async () => {
    const t = await newTerm()
    const c = await carreraOf(t, { teams: 2, bases: 1 })
    const ana = await addPassport(`ana.${++n}`, 'Ana Gómez')
    const beto = await addPassport(`beto.${++n}`, 'Beto Ruiz')
    const caro = await addPassport(`caro.${++n}`, 'Caro Pérez')
    const base = await addPassport(`base.${++n}`, 'Dani Base')
    const coord = await addPassport(`coord.${++n}`, 'Coordi')
    await addRecord(ana, t, 'runner', { team: c.teams[0].id })
    await addRecord(beto, t, 'runner', { team: c.teams[0].id })
    await addRecord(caro, t, 'runner', { team: c.teams[1].id })
    await addRecord(base, t, 'base', { base: c.bases[0].id })
    await addRecord(coord, t, 'coordinator')

    type Ctx = { team_name: string | null; partners: string[]; base_name: string | null; event_name: string | null }
    const [a] = await db.asUser(ana).sql<Ctx>(`select * from public.my_passport_context()`)
    expect(a.team_name).toBe('Grupo 1')
    expect(a.partners).toEqual(['Beto Ruiz'])
    const [cr] = await db.asUser(caro).sql<Ctx>(`select * from public.my_passport_context()`)
    expect(cr.team_name).toBe('Grupo 2')
    expect(cr.partners).toEqual([]) // she is alone in her group so far
    const [b] = await db.asUser(base).sql<Ctx>(`select * from public.my_passport_context()`)
    expect(b.base_name).toBe('Base 1')
    const [co] = await db.asUser(coord).sql<Ctx>(`select * from public.my_passport_context()`)
    expect(co.team_name).toBeNull()
    expect(co.event_name).toBeTruthy() // the Carrera of his semester
    expect(Object.keys(a).sort()).toEqual(['base_id', 'base_name', 'base_photo_path', 'event_active', 'event_id', 'event_name', 'partners', 'record_id', 'team_id', 'team_name', 'team_photo_path'])
    expect((await db.asAnon().sql(`select * from public.my_passport_context()`).catch(() => 'denied'))).toBe('denied')
  })

  it('my_live_stamps: the matches my group (or my base) already finished in the active Carrera', async () => {
    const t = await newTerm()
    const c = await carreraOf(t, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const runner = await addPassport(`corre.${++n}`)
    const other = await addPassport(`otro.${++n}`)
    const base = await addPassport(`base.${++n}`)
    await addRecord(runner, t, 'runner', { team: c.teams[0].id })
    await addRecord(other, t, 'runner', { team: c.teams[1].id })
    await addRecord(base, t, 'base', { base: c.bases[0].id })
    type Live = { kind: string; base_name: string; round_number: number }
    expect(await db.asUser(runner).sql<Live>(`select * from public.my_live_stamps()`)).toEqual([])
    await playMatch(db, c, m, [c.teams[0].id, c.teams[0].id, c.teams[1].id])
    const r = await db.asUser(runner).sql<Live>(`select * from public.my_live_stamps()`)
    expect(r.map((x) => [x.kind, x.base_name, x.round_number])).toEqual([['visited', 'Base 1', 1]])
    expect((await db.asUser(other).sql<Live>(`select * from public.my_live_stamps()`)).length).toBe(1) // the opponent also visited it
    const h = await db.asUser(base).sql<Live>(`select * from public.my_live_stamps()`)
    expect(h.map((x) => [x.kind, x.round_number])).toEqual([['hosted', 1]])
    // the stamps carry no points: only these columns
    expect(Object.keys(r[0]).sort()).toEqual(['base_key', 'base_name', 'event_id', 'event_name', 'kind', 'record_id', 'round_number', 'stamped_at'])
  })
})

describe('the stamps are archived when the Carrera ends (and survive the reset)', () => {
  async function playedCarrera() {
    const t = await newTerm()
    const c = await carreraOf(t, { teams: 2, bases: 2 })
    const m1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const runner = await addPassport(`corre.${++n}`)
    const base = await addPassport(`base.${++n}`)
    const coord = await addPassport(`coord.${++n}`)
    const rr = await addRecord(runner, t, 'runner', { team: c.teams[0].id })
    const rb = await addRecord(base, t, 'base', { base: c.bases[0].id })
    const rc = await addRecord(coord, t, 'coordinator')
    return { t, c, m1, runner, base, coord, rr, rb, rc }
  }
  const stamps = (record: string) =>
    db.sql<{ kind: string; base_name: string | null; round_number: number; event_name: string }>(
      `select kind, base_name, round_number, event_name from public.passport_stamps where record_id = $1 order by round_number`, [record])

  it('keeps the stamps of the runner, the base and the coordinator after the progress is reset', async () => {
    const x = await playedCarrera()
    await playMatch(db, x.c, x.m1, [x.c.teams[0].id, x.c.teams[0].id, x.c.teams[1].id])
    expect(await stamps(x.rr)).toEqual([]) // nothing is archived while the Carrera runs
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    expect((await stamps(x.rr)).map((s) => [s.kind, s.base_name, s.round_number])).toEqual([['visited', 'Base 1', 1]])
    expect((await stamps(x.rb)).map((s) => [s.kind, s.round_number])).toEqual([['hosted', 1]])
    expect((await stamps(x.rc)).map((s) => [s.kind, s.round_number])).toEqual([['coordinated', 0]])
    // the reset of 0020 still happened: no scores, the match is pending again
    const [m] = await db.sql<{ status: string }>(`select status from public.matches where id = $1`, [x.m1.id])
    expect(m.status).toBe('pending')
    expect((await db.sql(`select * from public.match_scores where match_id = $1`, [x.m1.id])).length).toBe(0)
  })

  it('a Carrera where nothing was finished leaves no stamps (not even for the coordinator)', async () => {
    const x = await playedCarrera()
    await activate(db, x.c)
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    expect(await stamps(x.rr)).toEqual([])
    expect(await stamps(x.rc)).toEqual([])
  })

  it('activating and ending the Carrera twice does not duplicate the stamps', async () => {
    const x = await playedCarrera()
    await playMatch(db, x.c, x.m1, [x.c.teams[0].id, x.c.teams[0].id, x.c.teams[1].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    await playMatch(db, x.c, x.m1, [x.c.teams[1].id, x.c.teams[1].id, x.c.teams[1].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    expect((await stamps(x.rr)).length).toBe(1)
  })

  it('a person that is not linked to a group or a base gets nothing', async () => {
    const x = await playedCarrera()
    const free = await addPassport(`libre.${++n}`)
    const rf = await addRecord(free, await newTerm(), 'runner')
    await playMatch(db, x.c, x.m1, [x.c.teams[0].id, x.c.teams[0].id, x.c.teams[1].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    expect(await stamps(rf)).toEqual([])
  })

  it('the stamps stay when the Carrera is deleted (the Carrera name is kept with them)', async () => {
    const x = await playedCarrera()
    await playMatch(db, x.c, x.m1, [x.c.teams[0].id, x.c.teams[0].id, x.c.teams[1].id])
    await db.sql(`update public.events set is_active = false where id = $1`, [x.c.eventId])
    const [ev] = await db.sql<{ name: string }>(`select name from public.events where id = $1`, [x.c.eventId])
    await db.sql(`delete from public.events where id = $1`, [x.c.eventId])
    const s = await stamps(x.rr)
    expect(s.length).toBe(1)
    expect(s[0].event_name).toBe(ev.name)
  })
})
