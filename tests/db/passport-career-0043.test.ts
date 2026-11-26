// Migration 0043: the career of each person, and the entry that comes from the generation.
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
const person = async () => {
  const name = `inductor.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $2)`, [id, name])
  return id
}
const read = async (id: string) => (await db.sql<{ career: string | null; joined_term: string | null; generation: string | null }>(`select career, joined_term, generation from public.passports where id = $1`, [id]))[0]

describe('the career of a person (0043)', () => {
  it('the coordi sets it and changes it; it is one career for the whole life in the induction', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    expect((await read(id)).career).toBeNull()
    await db.asUser(admin).sql(`update public.passports set career = 'Ingeniería de Sistemas' where id = $1`, [id])
    expect((await read(id)).career).toBe('Ingeniería de Sistemas')
    await db.asUser(admin).sql(`update public.passports set career = 'Ingeniería Civil' where id = $1`, [id])
    expect((await read(id)).career).toBe('Ingeniería Civil')
  })

  it('nobody changes the career of their own passport, nor of anybody else', async () => {
    const a = await person()
    const b = await person()
    expect(await db.asUser(a).affected(`update public.passports set career = 'Civil' where id = $1`, [a])).toBe(0)
    expect(await db.asUser(a).affected(`update public.passports set career = 'Civil' where id = $1`, [b])).toBe(0)
  })

  it('a career is a real name (2 to 80 letters)', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await expect(db.asUser(admin).sql(`update public.passports set career = 'x' where id = $1`, [id])).rejects.toThrow()
    await expect(db.asUser(admin).sql(`update public.passports set career = $2 where id = $1`, [id, 'x'.repeat(81)])).rejects.toThrow()
  })
})

describe('the entry comes from the generation (0043)', () => {
  it('choosing a generation fills the entry with its semester, and a second generation does not change it', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await db.asUser(admin).sql(`update public.passports set generation = 'Barbies' where id = $1`, [id])
    expect((await read(id)).joined_term).toBe('2630')
    await db.asUser(admin).sql(`update public.passports set generation = 'Barbies / Minichips' where id = $1`, [id])
    expect((await read(id)).joined_term).toBe('2630')
    await db.asUser(admin).sql(`update public.passports set generation = 'Peluches' where id = $1`, [id])
    expect((await read(id)).joined_term).toBe('2610')
  })

  it('works when the person is created with the generation, and a generation without semester keeps the entry as it was', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await db.asUser(admin).sql(`update public.passports set joined_term = '2024-2' where id = $1`, [id])
    await db.asUser(admin).sql(`update public.passports set generation = 'Textiles' where id = $1`, [id])
    expect((await read(id)).joined_term).toBe('2024-2')
    const name = `nuevo.${++n}`
    const nid = await addUser(db, name, 'runner')
    await db.sql(`delete from public.profiles where id = $1`, [nid])
    await db.sql(`insert into public.passports (id, username, full_name, generation) values ($1, $2, $2, 'Champiñones')`, [nid, name])
    expect((await read(nid)).joined_term).toBe('2510')
  })

  it('the career of people that already existed comes from their latest participation', async () => {
    // the harness applies every migration to an empty database, so the backfill is checked by running its statement again over a person made like the old ones
    const id = await person()
    const [{ id: term }] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ('2099-1', 'mitologias') returning id`)
    await db.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture) values ($1, $2, 'runner', 'Mecatrónica', 'griega')`, [id, term])
    await db.sql(`update public.passports p set career = r.career from (select distinct on (pr.passport_id) pr.passport_id, pr.career from public.passport_records pr join public.terms t on t.id = pr.term_id order by pr.passport_id, t.created_at desc, pr.career) r where r.passport_id = p.id and p.career is null`)
    expect((await read(id)).career).toBe('Mecatrónica')
  })
})
