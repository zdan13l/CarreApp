// Migration 0025: the words of the coordinators and of each committee, the photo of the base, nothing of the passport edited by the person.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin, seedCarrera } from './seed'

let db: TestDb
let n = 0
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

async function newTerm(): Promise<string> {
  const [t] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ($1, 'mitologias') returning id`, [`2710-${++n}`])
  return t.id
}
async function addPassport(): Promise<string> {
  const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`p${++n}@carreapp.test`])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, 'Persona')`, [u.id, `p.${n}`])
  return u.id
}

describe('the words of the coordinators (terms.welcome)', () => {
  it('the coordinator writes them and every login reads them', async () => {
    const admin = await getAdmin(db)
    const t = await newTerm()
    const a = await addPassport()
    expect(await db.asUser(admin).affected(`update public.terms set welcome = 'Bienvenidos a la inducción' where id = $1`, [t])).toBe(1)
    const [row] = await db.asUser(a).sql<{ welcome: string }>(`select welcome from public.terms where id = $1`, [t])
    expect(row.welcome).toBe('Bienvenidos a la inducción')
    expect(await db.asUser(a).affected(`update public.terms set welcome = 'x' where id = $1`, [t])).toBe(0)
  })
  it('is limited in length and cannot be blank', async () => {
    const t = await newTerm()
    await expect(db.sql(`update public.terms set welcome = $2 where id = $1`, [t, 'w'.repeat(701)])).rejects.toThrow()
    await expect(db.sql(`update public.terms set welcome = '   ' where id = $1`, [t])).rejects.toThrow()
  })
})

describe('the words of each committee (term_committees)', () => {
  it('one per committee and induction; the coordinator writes, everybody logged in reads', async () => {
    const admin = await getAdmin(db)
    const t = await newTerm()
    const a = await addPassport()
    expect(await db.asUser(admin).affected(`insert into public.term_committees (term_id, committee, message) values ($1, 'caos', 'Somos fuego')`, [t])).toBe(1)
    await expect(db.sql(`insert into public.term_committees (term_id, committee, message) values ($1, 'caos', 'otra')`, [t])).rejects.toThrow()
    expect((await db.asUser(a).sql(`select * from public.term_committees where term_id = $1`, [t])).length).toBe(1)
    await expect(db.asUser(a).sql(`insert into public.term_committees (term_id, committee, message) values ($1, 'meraki', 'x')`, [t])).rejects.toThrow()
    expect(await db.asUser(a).affected(`delete from public.term_committees`)).toBe(0)
    expect((await db.asAnon().sql(`select * from public.term_committees`).catch(() => [])).length).toBe(0)
  })
  it('go away with their induction and have a safe name and length', async () => {
    const t = await newTerm()
    await db.sql(`insert into public.term_committees (term_id, committee, message) values ($1, 'clausura', 'Hola')`, [t])
    await expect(db.sql(`insert into public.term_committees (term_id, committee, message) values ($1, 'Mal Nombre', 'x')`, [t])).rejects.toThrow()
    await expect(db.sql(`insert into public.term_committees (term_id, committee, message) values ($1, 'meraki', $2)`, [t, 'm'.repeat(701)])).rejects.toThrow()
    await db.sql(`delete from public.terms where id = $1`, [t])
    expect((await db.sql(`select * from public.term_committees where term_id = $1`, [t])).length).toBe(0)
  })
})

describe('nothing of the passport is edited by the person any more', () => {
  it('there is no policy that lets a login update its passport', async () => {
    const policies = await db.sql<{ policyname: string }>(`select policyname from pg_policies where tablename = 'passports'`)
    expect(policies.map((p) => p.policyname)).not.toContain('passports_self_update')
    const a = await addPassport()
    expect(await db.asUser(a).affected(`update public.passports set nickname = 'Yo', symbol = 'cat' where id = $1`, [a])).toBe(0)
  })
  it('the coordinator and the server still can', async () => {
    const admin = await getAdmin(db)
    const a = await addPassport()
    expect(await db.asUser(admin).affected(`update public.passports set nickname = 'Gatito', symbol = 'cat', symbol_label = 'Gato blanco' where id = $1`, [a])).toBe(1)
    await db.sql(`update public.passports set username = $2 where id = $1`, [a, `nuevo.${++n}`])
  })
})

describe('my_passport_context gives the photo of the base', () => {
  it('the photo of the base of the person who staffs it, and nothing about other bases', async () => {
    const t = await newTerm()
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    await db.sql(`update public.events set term_id = $2 where id = $1`, [c.eventId, t])
    const a = await addPassport()
    await db.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture, base_id) values ($1, $2, 'base', 'Civil', 'egipcia', $3)`, [a, t, c.bases[0].id])
    const rows = await db.asUser(a).sql<{ base_name: string; base_photo_path: string | null }>(`select * from public.my_passport_context()`)
    expect(rows).toHaveLength(1)
    expect(rows[0].base_name).toBe('Base 1')
    expect(rows[0].base_photo_path).toMatch(/^bases\//)
  })
})
