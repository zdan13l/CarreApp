// Migration 0045: the inductions a person already had, and every active inductor entering each new carrera by themselves.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, getAdmin } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

let n = 0
const person = async (extra: { career?: string | null; status?: string; prior?: number } = {}) => {
  const name = `veterano.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name, career, status, prior_inductions) values ($1, $2, $2, $3, $4, $5)`, [
    id,
    name,
    extra.career === undefined ? 'Ingeniería de Sistemas' : extra.career,
    extra.status ?? 'active',
    extra.prior ?? 0,
  ])
  return id
}
const count = async (id: string) => (await db.sql<{ inductions: number }>(`select inductions from public.passport_inductions where passport_id = $1`, [id]))[0]?.inductions
const newCarrera = async () => {
  const admin = await getAdmin(db)
  const [r] = await db.asUser(admin).sql<{ create_event: string }>(`select public.create_event()`)
  const [e] = await db.sql<{ id: string; term_id: string }>(`select id, term_id from public.events where id = $1`, [r.create_event])
  return { admin, eventId: e.id, termId: e.term_id }
}
const recordOf = async (passport: string, termId: string) =>
  (await db.sql<{ role: string; career: string; culture: string; team_id: string | null; base_id: string | null }>(`select role, career, culture, team_id, base_id from public.passport_records where passport_id = $1 and term_id = $2`, [passport, termId]))[0]

describe('the inductions a person already had (0045)', () => {
  it('a new inductor starts at 0 and a veteran is registered with the number they carry', async () => {
    const fresh = await person()
    const veteran = await person({ prior: 8 })
    expect(await count(fresh)).toBe(0)
    expect(await count(veteran)).toBe(8)
  })

  it('from there it adds one for each carrera they take part in, and a disabled one does not count', async () => {
    const admin = await getAdmin(db)
    const veteran = await person({ prior: 3 })
    const a = await newCarrera()
    expect(await count(veteran)).toBe(4)
    const b = await newCarrera()
    expect(await count(veteran)).toBe(5)
    await db.asUser(admin).sql(`update public.passport_records set disabled = true where passport_id = $1 and term_id = $2`, [veteran, b.termId])
    expect(await count(veteran)).toBe(4)
    expect(a.termId).not.toBe(b.termId)
  })

  it('the number is fixed: it stays when they join and only the coordi changes it', async () => {
    const admin = await getAdmin(db)
    const id = await person({ prior: 4 })
    await newCarrera()
    expect((await db.sql<{ prior_inductions: number }>(`select prior_inductions from public.passports where id = $1`, [id]))[0].prior_inductions).toBe(4)
    expect(await db.asUser(id).affected(`update public.passports set prior_inductions = 20 where id = $1`, [id])).toBe(0)
    await db.asUser(admin).sql(`update public.passports set prior_inductions = 6 where id = $1`, [id])
    expect(await count(id)).toBe(7)
  })

  it('it is a sensible number', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await expect(db.asUser(admin).sql(`update public.passports set prior_inductions = -1 where id = $1`, [id])).rejects.toThrow()
    await expect(db.asUser(admin).sql(`update public.passports set prior_inductions = 41 where id = $1`, [id])).rejects.toThrow()
  })

  it('each person sees only their own count; the coordi sees everybody, also those in no carrera yet', async () => {
    const admin = await getAdmin(db)
    const a = await person({ prior: 2 })
    const b = await person({ prior: 5 })
    expect((await db.asUser(a).sql<{ passport_id: string }>(`select passport_id from public.passport_inductions`)).map((r) => r.passport_id)).toEqual([a])
    expect((await db.asUser(admin).sql<{ passport_id: string }>(`select passport_id from public.passport_inductions`)).map((r) => r.passport_id)).toEqual(expect.arrayContaining([a, b]))
  })
})

describe('every active inductor enters each new carrera (0045)', () => {
  it('creating a carrera puts in every active inductor as a runner, with the culture of their career in THAT carrera', async () => {
    const sistemas = await person({ career: 'Ingeniería de Sistemas' })
    const civil = await person({ career: 'Ingeniería Civil' })
    const c = await newCarrera()
    expect(await recordOf(sistemas, c.termId)).toMatchObject({ role: 'runner', career: 'Ingeniería de Sistemas', culture: 'nordica', team_id: null, base_id: null })
    expect(await recordOf(civil, c.termId)).toMatchObject({ career: 'Ingeniería Civil', culture: 'egipcia' })
  })

  it('an ancestor, a disabled person and someone without a career stay out; the coordi adds them by hand', async () => {
    const ancestor = await person({ status: 'ancestor' })
    const disabled = await person({ status: 'disabled' })
    const noCareer = await person({ career: null })
    const c = await newCarrera()
    expect(await recordOf(ancestor, c.termId)).toBeUndefined()
    expect(await recordOf(disabled, c.termId)).toBeUndefined()
    expect(await recordOf(noCareer, c.termId)).toBeUndefined()
  })

  it('a career the theme has no culture for does not enter either (it is not guessed)', async () => {
    const lawyer = await person({ career: 'Derecho' })
    const c = await newCarrera()
    expect(await recordOf(lawyer, c.termId)).toBeUndefined()
  })

  it('the inductions of the other carreras are not touched, and each new carrera brings its own record', async () => {
    const id = await person()
    const a = await newCarrera()
    const b = await newCarrera()
    expect(await recordOf(id, a.termId)).toBeDefined()
    expect(await recordOf(id, b.termId)).toBeDefined()
    expect((await db.sql<{ n: number }>(`select count(*)::int as n from public.passport_records where passport_id = $1`, [id]))[0].n).toBe(2)
  })

  it('leaving a carrera is not undone by itself, and the coordi can sum the ones still missing (nobody is put in twice)', async () => {
    const early = await person()
    const c = await newCarrera()
    await db.sql(`delete from public.passport_records where passport_id = $1 and term_id = $2`, [early, c.termId])
    const late = await person({ prior: 1 }) // registered after the carrera was created
    const [{ added }] = await db.asUser(c.admin).sql<{ added: number }>(`select public.enroll_active_inductors($1) as added`, [c.eventId])
    expect(added).toBeGreaterThanOrEqual(2)
    expect(await recordOf(late, c.termId)).toBeDefined()
    expect(await count(late)).toBe(2)
    const [again] = await db.asUser(c.admin).sql<{ added: number }>(`select public.enroll_active_inductors($1) as added`, [c.eventId])
    expect(again.added).toBe(0)
  })

  it('only the coordi creates carreras and sums people into one', async () => {
    const id = await person()
    const c = await newCarrera()
    await expect(db.asUser(id).sql(`select public.enroll_active_inductors($1)`, [c.eventId])).rejects.toThrow(/Solo el coordi/)
    await expect(db.asUser(id).sql(`select public.create_event()`)).rejects.toThrow(/Solo el coordi/)
  })

  it('a person who is in a carrera keeps the record the coordi set (role, committee) when the sum runs again', async () => {
    const id = await person()
    const c = await newCarrera()
    await db.asUser(c.admin).sql(`update public.passport_records set role = 'base' where passport_id = $1 and term_id = $2`, [id, c.termId])
    await db.asUser(c.admin).sql(`select public.enroll_active_inductors($1)`, [c.eventId])
    expect((await recordOf(id, c.termId)).role).toBe('base')
  })
})

describe('the culture of a career in a theme (0045)', () => {
  const culture = async (theme: string, career: string) => (await db.sql<{ c: string | null }>(`select public.career_culture($1, $2) as c`, [theme, career]))[0].c
  it('finds the group of the career by its name, whole or contained, without accents', async () => {
    expect(await culture('mitologias', 'Ingeniería de Sistemas')).toBe('nordica')
    expect(await culture('mitologias', 'Sistemas')).toBe('nordica')
    expect(await culture('mitologias', 'INGENIERIA MECATRÓNICA')).toBe('griega')
    expect(await culture('mitologias', 'Ingeniería Industrial')).toBe('mexicana')
  })
  it('says nothing when there is no rule, or when the career is empty', async () => {
    expect(await culture('mitologias', 'Derecho')).toBeNull()
    expect(await culture('mitologias', '')).toBeNull()
    expect(await culture('no-existe', 'Sistemas')).toBeNull()
  })
})
