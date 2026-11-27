// Migration 0040: a seal belongs to ONE carrera and can only be put on an element of THAT carrera; it goes away with its element.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { getAdmin, newTemplate } from './seed'

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
  const [e] = await db.sql<{ id: string; term_id: string }>(`select id, term_id from public.events where id = $1`, [r.create_event])
  return e
}
const put = async (event: string | null, kind: string, ref: string, shape = 'circle', color = '#123456') => {
  const admin = await getAdmin(db)
  return db.asUser(admin).sql(`insert into public.event_seals (event_id, kind, ref, shape, color) values ($1, $2, $3, $4, $5)`, [event, kind, ref, shape, color])
}
const addTeam = async (event: string, name: string) => (await db.sql<{ id: string }>(`insert into public.teams (event_id, name) values ($1, $2) returning id`, [event, name]))[0].id
const addBase = async (event: string, name: string) => (await db.sql<{ id: string }>(`insert into public.bases (event_id, name) values ($1, $2) returning id`, [event, name]))[0].id

describe('a seal can only go on an element of its own carrera (0040)', () => {
  it('committee: only one that takes part in THAT carrera', async () => {
    const a = await create()
    const b = await create()
    await put(a.id, 'committee', 'caos') // every new carrera gets the active committees
    await db.sql(`delete from public.event_committees where event_id = $1 and committee_key = 'meraki'`, [b.id])
    await expect(put(b.id, 'committee', 'meraki')).rejects.toThrow(/solo puede ser de un comité que participa en esa carrera/)
    await expect(put(a.id, 'committee', 'no-existe')).rejects.toThrow(/comité/)
    await put(b.id, 'committee', 'caos') // the same committee in another carrera is another seal
  })

  it('theme and subtheme: the ones of that carrera own theme, not the template or another carrera', async () => {
    const a = await create()
    const b = await create()
    const [ta] = await db.sql<{ key: string }>(`select key from public.themes where term_id = $1`, [a.term_id])
    const [tb] = await db.sql<{ key: string }>(`select key from public.themes where term_id = $1`, [b.term_id])
    await put(a.id, 'theme', ta.key)
    await expect(put(a.id, 'theme', tb.key)).rejects.toThrow(/la temática de esa carrera/) // another carrera's theme
    await expect(put(a.id, 'theme', 'mitologias')).rejects.toThrow(/la temática de esa carrera/) // the template
    await put(a.id, 'subtheme', 'griega')
    await expect(put(a.id, 'subtheme', 'inventada')).rejects.toThrow(/subtemática/)
  })

  it('base: only the ones of that carrera', async () => {
    const a = await create()
    const b = await create()
    const ba = await addBase(a.id, 'Base A')
    const bb = await addBase(b.id, 'Base B')
    await put(a.id, 'base', ba)
    await expect(put(a.id, 'base', bb)).rejects.toThrow(/una base de esa carrera/)
    await expect(put(a.id, 'base', 'no-es-una-base')).rejects.toThrow()
  })

  it('groups carry their insignia, not a seal: there is no seal kind for them (0041)', async () => {
    const a = await create()
    const ta = await addTeam(a.id, 'Grupo A')
    await expect(put(a.id, 'team', ta)).rejects.toThrow()
  })

  it('a seal always has a carrera (inducción)', async () => {
    await expect(put(null, 'committee', 'caos')).rejects.toThrow()
  })

  it('the coordi seal is only for the coordi of that carrera', async () => {
    const e = await create()
    await expect(put(e.id, 'coordinator', '00000000-0000-0000-0000-000000000001')).rejects.toThrow(/el coordi de esa carrera/)
  })

  it('only the coordi creates seals', async () => {
    const e = await create()
    const [u] = await db.sql<{ id: string }>(`insert into auth.users (email) values ('x@x.test') returning id`)
    await expect(db.asUser(u.id).sql(`insert into public.event_seals (event_id, kind, ref, shape, color) values ($1, 'committee', 'caos', 'circle', '#123456')`, [e.id])).rejects.toThrow()
  })
})

describe('a seal goes with its element', () => {
  it('removing a base or a committee from the carrera removes its seal, and nobody else loses theirs', async () => {
    const e = await create()
    const b1 = await addBase(e.id, 'Base Uno')
    const b2 = await addBase(e.id, 'Base Dos')
    await put(e.id, 'base', b1, 'hexagon', '#111111')
    await put(e.id, 'base', b2, 'hexagon', '#222222')
    await put(e.id, 'committee', 'caos')
    await db.sql(`delete from public.bases where id = $1`, [b1])
    await db.sql(`delete from public.event_committees where event_id = $1 and committee_key = 'caos'`, [e.id])
    const left = await db.sql<{ kind: string; ref: string }>(`select kind, ref from public.event_seals where event_id = $1 and kind in ('base', 'committee')`, [e.id])
    expect(left).toEqual([{ kind: 'base', ref: b2 }])
  })
})

describe('the seals of generations are global (no inducción)', () => {
  it('a generation keeps its seal in its own table, and event_seals has no generation kind', async () => {
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`update public.generations set shape = 'oval', color = '#abcdef' where key = 'peluches'`)
    expect((await db.sql<{ shape: string }>(`select shape from public.generations where key = 'peluches'`))[0].shape).toBe('oval')
    await expect(put((await create()).id, 'generation', 'peluches')).rejects.toThrow()
  })
})
