// Migration 0048: renaming a career changes it everywhere a person keeps it.
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
const career = async (name: string) => {
  const [g] = await db.sql<{ id: string }>(`select id from public.career_groups order by sort_order limit 1`)
  const [c] = await db.sql<{ id: string }>(`insert into public.careers (name, group_id) values ($1, $2) returning id`, [name, g.id])
  return c.id
}
const person = async (careerName: string, second?: string) => {
  const name = `renombre.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name, career, second_career) values ($1, $2, $2, $3, $4)`, [id, name, careerName, second ?? null])
  return id
}
const row = async (id: string) => (await db.sql<{ career: string; second_career: string | null }>(`select career, second_career from public.passports where id = $1`, [id]))[0]

describe('renaming a career (0048)', () => {
  it('the name changes in the catalog, in the people who have it as their career or as the other one, and in their records', async () => {
    const admin = await getAdmin(db)
    const id = await career('Ingeniería Antigua')
    const a = await person('Ingeniería Antigua')
    const b = await person('Ingeniería Civil', 'Ingeniería Antigua')
    const other = await person('Ingeniería Civil')
    const [term] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ('9910', 'mitologias') returning id`)
    await db.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture) values ($1, $2, 'runner', 'Ingeniería Antigua', 'griega')`, [a, term.id])

    await db.asUser(admin).sql(`select public.rename_career($1, $2)`, [id, '  Ingeniería   Nueva '])

    expect((await db.sql<{ name: string }>(`select name from public.careers where id = $1`, [id]))[0].name).toBe('Ingeniería Nueva')
    expect((await row(a)).career).toBe('Ingeniería Nueva')
    expect(await row(b)).toEqual({ career: 'Ingeniería Civil', second_career: 'Ingeniería Nueva' })
    expect((await row(other)).career).toBe('Ingeniería Civil') // nobody else is touched
    expect((await db.sql<{ career: string }>(`select career from public.passport_records where passport_id = $1`, [a]))[0].career).toBe('Ingeniería Nueva')
  })

  it('a name that already exists, or one that is too short, is refused and nothing changes', async () => {
    const admin = await getAdmin(db)
    const id = await career('Ingeniería Uno')
    await career('Ingeniería Dos')
    const p = await person('Ingeniería Uno')
    await expect(db.asUser(admin).sql(`select public.rename_career($1, $2)`, [id, 'Ingeniería Dos'])).rejects.toThrow(/unique|duplicate/i)
    await expect(db.asUser(admin).sql(`select public.rename_career($1, $2)`, [id, 'X'])).rejects.toThrow(/2 a 60/)
    expect((await row(p)).career).toBe('Ingeniería Uno')
  })

  it('only the coordi renames a career', async () => {
    const id = await career('Ingeniería Tres')
    const user = await addUser(db, 'corredor.renombre', 'runner')
    await expect(db.asUser(user).sql(`select public.rename_career($1, $2)`, [id, 'Ingeniería Cuatro'])).rejects.toThrow(/coordi/i)
  })
})
