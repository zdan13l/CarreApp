// Migration 0039: the generations are a global catalog with their seals; a person's generation is chosen from it.
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

const person = async (name: string) => {
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $2)`, [id, name])
  return id
}

describe('the generations catalog (0039)', () => {
  it('starts with the five generations of the app, with the seals they always had', async () => {
    const rows = await db.sql<{ key: string; kind: string | null; shape: string | null }>(`select key, kind, shape from public.generations order by sort_order`)
    expect(rows.map((r) => r.key)).toEqual(['champinones', 'peluches', 'barbies', 'minichips', 'textiles'])
    expect(rows.every((r) => r.shape === null)).toBe(true) // nobody has edited them yet
  })

  it('only the coordi changes it, and the seal is edited with its shape AND its colour', async () => {
    const admin = await getAdmin(db)
    const id = await person('quien.sea')
    await db.asUser(id).sql(`update public.generations set shape = 'shield', color = '#112233' where key = 'barbies'`)
    expect((await db.sql(`select 1 from public.generations where key = 'barbies' and shape is not null`)).length).toBe(0) // RLS: nothing changed
    await db.asUser(admin).sql(`update public.generations set shape = 'shield', color = '#112233' where key = 'barbies'`)
    expect((await db.sql<{ shape: string }>(`select shape from public.generations where key = 'barbies'`))[0].shape).toBe('shield')
    await expect(db.asUser(admin).sql(`update public.generations set shape = 'oval' where key = 'peluches'`)).rejects.toThrow() // a shape without a colour
    await expect(db.asUser(admin).sql(`update public.generations set shape = 'oval', color = 'rojo' where key = 'peluches'`)).rejects.toThrow()
    await db.asUser(admin).sql(`update public.generations set shape = null, color = null, image_path = null where key = 'barbies'`) // back to the seal of always
  })

  it('a new generation takes its key from its name; the name never changes', async () => {
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`insert into public.generations (key, name, term, sort_order) values ('mariposas', 'Mariposas', '2810', 6)`)
    await expect(db.asUser(admin).sql(`insert into public.generations (key, name) values ('otra', 'Raras')`)).rejects.toThrow()
    await expect(db.asUser(admin).sql(`update public.generations set name = 'Mariposones' where key = 'mariposas'`)).rejects.toThrow(/nombre de una generación/)
    await db.asUser(admin).sql(`update public.generations set term = '2830' where key = 'mariposas'`) // the semester can be corrected
  })
})

describe('the generation of a person is chosen from the catalog', () => {
  it('accepts catalog generations (even several), saves their exact names, and rejects what is not in the catalog', async () => {
    const id = await person('persona.uno')
    await db.sql(`update public.passports set generation = 'barbies' where id = $1`, [id])
    expect((await db.sql<{ generation: string }>(`select generation from public.passports where id = $1`, [id]))[0].generation).toBe('Barbies')
    await db.sql(`update public.passports set generation = 'champiñones / MINICHIPS' where id = $1`, [id])
    expect((await db.sql<{ generation: string }>(`select generation from public.passports where id = $1`, [id]))[0].generation).toBe('Champiñones / Minichips')
    await expect(db.sql(`update public.passports set generation = 'Pendiente' where id = $1`, [id])).rejects.toThrow(/no existe/)
    await expect(db.sql(`update public.passports set generation = 'Barbies / Inventada' where id = $1`, [id])).rejects.toThrow(/no existe/)
    await db.sql(`update public.passports set generation = '  ' where id = $1`, [id]) // empty clears it
    expect((await db.sql<{ generation: string | null }>(`select generation from public.passports where id = $1`, [id]))[0].generation).toBeNull()
  })

  it('a generation with people cannot be deleted (and an empty one can)', async () => {
    const admin = await getAdmin(db)
    const id = await person('persona.dos')
    await db.sql(`update public.passports set generation = 'Textiles' where id = $1`, [id])
    await expect(db.asUser(admin).sql(`delete from public.generations where key = 'textiles'`)).rejects.toThrow(/hay personas/)
    await db.asUser(admin).sql(`insert into public.generations (key, name) values ('efimeros', 'Efímeros')`)
    await db.asUser(admin).sql(`delete from public.generations where key = 'efimeros'`)
  })

  it('what was already saved before the catalog is not re-checked when something else changes', async () => {
    const id = await person('persona.tres')
    await db.sql(`alter table public.passports disable trigger passports_generation_known`)
    await db.sql(`update public.passports set generation = 'Texto viejo' where id = $1`, [id])
    await db.sql(`alter table public.passports enable trigger passports_generation_known`)
    await db.sql(`update public.passports set nickname = 'Apodo' where id = $1`, [id])
    expect((await db.sql<{ generation: string }>(`select generation from public.passports where id = $1`, [id]))[0].generation).toBe('Texto viejo')
  })
})
