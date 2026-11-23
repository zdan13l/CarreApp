// Migration 0038: seals belong to one inducción; base seals; the test carrera has arbitrary seals.
import fs from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

describe('seals per inducción (0038)', () => {
  it('the capacity of a carrera counts only the seals uploaded FOR it', async () => {
    const admin = await getAdmin(db)
    const a = await seedCarrera(db, { teams: 2, bases: 1 })
    const b = await seedCarrera(db, { teams: 2, bases: 1 })
    for (let i = 2; i <= 15; i++) await db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, $2, $3)`, [a.eventId, `Extra ${i}`, i])
    await expect(db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, 'Una más', 16)`, [a.eventId])).rejects.toThrow(/Hay 15 sellos en esta carrera/)
    // a seal uploaded for ANOTHER carrera does not make room here
    await db.asUser(admin).sql(`insert into public.custom_seals (name, color, path, event_id) values ('De la otra', '#112233', 'seals/o.png', $1)`, [b.eventId])
    await expect(db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, 'Una más', 16)`, [a.eventId])).rejects.toThrow(/Hay 15 sellos/)
    const [s] = await db.asUser(admin).sql<{ id: string }>(`insert into public.custom_seals (name, color, path, event_id) values ('De esta', '#112244', 'seals/e.png', $1) returning id`, [a.eventId])
    await db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, 'Una más', 16)`, [a.eventId])
    await expect(db.asUser(admin).sql(`delete from public.custom_seals where id = $1`, [s.id])).rejects.toThrow(/No puedes borrar este sello/)
  })

  it('the seals that already existed are the 2710 ones', async () => {
    expect((await db.sql(`select 1 from public.custom_seals where event_id is null`)).length).toBe(0)
  })

  it('a base can have its own seal in a carrera, unique among the bases', async () => {
    const admin = await getAdmin(db)
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    const put = (ref: string, color: string) => db.asUser(admin).sql(`insert into public.event_seals (event_id, kind, ref, shape, color) values ($1, 'base', $2, 'shield', $3)`, [c.eventId, ref, color])
    await put(c.bases[0].id, '#aabbcc')
    await expect(put(c.bases[1].id, '#aabbcc')).rejects.toThrow(/ya lo usa otro elemento/)
    await put(c.bases[1].id, '#aabbcd')
  })

  it('the seed of the migration leaves arbitrary, unique seals in the test carrera (run again over a test carrera that has data)', async () => {
    const [t] = await db.sql<{ id: string }>(`select id from public.events where is_test`)
    for (let i = 1; i <= 18; i++) await db.sql(`insert into public.teams (event_id, name, sort_order) values ($1, $2, $3)`, [t.id, `Grupo prueba ${i}`, i])
    for (let i = 1; i <= 15; i++) await db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, $2, $3)`, [t.id, `Base prueba ${i}`, i])
    const sql = fs.readFileSync('supabase/migrations/0038_sellos_por_induccion.sql', 'utf8')
    await db.pg.exec(sql.slice(sql.indexOf('create or replace function public._seed_event_seal')))
    const by = async (kind: string) => (await db.sql(`select 1 from public.event_seals where event_id = $1 and kind = $2`, [t.id, kind])).length
    expect(await by('team')).toBe(18)
    expect(await by('base')).toBe(15)
    // (the theme, subthemes and committees get theirs too when the test carrera has them: here it was created without a semester)
    await db.pg.exec(sql.slice(sql.indexOf('create or replace function public._seed_event_seal'))) // and running it twice changes nothing
    expect(await by('team')).toBe(18)
  })
})
