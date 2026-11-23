// Migration 0034: a Carrera cannot have more bases than seals, and the coordinator can add seals to make room.
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

const addBase = (eventId: string, n: number) => db.sql(`insert into public.bases (event_id, name, sort_order) values ($1, $2, $3)`, [eventId, `Base extra ${n}`, n])

describe('seals and the number of bases (0034)', () => {
  it('the 16th base is refused with an explanation, and a new seal makes room', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    for (let i = 2; i <= 15; i++) await addBase(c.eventId, i)
    await expect(addBase(c.eventId, 16)).rejects.toThrow(/Hay 15 sellos.*corregir los sellos/)
    const admin = await getAdmin(db)
    const [seal] = await db.asUser(admin).sql<{ id: string }>(`insert into public.custom_seals (name, culture, color, path, event_id) values ('Colibrí', 'otra', '#118877', 'seals/x.png', $1) returning id`, [c.eventId])
    await addBase(c.eventId, 16)
    await expect(addBase(c.eventId, 17)).rejects.toThrow(/Hay 16 sellos/)
    // the seal that makes room cannot be removed while it is needed
    await expect(db.asUser(admin).sql(`delete from public.custom_seals where id = $1`, [seal.id])).rejects.toThrow(/No puedes borrar este sello/)
  })

  it('only the coordinator uploads seals; everybody signed in reads them', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await expect(db.asUser(c.bases[0].staff).sql(`insert into public.custom_seals (name, color, path) values ('x', '#112233', 'seals/y.png')`)).rejects.toThrow()
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`insert into public.custom_seals (name, color, path) values ('Sol', '#112233', 'seals/z.png')`)
    expect((await db.asUser(c.bases[0].staff).sql(`select 1 from public.custom_seals`)).length).toBeGreaterThan(0)
  })

  it('a colour must be a hex value', async () => {
    const admin = await getAdmin(db)
    await expect(db.asUser(admin).sql(`insert into public.custom_seals (name, color, path) values ('Mal', 'rojo', 'seals/w.png')`)).rejects.toThrow()
  })
})
