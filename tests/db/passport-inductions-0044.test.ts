// Migration 0044: how many inductions a person has taken part in, the profile disabled in one induction, and the second career.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, getAdmin, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

let n = 0
const person = async () => {
  const name = `inductor.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $2)`, [id, name])
  return id
}
const term = async (name: string) => (await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ($1, 'mitologias') returning id`, [name]))[0].id
const join = async (passport: string, termId: string, extra = '') =>
  (await db.sql<{ id: string }>(`insert into public.passport_records (passport_id, term_id, role, career, culture${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, $2, 'runner', 'Ingeniería Civil', 'general'${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [passport, termId]))[0].id
const count = async (id: string) => (await db.sql<{ inductions: number }>(`select inductions from public.passport_inductions where passport_id = $1`, [id]))[0]?.inductions ?? 0

describe('how many inductions a person has (0044)', () => {
  it('grows by one with every induction they join, and a person in none has no row', async () => {
    const id = await person()
    expect(await count(id)).toBe(0)
    await join(id, await term('9101'))
    expect(await count(id)).toBe(1)
    await join(id, await term('9102'))
    expect(await count(id)).toBe(2)
  })

  it('an induction where the profile is disabled is not counted, and counts again if they are enabled back', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await join(id, await term('9103'))
    const second = await join(id, await term('9104'))
    expect(await count(id)).toBe(2)
    await db.asUser(admin).sql(`update public.passport_records set disabled = true where id = $1`, [second])
    expect(await count(id)).toBe(1)
    await db.asUser(admin).sql(`update public.passport_records set disabled = false where id = $1`, [second])
    expect(await count(id)).toBe(2)
  })

  it('each person sees only their own count; the coordi sees everybody', async () => {
    const admin = await getAdmin(db)
    const a = await person()
    const b = await person()
    await join(a, await term('9105'))
    await join(b, await term('9106'))
    expect((await db.asUser(a).sql<{ passport_id: string }>(`select passport_id from public.passport_inductions`)).map((r) => r.passport_id)).toEqual([a])
    const all = (await db.asUser(admin).sql<{ passport_id: string }>(`select passport_id from public.passport_inductions`)).map((r) => r.passport_id)
    expect(all).toEqual(expect.arrayContaining([a, b]))
  })

  it('a profile disabled in an induction is let go of its group and its base, and cannot be put back in one', async () => {
    const admin = await getAdmin(db)
    const termId = await term('9108')
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await db.sql(`update public.events set term_id = $2 where id = $1`, [c.eventId, termId])
    const runner = await person()
    const rec = (await db.sql<{ id: string }>(`insert into public.passport_records (passport_id, term_id, role, career, culture, team_id) values ($1, $2, 'runner', 'Ingeniería Civil', 'general', $3) returning id`, [runner, termId, c.teams[0].id]))[0].id
    await db.asUser(admin).sql(`update public.passport_records set disabled = true where id = $1`, [rec])
    const [row] = await db.sql<{ team_id: string | null; disabled: boolean }>(`select team_id, disabled from public.passport_records where id = $1`, [rec])
    expect(row).toEqual({ team_id: null, disabled: true })
    await db.asUser(admin).sql(`update public.passport_records set team_id = $2 where id = $1`, [rec, c.teams[1].id])
    expect((await db.sql<{ team_id: string | null }>(`select team_id from public.passport_records where id = $1`, [rec]))[0].team_id).toBeNull()
  })

  it('only the coordi disables a profile in an induction', async () => {
    const a = await person()
    const rec = await join(a, await term('9107'))
    expect(await db.asUser(a).affected(`update public.passport_records set disabled = true where id = $1`, [rec])).toBe(0)
    expect(await count(a)).toBe(1)
  })
})

describe('the second career (0044)', () => {
  it('the coordi sets it, it is a real name, and nobody edits their own', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await db.asUser(admin).sql(`update public.passports set second_career = 'Derecho' where id = $1`, [id])
    expect((await db.sql<{ second_career: string }>(`select second_career from public.passports where id = $1`, [id]))[0].second_career).toBe('Derecho')
    await expect(db.asUser(admin).sql(`update public.passports set second_career = 'x' where id = $1`, [id])).rejects.toThrow()
    expect(await db.asUser(id).affected(`update public.passports set second_career = 'Medicina' where id = $1`, [id])).toBe(0)
  })
})
