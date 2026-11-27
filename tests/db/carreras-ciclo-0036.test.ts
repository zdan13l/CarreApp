// Migration 0036: codes 2710, 2730, 2810…, the permanent test Carrera, Finalizada (archived) and no deletion.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, getAdmin, insertMatch, newTemplate, seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

const create = async () => {
  const admin = await getAdmin(db)
  const [r] = await db.asUser(admin).sql<{ create_event: string }>(`select public.create_event($1)`, [await newTemplate(db)])
  const [e] = await db.sql<{ code: string; name: string; term_id: string | null }>(`select code, name, term_id from public.events where id = $1`, [r.create_event])
  return { id: r.create_event, ...e }
}

describe('the test Carrera and the codes (0036)', () => {
  it('there is exactly one test Carrera and the real 2710 exists, empty', async () => {
    expect((await db.sql(`select 1 from public.events where is_test`)).length).toBe(1)
    const [e] = await db.sql<{ id: string; phase: string }>(`select id, phase from public.events where code = '2710'`)
    expect(e.phase).toBe('disabled')
    expect((await db.sql(`select 1 from public.teams where event_id = $1`, [e.id])).length).toBe(0)
  })

  it('new Carreras follow 2710 -> 2730 -> 2810 -> 2830 -> 2910, nobody types the code', async () => {
    expect((await create()).code).toBe('2730')
    expect((await create()).code).toBe('2810')
    expect((await create()).code).toBe('2830')
    const c = await create()
    expect(c.code).toBe('2910')
    expect(c.name).toBe('Carrera 2910')
    expect(c.term_id).not.toBeNull() // its own semester
  })

  it('a new Carrera inherits nothing: no groups, bases, matches or users', async () => {
    const old = await seedCarrera(db, { teams: 2, bases: 1 })
    await insertMatch(db, old, 1, old.bases[0].id, old.teams[0].id, old.teams[1].id)
    const c = await create()
    for (const t of ['teams', 'bases', 'matches']) expect((await db.sql(`select 1 from public.${t} where event_id = $1`, [c.id])).length).toBe(0)
  })

  it('only the coordinator creates Carreras', async () => {
    const u = await addUser(db, 'inductor.crea', 'base')
    await expect(db.asUser(u).sql(`select public.create_event()`)).rejects.toThrow(/Solo el coordi/)
  })

  it('the test Carrera cannot be deleted or stop being the test one; nobody deletes a Carrera from the app', async () => {
    const admin = await getAdmin(db)
    const [t] = await db.sql<{ id: string }>(`select id from public.events where is_test`)
    await expect(db.sql(`delete from public.events where id = $1`, [t.id])).rejects.toThrow(/permanente/)
    await expect(db.asUser(admin).sql(`update public.events set is_test = false where id = $1`, [t.id])).rejects.toThrow(/siempre debe existir/)
    await expect(db.sql(`insert into public.events (name, is_test) values ('Otra de prueba', true)`)).rejects.toThrow()
    const c = await create()
    await expect(db.asUser(admin).sql(`delete from public.events where id = $1`, [c.id])).rejects.toThrow(/no se eliminan/)
  })
})

describe('Finalizada keeps everything (0036)', () => {
  async function played() {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    const admin = await getAdmin(db)
    const act = (a: string) => db.asUser(admin).sql(`select public.event_action($1, $2)`, [c.eventId, a])
    await db.sql(`update public.events set is_active = false where is_active and id <> $1`, [c.eventId])
    await act('enable')
    await act('start')
    const as = db.asUser(c.bases[0].staff)
    await as.sql(`select public.confirm_arrival($1)`, [m.id])
    for (const item of ['barra', 'pregunta', 'minijuego']) await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, c.teams[0].id])
    return { c, m, act, admin }
  }

  it('finish -> archive: out of the active ones, but scores, arrivals and the match stay; the history gets its copy', async () => {
    const { c, m, act } = await played()
    await expect(act('archive')).rejects.toThrow(/terminada/)
    await act('finish')
    await act('archive')
    const [e] = await db.sql<{ phase: string; is_active: boolean }>(`select phase, is_active from public.events where id = $1`, [c.eventId])
    expect(e).toEqual({ phase: 'archived', is_active: false })
    expect((await db.sql(`select 1 from public.match_scores where match_id = $1`, [m.id])).length).toBe(3)
    const [row] = await db.sql<{ arrived_at: string | null; status: string }>(`select arrived_at, status from public.matches where id = $1`, [m.id])
    expect(row.arrived_at).not.toBeNull()
    expect(row.status).toBe('finished')
    expect((await db.sql(`select 1 from public.event_archives where event_id = $1`, [c.eventId])).length).toBeGreaterThan(0)
  })

  it('an archived Carrera cannot be disabled; it can be reopened (back to Terminada)', async () => {
    const { c, act } = await played()
    await act('finish')
    await act('archive')
    await expect(act('disable')).rejects.toThrow(/historial/)
    await act('reopen')
    expect((await db.sql<{ phase: string }>(`select phase from public.events where id = $1`, [c.eventId]))[0].phase).toBe('finished')
  })

  it('disabling still goes back to configuration and resets the progress (nothing is lost from the history copy)', async () => {
    const { c, m, act } = await played()
    await act('finish')
    await act('disable')
    expect((await db.sql(`select 1 from public.match_scores where match_id = $1`, [m.id])).length).toBe(0)
    expect((await db.sql<{ phase: string }>(`select phase from public.events where id = $1`, [c.eventId]))[0].phase).toBe('disabled')
    await act('enable') // and it can be enabled again
  })

  it('a normal Carrera can only be restarted once it is finished', async () => {
    const { act } = await played()
    await expect(act('reset')).rejects.toThrow(/termina la carrera/)
    await act('finish')
    await act('reset')
  })
})
