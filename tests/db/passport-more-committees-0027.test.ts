// Migration 0027: a person can belong to more than one committee, and coordinate some of them.
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
  const [t] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ($1, 'mitologias') returning id`, [`2027-${++n}`])
  return t.id
}
async function addPassport(): Promise<string> {
  const username = `p.${++n}`
  const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${username}@carreapp.test`])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $3)`, [u.id, username, `Persona ${username}`])
  return u.id
}
async function addRecord(extra: string, leads = '{}'): Promise<{ id: string; passport: string }> {
  const passport = await addPassport()
  const [r] = await db.sql<{ id: string }>(
    `insert into public.passport_records (passport_id, term_id, role, career, culture, committee, committee_lead, extra_committees, extra_leads) values ($1, $2, 'runner', 'Sistemas', 'nordica', 'caos', true, $3::text[], $4::text[]) returning id`,
    [passport, await newTerm(), extra, leads],
  )
  return { id: r.id, passport }
}

describe('more committees per person (0027)', () => {
  it('keeps the main committee and the extra ones, and which of them it coordinates', async () => {
    const r = await addRecord('{meraki,bienvenida}', '{meraki}')
    const [row] = await db.sql<{ committee: string; extra_committees: string[]; extra_leads: string[] }>(`select committee, extra_committees, extra_leads from public.passport_records where id = $1`, [r.id])
    expect(row).toEqual({ committee: 'caos', extra_committees: ['meraki', 'bienvenida'], extra_leads: ['meraki'] })
  })

  it('a person has none by default', async () => {
    const passport = await addPassport()
    const [r] = await db.sql<{ id: string }>(`insert into public.passport_records (passport_id, term_id, role, career, culture) values ($1, $2, 'runner', 'Sistemas', 'nordica') returning id`, [passport, await newTerm()])
    const [row] = await db.sql<{ extra_committees: string[]; extra_leads: string[] }>(`select extra_committees, extra_leads from public.passport_records where id = $1`, [r.id])
    expect(row).toEqual({ extra_committees: [], extra_leads: [] })
  })

  it('cannot coordinate a committee it does not belong to, and a committee key has a safe format', async () => {
    await expect(addRecord('{meraki}', '{bienvenida}')).rejects.toThrow()
    await expect(addRecord('{Meraki!}')).rejects.toThrow()
  })

  it('only the coordinator of the app edits them: the person cannot give themselves a committee', async () => {
    const r = await addRecord('{}')
    expect(await db.asUser(r.passport).affected(`update public.passport_records set extra_committees = '{meraki}' where id = $1`, [r.id])).toBe(0)
    const admin = await getAdmin(db)
    expect(await db.asUser(admin).affected(`update public.passport_records set extra_committees = '{meraki}', extra_leads = '{meraki}' where id = $1`, [r.id])).toBe(1)
  })
})
