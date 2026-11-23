// Migration 0037: each carrera has its own theme and subthemes, its committees, its coordi and its seals.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

const create = async (theme = 'mitologias') => {
  const admin = await getAdmin(db)
  const [r] = await db.asUser(admin).sql<{ create_event: string }>(`select public.create_event($1)`, [theme])
  const [e] = await db.sql<{ id: string; term_id: string; code: string }>(`select id, term_id, code from public.events where id = $1`, [r.create_event])
  return e
}

describe('its own theme (0037)', () => {
  it('a new carrera gets a COPY of the template: own theme, own subthemes, own group mapping', async () => {
    const e = await create()
    const [th] = await db.sql<{ key: string; template_of: string }>(`select key, template_of from public.themes where term_id = $1`, [e.term_id])
    expect(th.template_of).toBe('mitologias')
    expect((await db.sql(`select 1 from public.theme_cultures where theme_key = $1`, [th.key])).length).toBe(5)
    expect((await db.sql(`select 1 from public.group_cultures where theme_key = $1`, [th.key])).length).toBe(5)
    const [t] = await db.sql<{ theme: string }>(`select theme from public.terms where id = $1`, [e.term_id])
    expect(t.theme).toBe(th.key)
  })

  it('editing the subthemes of one carrera does not touch the template or another carrera', async () => {
    const a = await create()
    const b = await create()
    const ka = (await db.sql<{ key: string }>(`select key from public.themes where term_id = $1`, [a.term_id]))[0].key
    const kb = (await db.sql<{ key: string }>(`select key from public.themes where term_id = $1`, [b.term_id]))[0].key
    expect(ka).not.toBe(kb)
    await db.sql(`update public.theme_cultures set name = 'Solo esta' where theme_key = $1 and key = 'griega'`, [ka])
    expect((await db.sql<{ name: string }>(`select name from public.theme_cultures where theme_key = $1 and key = 'griega'`, [kb]))[0].name).toBe('Griega')
    expect((await db.sql<{ name: string }>(`select name from public.theme_cultures where theme_key = 'mitologias' and key = 'griega'`))[0].name).toBe('Griega')
  })

  it('an unknown template is refused', async () => {
    await expect(create('no-existe')).rejects.toThrow(/no existe/)
  })

  it('the existing semesters got their own copy too', async () => {
    expect((await db.sql(`select 1 from public.terms t join public.themes th on th.key = t.theme where th.term_id is null and not th.is_global`)).length).toBe(0)
  })
})

describe('committees and the coordi of a carrera (0037)', () => {
  it('a new carrera is assigned the active committees; the assignment is its own', async () => {
    const e = await create()
    expect((await db.sql(`select 1 from public.event_committees where event_id = $1`, [e.id])).length).toBe(6)
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`delete from public.event_committees where event_id = $1 and committee_key = 'caos'`, [e.id])
    expect((await db.sql(`select 1 from public.event_committees where event_id = $1`, [e.id])).length).toBe(5)
    const other = await create()
    expect((await db.sql(`select 1 from public.event_committees where event_id = $1`, [other.id])).length).toBe(6)
  })
})

describe('the seals of a carrera (0037)', () => {
  const seal = (admin: string, e: string, kind: string, ref: string, shape: string, color: string, image: string | null = null) =>
    db.asUser(admin).sql(`insert into public.event_seals (event_id, kind, ref, shape, color, image_path) values ($1, $2, $3, $4, $5, $6)`, [e, kind, ref, shape, color, image])

  it('one seal per element, and two elements of the same kind cannot share a design', async () => {
    const admin = await getAdmin(db)
    const e = await create()
    await seal(admin, e.id, 'committee', 'meraki', 'hexagon', '#112233')
    await expect(seal(admin, e.id, 'committee', 'meraki', 'circle', '#445566')).rejects.toThrow() // the same element twice
    await expect(seal(admin, e.id, 'committee', 'caos', 'hexagon', '#112233')).rejects.toThrow(/ya lo usa otro elemento/)
    await seal(admin, e.id, 'committee', 'caos', 'hexagon', '#112234') // another colour is another design
    await seal(admin, e.id, 'subtheme', 'griega', 'hexagon', '#112233') // another kind: no clash
  })

  it('the same design is fine in ANOTHER carrera', async () => {
    const admin = await getAdmin(db)
    const a = await create()
    const b = await create()
    await seal(admin, a.id, 'team', 'g1', 'shield', '#abcdef')
    await seal(admin, b.id, 'team', 'g1', 'shield', '#abcdef')
  })

  it('setting the coordi gives the golden seal, changing it moves it, and nobody inherits it', async () => {
    const admin = await getAdmin(db)
    const a = await create()
    const b = await create()
    const p1 = '00000000-0000-4000-8000-000000000001'
    const p2 = '00000000-0000-4000-8000-000000000002'
    for (const id of [p1, p2]) {
      await db.sql(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@carreapp.test`])
      await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $3)`, [id, `coordi.${id.slice(-1)}`, `Coordi ${id.slice(-1)}`])
    }
    await db.asUser(admin).sql(`update public.events set coordinator_id = $2 where id = $1`, [a.id, p1])
    const gold = () => db.sql<{ ref: string }>(`select ref from public.event_seals where event_id = $1 and kind = 'coordinator'`, [a.id])
    expect((await gold()).map((r) => r.ref)).toEqual([p1])
    await db.asUser(admin).sql(`update public.events set coordinator_id = $2 where id = $1`, [a.id, p2])
    expect((await gold()).map((r) => r.ref)).toEqual([p2])
    expect((await db.sql(`select 1 from public.event_seals where event_id = $1 and kind = 'coordinator'`, [b.id])).length).toBe(0)
  })

  it('only the coordinator edits seals, and a colour must be hex', async () => {
    const admin = await getAdmin(db)
    const e = await create()
    await expect(seal(admin, e.id, 'team', 'x', 'circle', 'rojo')).rejects.toThrow()
    await expect(seal(admin, e.id, 'team', 'x', 'cuadrado', '#112233')).rejects.toThrow()
  })
})
