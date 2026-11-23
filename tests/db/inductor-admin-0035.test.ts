// Migration 0035: ancestors, committees, groups of careers and themes managed from the panel.
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

async function person(username: string) {
  const id = await addUser(db, username, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id]) // a personal login has no profile
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $3)`, [id, username, `Persona ${username}`])
  return id
}

describe('ancestors (0035)', () => {
  it('an ancestor still sees their passport until their time runs out, then nothing; the coordinator always sees it', async () => {
    const id = await person('ancestro.uno')
    const seen = async () => (await db.asUser(id).sql(`select 1 from public.passports where id = $1`, [id])).length
    expect(await seen()).toBe(1)
    await db.asUser(await getAdmin(db)).sql(`update public.passports set status = 'ancestor', ancestor_at = now(), disable_at = now() + interval '6 months' where id = $1`, [id])
    expect(await seen()).toBe(1)
    await db.asUser(await getAdmin(db)).sql(`update public.passports set disable_at = now() - interval '1 day' where id = $1`, [id])
    expect(await seen()).toBe(0)
    const admin = await getAdmin(db)
    expect((await db.asUser(admin).sql(`select 1 from public.passports where id = $1`, [id])).length).toBe(1)
    await db.asUser(await getAdmin(db)).sql(`update public.passports set status = 'active', disable_at = null where id = $1`, [id])
    expect(await seen()).toBe(1)
  })

  it('a disabled profile sees neither its records nor its stamps', async () => {
    const id = await person('deshabilitado.uno')
    await db.asUser(await getAdmin(db)).sql(`update public.passports set status = 'disabled' where id = $1`, [id])
    expect((await db.asUser(id).sql(`select 1 from public.passport_records where passport_id = $1`, [id])).length).toBe(0)
  })
})

describe('the catalog (0035)', () => {
  it('has the six committees, the five groups of careers and the mythologies with a culture per group', async () => {
    expect((await db.sql(`select 1 from public.committees where active`)).length).toBe(6)
    expect((await db.sql(`select 1 from public.career_groups`)).length).toBe(5)
    const rows = await db.sql<{ g: string; c: string }>(`select g.name g, gc.culture_key c from public.group_cultures gc join public.career_groups g on g.id = gc.group_id where gc.theme_key = 'mitologias' order by g.name`)
    expect(rows).toEqual([{ g: 'Biomec', c: 'china' }, { g: 'Civil', c: 'egipcia' }, { g: 'Industrial', c: 'mexicana' }, { g: 'Sistemas', c: 'nordica' }, { g: 'Tronicas', c: 'griega' }])
    expect((await db.sql(`select 1 from public.careers where name in ('Electrónica', 'Mecatrónica', 'Redes')`)).length).toBe(3)
  })

  it('only the coordinator edits it; everybody signed in reads it', async () => {
    const id = await person('lector.uno')
    expect((await db.asUser(id).sql(`select 1 from public.committees`)).length).toBeGreaterThan(0)
    await expect(db.asUser(id).sql(`insert into public.committees (key, name) values ('nuevo', 'Nuevo')`)).rejects.toThrow()
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`insert into public.committees (key, name, tagline, ink) values ('nuevo', 'Nuevo', 'Algo', 2)`)
    await db.asUser(admin).sql(`update public.committees set name = 'Renombrado' where key = 'nuevo'`)
    await db.asUser(admin).sql(`update public.committees set active = false where key = 'nuevo'`)
  })

  it('there is always one global theme: it cannot be deleted or turned off, and there cannot be two', async () => {
    await expect(db.sql(`delete from public.themes where key = 'global'`)).rejects.toThrow(/global/)
    await expect(db.sql(`update public.themes set is_global = false where key = 'global'`)).rejects.toThrow(/global/)
    await expect(db.sql(`insert into public.themes (key, name, is_global) values ('otra', 'Otra', true)`)).rejects.toThrow()
    await db.sql(`insert into public.themes (key, name) values ('casas', 'Casas')`)
  })

  it('a group takes a culture that exists in that theme', async () => {
    const [g] = await db.sql<{ id: string }>(`select id from public.career_groups where name = 'Civil'`)
    await expect(db.sql(`insert into public.group_cultures (theme_key, group_id, culture_key) values ('global', $1, 'nordica')`, [g.id])).rejects.toThrow()
  })

  it('a group with careers cannot be deleted', async () => {
    const [g] = await db.sql<{ id: string }>(`select id from public.career_groups where name = 'Sistemas'`)
    await expect(db.sql(`delete from public.career_groups where id = $1`, [g.id])).rejects.toThrow()
  })
})
