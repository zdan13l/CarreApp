import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, migrationFiles, type TestDb } from './harness'
import { seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb() // throws if any migration fails
})
afterAll(async () => {
  await db.close()
})

const TABLES = [
  'events', 'profiles', 'teams', 'bases', 'base_questions', 'base_staff', 'team_runners', 'matches',
  'match_scores', 'score_audit', 'base_details', 'team_locations', 'alerts', 'base_travel_times',
  'push_subscriptions', 'push_config',
]

describe('migrations', () => {
  it('are numbered 0001..N without gaps or duplicates', () => {
    const numbers = migrationFiles().map((f) => Number(f.slice(0, 4)))
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })

  it('create every table the app relies on', async () => {
    const rows = await db.sql<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    const names = rows.map((r) => r.table_name)
    for (const t of TABLES) expect(names, `missing table ${t}`).toContain(t)
  })

  it('create the standings view and the functions the client calls', async () => {
    const view = await db.sql(`select 1 from information_schema.views where table_schema = 'public' and table_name = 'team_standings'`)
    expect(view).toHaveLength(1)
    const fns = (await db.sql<{ proname: string }>(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).map((r) => r.proname)
    for (const f of ['confirm_arrival', 'event_problems', 'save_push_subscription', 'remove_push_subscription', 'is_admin', 'check_delays', 'push_send']) {
      expect(fns, `missing function ${f}`).toContain(f)
    }
  })

  it('enable row level security on EVERY public table (a new table without RLS is a data leak)', async () => {
    const open = await db.sql<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(open.map((r) => r.relname)).toEqual([])
  })

  it('keep the public (anon) key away from all data and writes', async () => {
    await seedCarrera(db) // there is data to leak
    const anon = db.asAnon()
    for (const t of TABLES) {
      // Either the privilege is revoked (permission denied) or RLS hides every row.
      const rows = await anon.sql(`select * from public.${t}`).catch((e: Error) => {
        expect(e.message).toMatch(/permission denied/)
        return []
      })
      expect(rows, `anon can read ${t}`).toHaveLength(0)
    }
    expect(await anon.sql(`select * from public.team_standings`)).toHaveLength(0)
    await expect(anon.sql(`insert into public.events (name) values ('hack')`)).rejects.toThrow(/row-level security/)
    await expect(anon.sql(`insert into public.profiles (id, username, full_name, role) values (gen_random_uuid(), 'hacker', 'x', 'admin')`)).rejects.toThrow(/row-level security/)
  })

  it('do not let app users call the internal notification functions', async () => {
    const [row] = await db.sql<{ push: boolean; delays: boolean; anonDelays: boolean }>(
      `select has_function_privilege('authenticated', 'public.push_send(jsonb)', 'execute') as push,
              has_function_privilege('authenticated', 'public.check_delays()', 'execute') as delays,
              has_function_privilege('anon', 'public.check_delays()', 'execute') as "anonDelays"`,
    )
    expect(row).toEqual({ push: false, delays: false, anonDelays: false })
  })
})
