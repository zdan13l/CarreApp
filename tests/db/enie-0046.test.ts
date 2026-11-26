// Migration 0046: the ñ in the @ of a user and of a passport.
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

const passport = async (username: string) => {
  const id = await addUser(db, `base.${Math.random().toString(36).slice(2, 8)}`, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, 'Persona')`, [id, username])
  return id
}

describe('the ñ in the @ (0046)', () => {
  it('a passport can have an @ with ñ', async () => {
    const id = await passport('daniela.muñoz')
    expect((await db.sql<{ username: string }>(`select username from public.passports where id = $1`, [id]))[0].username).toBe('daniela.muñoz')
  })

  it('the coordi can change an @ to one with ñ, and it is still unique', async () => {
    const admin = await getAdmin(db)
    const a = await passport('luis.nino')
    await passport('luis.niño')
    await expect(db.asUser(admin).sql(`update public.passports set username = 'luis.niño' where id = $1`, [a])).rejects.toThrow()
    await db.asUser(admin).sql(`update public.passports set username = 'luis.peña' where id = $1`, [a])
    expect((await db.sql<{ username: string }>(`select username from public.passports where id = $1`, [a]))[0].username).toBe('luis.peña')
  })

  it('a login (profile) can have an @ with ñ too', async () => {
    const id = await addUser(db, 'ñandu', 'runner')
    expect((await db.sql<{ username: string }>(`select username from public.profiles where id = $1`, [id]))[0].username).toBe('ñandu')
  })

  it('what is not a letter of the alphabet, a number, a dot, a dash or an underscore is still refused', async () => {
    for (const bad of ['mu+oz', 'mu~noz', 'mu noz', 'MUÑOZ', 'ab', 'á.b.c', 'x'.repeat(31)]) {
      const id = await addUser(db, `libre.${Math.random().toString(36).slice(2, 8)}`, 'runner')
      await db.sql(`delete from public.profiles where id = $1`, [id])
      await expect(db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, 'Persona')`, [id, bad]), bad).rejects.toThrow(/check|username/i)
    }
  })
})
