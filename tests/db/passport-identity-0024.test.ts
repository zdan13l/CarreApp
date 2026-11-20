// Migration 0024: committee, generation, entry, nickname and symbol of the personal passport.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin } from './seed'

let db: TestDb
let n = 0
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

async function newTerm(): Promise<string> {
  const [t] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ($1, 'mitologias') returning id`, [`2026-${++n}`])
  return t.id
}
async function addPassport(username = `p.${++n}`): Promise<string> {
  const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${username}@carreapp.test`])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $3)`, [u.id, username, `Persona ${username}`])
  return u.id
}
async function addRecord(passport: string, term: string, committee: string | null = null, lead = false): Promise<string> {
  const [r] = await db.sql<{ id: string }>(
    `insert into public.passport_records (passport_id, term_id, role, career, culture, committee, committee_lead) values ($1, $2, 'runner', 'Sistemas', 'nordica', $3, $4) returning id`,
    [passport, term, committee, lead],
  )
  return r.id
}

describe('committees', () => {
  it('a record can have a committee, and its coordinator', async () => {
    const t = await newTerm()
    const r = await addRecord(await addPassport(), t, 'clausura', true)
    const [row] = await db.sql<{ committee: string; committee_lead: boolean }>(`select committee, committee_lead from public.passport_records where id = $1`, [r])
    expect(row).toEqual({ committee: 'clausura', committee_lead: true })
  })

  it('a committee can have several coordinators (0026: Caos has two) and members without limit', async () => {
    const t = await newTerm()
    await addRecord(await addPassport(), t, 'caos', true)
    await addRecord(await addPassport(), t, 'caos', true)
    await addRecord(await addPassport(), t, 'caos', false)
    await addRecord(await addPassport(), t, 'meraki', true) // another committee
    await addRecord(await addPassport(), await newTerm(), 'caos', true) // another semester
  })

  it('only someone with a committee can be its coordinator', async () => {
    await expect(addRecord(await addPassport(), await newTerm(), null, true)).rejects.toThrow()
  })

  it('the name of a committee has a safe format', async () => {
    await expect(addRecord(await addPassport(), await newTerm(), 'Clausura!')).rejects.toThrow()
  })

  it('the committee is the coordinator\'s to set: the person cannot take it nor become its coordinator', async () => {
    const t = await newTerm()
    const a = await addPassport()
    await addRecord(a, t, 'caos')
    expect(await db.asUser(a).affected(`update public.passport_records set committee_lead = true where passport_id = $1`, [a])).toBe(0)
    expect(await db.asUser(a).affected(`update public.passport_records set committee = 'meraki' where passport_id = $1`, [a])).toBe(0)
    const admin = await getAdmin(db)
    expect(await db.asUser(admin).affected(`update public.passport_records set committee = 'meraki', committee_lead = true where passport_id = $1`, [a])).toBe(1)
  })
})

describe('what each side edits in the passport', () => {
  it('the coordinator sets the nickname and the symbol (0025: they are set once and the person does not change them)', async () => {
    const a = await addPassport()
    const admin = await getAdmin(db)
    expect(await db.asUser(a).affected(`update public.passports set nickname = 'Gatito' where id = $1`, [a])).toBe(0)
    expect(await db.asUser(admin).affected(`update public.passports set nickname = 'Gatito', symbol = 'cat', symbol_label = 'Gato blanco' where id = $1`, [a])).toBe(1)
    const [row] = await db.sql<{ nickname: string; symbol: string; symbol_label: string }>(`select nickname, symbol, symbol_label from public.passports where id = $1`, [a])
    expect(row).toEqual({ nickname: 'Gatito', symbol: 'cat', symbol_label: 'Gato blanco' })
  })

  it('the person changes nothing of their passport: name, @, photo, generation, entry, nickname, symbol are the coordinator\'s', async () => {
    const a = await addPassport()
    for (const set of [`full_name = 'Otro'`, `username = 'otro.nombre'`, `photo_path = 'users/x.jpg'`, `generation = 'Gen 5'`, `joined_term = '2020-1'`, `symbol = 'cat'`]) {
      expect(await db.asUser(a).affected(`update public.passports set ${set} where id = $1`, [a]), set).toBe(0)
    }
  })

  it('the person cannot edit someone else\'s passport', async () => {
    const a = await addPassport()
    const b = await addPassport()
    expect(await db.asUser(a).affected(`update public.passports set nickname = 'Intruso' where id = $1`, [b])).toBe(0)
  })

  it('the coordinator sets generation and entry, photo and name', async () => {
    const admin = await getAdmin(db)
    const a = await addPassport()
    expect(await db.asUser(admin).affected(`update public.passports set generation = 'Generación 7', joined_term = '2024-2', photo_path = 'users/x.jpg', full_name = 'Nombre Nuevo' where id = $1`, [a])).toBe(1)
  })

  it('the server (service role, no signed-in user) can change the @', async () => {
    const a = await addPassport()
    await db.sql(`update public.passports set username = $2 where id = $1`, [a, `nuevo.${++n}`])
  })

  it('the length of the nickname, symbol, generation and entry is limited', async () => {
    const a = await addPassport()
    await expect(db.sql(`update public.passports set nickname = $2 where id = $1`, [a, 'x'.repeat(25)])).rejects.toThrow()
    await expect(db.sql(`update public.passports set nickname = '   ' where id = $1`, [a])).rejects.toThrow()
    await expect(db.sql(`update public.passports set symbol = 'Gato Blanco!' where id = $1`, [a])).rejects.toThrow()
    await expect(db.sql(`update public.passports set generation = $2 where id = $1`, [a, 'g'.repeat(31)])).rejects.toThrow()
    await expect(db.sql(`update public.passports set joined_term = $2 where id = $1`, [a, 'j'.repeat(21)])).rejects.toThrow()
  })

  it('the same login cannot reach another table through the new policy (it only updates its own passports row)', async () => {
    const a = await addPassport()
    expect(await db.asUser(a).affected(`update public.terms set theme = 'otra'`)).toBe(0)
    expect(await db.asUser(a).affected(`update public.passport_stamps set event_name = 'x'`)).toBe(0)
  })
})
