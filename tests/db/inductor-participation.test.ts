// Use case of the panel: ONE person (global), taking part in several carreras with their own role and committee, independently.
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

describe('a person is global, their participation is per carrera', () => {
  it('the same person has a different role and committee in two carreras, and leaving one changes nothing in the other', async () => {
    const admin = await getAdmin(db)
    const asAdmin = db.asUser(admin)
    const id = await addUser(db, 'persona.global', 'runner')
    await db.sql(`delete from public.profiles where id = $1`, [id])
    await db.sql(`insert into public.passports (id, username, full_name) values ($1, 'persona.global', 'Persona Global')`, [id])
    const a = (await asAdmin.sql<{ create_event: string }>(`select public.create_event()`))[0].create_event
    const b = (await asAdmin.sql<{ create_event: string }>(`select public.create_event()`))[0].create_event
    const term = async (e: string) => (await db.sql<{ term_id: string }>(`select term_id from public.events where id = $1`, [e]))[0].term_id
    await asAdmin.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture, committee) values ($1, $2, 'runner', 'Sistemas', 'nordica', 'caos')`, [id, await term(a)])
    await asAdmin.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture, committee) values ($1, $2, 'base', 'Sistemas', 'nordica', 'meraki')`, [id, await term(b)])
    const rows = await db.sql<{ role: string; committee: string }>(`select role, committee from public.passport_records where passport_id = $1 order by role`, [id])
    expect(rows).toEqual([{ role: 'base', committee: 'meraki' }, { role: 'runner', committee: 'caos' }])
    // taking them out of the first carrera leaves the person and the other participation untouched
    await asAdmin.sql(`delete from public.passport_records where passport_id = $1 and term_id = $2`, [id, await term(a)])
    expect((await db.sql(`select 1 from public.passports where id = $1`, [id])).length).toBe(1)
    expect((await db.sql(`select 1 from public.passport_records where passport_id = $1`, [id])).length).toBe(1)
    // one record per person and carrera: they cannot be added twice
    await expect(asAdmin.sql(`insert into public.passport_records (passport_id, term_id, role, career, culture) values ($1, $2, 'runner', 'Sistemas', 'nordica')`, [id, await term(b)])).rejects.toThrow()
  })
})
