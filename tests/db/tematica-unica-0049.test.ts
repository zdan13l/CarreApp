// Migration 0049: a theme belongs to ONE carrera; each carrera has exactly one theme of its own.
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

const create = async (theme: string) => {
  const admin = await getAdmin(db)
  const [r] = await db.asUser(admin).sql<{ create_event: string }>(`select public.create_event($1)`, [theme])
  const [e] = await db.sql<{ id: string; name: string; term_id: string }>(`select id, name, term_id from public.events where id = $1`, [r.create_event])
  return e
}

describe('a theme is used once (0049)', () => {
  it('a free theme creates a carrera and is then taken by it', async () => {
    const theme = await newTemplate(db)
    const admin = await getAdmin(db)
    expect((await db.asUser(admin).sql<{ u: string | null }>(`select public.theme_template_user($1) as u`, [theme]))[0].u).toBeNull()
    const e = await create(theme)
    expect((await db.asUser(admin).sql<{ u: string }>(`select public.theme_template_user($1) as u`, [theme]))[0].u).toBe(e.name)
  })

  it('a theme that a carrera already used cannot create another one, and nothing is left half made', async () => {
    const theme = await newTemplate(db)
    const first = await create(theme)
    const before = (await db.sql<{ n: number }>(`select count(*)::int as n from public.events`))[0].n
    await expect(create(theme)).rejects.toThrow(new RegExp(`ya la usa la ${first.name}`))
    expect((await db.sql<{ n: number }>(`select count(*)::int as n from public.events`))[0].n).toBe(before)
  })

  it('the permanent test carrera has its own copy of a theme but takes nothing', async () => {
    const theme = await newTemplate(db)
    const admin = await getAdmin(db)
    const [term] = await db.sql<{ id: string }>(`insert into public.terms (name, theme) values ('PRUEBA', $1) returning id`, [theme])
    await db.sql(`select public.copy_theme_for_term($1, $2)`, [term.id, theme])
    await db.sql(`update public.events set term_id = $1 where is_test`, [term.id])
    expect((await db.sql(`select 1 from public.themes where term_id = $1 and template_of = $2`, [term.id, theme])).length).toBe(1)
    expect((await db.asUser(admin).sql<{ u: string | null }>(`select public.theme_template_user($1) as u`, [theme]))[0].u).toBeNull()
    await create(theme) // still free for a real carrera
  })

  it('a carrera has ONE theme of its own: a second copy for the same semester is refused', async () => {
    const e = await create(await newTemplate(db))
    await expect(db.sql(`insert into public.themes (key, name, term_id, template_of) values ('otra-copia', 'Otra', $1, 'mitologias')`, [e.term_id])).rejects.toThrow(/unique|duplicate|themes_one_per_term/i)
  })

  it('a deleted template does not free the theme of a carrera that already took it (it keeps its own copy)', async () => {
    const theme = await newTemplate(db)
    const e = await create(theme)
    await db.sql(`delete from public.themes where key = $1`, [theme])
    expect((await db.sql(`select 1 from public.themes where term_id = $1`, [e.term_id])).length).toBe(1)
  })
})
