// In-memory Postgres (PGlite) that runs EVERY migration of supabase/migrations/, unmodified, on top
// of small stand-ins for what Supabase provides (auth.users / auth.uid(), the anon and
// authenticated roles, storage tables, the realtime publication and pg_net's http_post).
//
// Two ways to run SQL, like in production:
//   db.sql(...)             superuser: bypasses RLS (SQL Editor, service-role key, triggers' owner)
//   db.asUser(id).sql(...)  role "authenticated" with auth.uid() = id: RLS applies
//   db.asAnon().sql(...)    role "anon": the public key, must see nothing
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const MIGRATIONS_DIR = path.resolve(here, '../../supabase/migrations')

export function migrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort()
}

const STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.uid', true), '')::uuid
  $$;

  create role authenticated;
  create role anon;
  create publication supabase_realtime;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;

  -- pg_net: record the HTTP calls instead of making them.
  create schema net;
  create schema test_support;
  create table test_support.http_calls (id serial primary key, url text, headers jsonb, body jsonb);
  create function net.http_post(
    url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}',
    timeout_milliseconds int default 5000
  ) returns bigint language sql as $$
    insert into test_support.http_calls (url, headers, body) values (url, headers, body) returning id::bigint
  $$;

  -- Supabase grants every new table to anon / authenticated; RLS is what protects the data.
  grant usage on schema public, auth, storage to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;
  alter default privileges in schema public grant all on sequences to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant all on storage.objects, storage.buckets to authenticated, anon;
`

export interface Row {
  [column: string]: unknown
}

export interface Runner {
  sql<T extends object = Row>(query: string, params?: unknown[]): Promise<T[]>
  /** Number of rows touched by an INSERT/UPDATE/DELETE (0 = RLS filtered everything out). */
  affected(query: string, params?: unknown[]): Promise<number>
}

export interface TestDb extends Runner {
  pg: PGlite
  asUser(userId: string): Runner
  asAnon(): Runner
  /** The HTTP calls the database tried to make (push notifications). */
  httpCalls(): Promise<{ url: string; headers: Row; body: { notifications: PushItem[] } }[]>
  clearHttpCalls(): Promise<void>
  close(): Promise<void>
}

export interface PushItem {
  user_ids: string[]
  title: string
  body: string
  tag: string
}

function runner(pg: PGlite, role: 'authenticated' | 'anon' | null, uid: string | null): Runner {
  const exec = async (query: string, params?: unknown[]) => {
    await pg.exec('reset role')
    if (role) {
      await pg.query(`select set_config('app.uid', $1, false)`, [uid ?? ''])
      await pg.exec(`set role ${role}`)
    }
    try {
      return await pg.query(query, params)
    } finally {
      await pg.exec('reset role')
    }
  }
  return {
    sql: async <T extends object = Row>(query: string, params?: unknown[]) => (await exec(query, params)).rows as T[],
    affected: async (query, params) => (await exec(query, params)).affectedRows ?? 0,
  }
}

export async function createDb(): Promise<TestDb> {
  const pg = new PGlite()
  await pg.exec(STUBS)
  for (const file of migrationFiles()) {
    const sql = fs
      .readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      .replace(/^\s*create extension[^;]*;/gim, '') // pg_net / pg_cron do not exist here
    try {
      await pg.exec(sql)
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`)
    }
  }
  // Self-check of the suite: TEST_MUTATION_SQL breaks a rule on purpose (e.g. drops a trigger) and the
  // tests that cover that rule must fail. See docs/wiki/Pruebas.md ("¿Las pruebas detectan fallos?").
  if (process.env.TEST_MUTATION_SQL) await pg.exec(process.env.TEST_MUTATION_SQL)
  const superuser = runner(pg, null, null)
  return {
    pg,
    ...superuser,
    asUser: (id) => runner(pg, 'authenticated', id),
    asAnon: () => runner(pg, 'anon', null),
    httpCalls: async () =>
      (await superuser.sql(`select url, headers, body from test_support.http_calls order by id`)) as never,
    clearHttpCalls: async () => {
      await superuser.sql(`delete from test_support.http_calls`)
    },
    close: () => pg.close(),
  }
}
