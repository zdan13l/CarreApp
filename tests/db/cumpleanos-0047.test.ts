// Migration 0047: the birthday of a person (the code and the age of the passport come from it).
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
const person = async (birth?: string) => {
  const name = `cumple.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name, birth_date) values ($1, $2, $2, $3)`, [id, name, birth ?? null])
  return id
}
const birthOf = async (id: string) => (await db.sql<{ b: string | null }>(`select to_char(birth_date, 'YYYY-MM-DD') as b from public.passports where id = $1`, [id]))[0].b

describe('the birthday of the passport (0047)', () => {
  it('it is empty by default and keeps the date it is given', async () => {
    expect(await birthOf(await person())).toBeNull()
    expect(await birthOf(await person('2005-03-15'))).toBe('2005-03-15')
  })

  it('the coordi can set and clear it', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await db.asUser(admin).sql(`update public.passports set birth_date = '2004-11-02' where id = $1`, [id])
    expect(await birthOf(id)).toBe('2004-11-02')
    await db.asUser(admin).sql(`update public.passports set birth_date = null where id = $1`, [id])
    expect(await birthOf(id)).toBeNull()
  })

  it('impossible dates are refused', async () => {
    const id = await person()
    await expect(db.sql(`update public.passports set birth_date = '1850-01-01' where id = $1`, [id])).rejects.toThrow(/check|birth_date/i)
    await expect(db.sql(`update public.passports set birth_date = '2200-01-01' where id = $1`, [id])).rejects.toThrow(/check|birth_date/i)
  })

  it('everyone reads their own and nobody changes theirs', async () => {
    const id = await person('2003-07-09')
    const mine = await db.asUser(id).sql<{ birth_date: string | null }>(`select to_char(birth_date, 'YYYY-MM-DD') as birth_date from public.passports where id = $1`, [id])
    expect(mine[0].birth_date).toBe('2003-07-09')
    await db.asUser(id).sql(`update public.passports set birth_date = '2000-01-01' where id = $1`, [id])
    expect(await birthOf(id)).toBe('2003-07-09') // no policy lets a person edit their row: the update touches nothing
  })

  it('somebody else does not read it', async () => {
    const id = await person('2003-07-09')
    const other = await person('2001-01-01')
    expect(await db.asUser(other).sql(`select birth_date from public.passports where id = $1`, [id])).toHaveLength(0)
  })
})
