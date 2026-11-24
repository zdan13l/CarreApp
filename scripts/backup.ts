// A backup of everything the project keeps: every table as JSON, the logins (id and username only: passwords cannot be exported, they are
// reset from the panel) and every photo (the big and the small copies). It only READS from Supabase, with the service-role key.
//   npx tsx --env-file=.env.local scripts/backup.ts                    # into ../carreapp-respaldos/AAAA-MM-DD-HHMM
//   npx tsx --env-file=.env.local scripts/backup.ts --out "D:/respaldos"
// The folder has personal data (names, usernames, photos): it is created OUTSIDE the repository on purpose; keep it private and copy it
// somewhere else too (a USB drive, a private cloud folder). The free Supabase plan keeps no backups of its own.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Every table of the project, in an order that makes a restore easy (the ones others point to come first).
export const TABLES = [
  'terms', 'term_committees', 'events', 'event_archives', 'profiles', 'passports', 'teams', 'bases', 'base_details', 'base_questions', 'base_staff', 'base_travel_times',
  'team_runners', 'matches', 'match_scores', 'score_audit', 'round_rotations', 'rotation_acks', 'alerts', 'team_locations', 'passport_records', 'passport_stamps', 'custom_seals', 'committees', 'badges', 'event_committees', 'event_seals', 'generations', 'career_groups', 'careers', 'themes', 'theme_cultures', 'group_cultures',
] as const

const args = process.argv.slice(2)
const opt = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined)
const PAGE = 1000

async function dumpTable(db: SupabaseClient, table: string): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

async function listFiles(db: SupabaseClient, folder: string): Promise<string[]> {
  const out: string[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage.from('photos').list(folder, { limit: PAGE, offset })
    if (error) throw new Error(`fotos/${folder}: ${error.message}`)
    out.push(...(data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`))
    if (!data || data.length < PAGE) return out
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
  const root = resolve(opt('out') ?? join('..', 'carreapp-respaldos'), stamp)
  mkdirSync(root, { recursive: true })
  const manifest: Record<string, number> = {}

  for (const table of TABLES) {
    const rows = await dumpTable(db, table)
    writeFileSync(join(root, `${table}.json`), JSON.stringify(rows, null, 1))
    manifest[table] = rows.length
    console.log(`  ${table}: ${rows.length} filas`)
  }

  const users: { id: string; email: string | undefined; created_at: string }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`usuarios: ${error.message}`)
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })))
    if (data.users.length < 1000) break
  }
  writeFileSync(join(root, 'auth_users.json'), JSON.stringify(users, null, 1))
  manifest.auth_users = users.length
  console.log(`  usuarios (login): ${users.length}`)

  let photos = 0
  for (const folder of ['teams', 'bases', 'users']) {
    for (const path of await listFiles(db, folder)) {
      const { data, error } = await db.storage.from('photos').download(path)
      if (error || !data) throw new Error(`foto ${path}: ${error?.message}`)
      const file = join(root, 'photos', path)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, Buffer.from(await data.arrayBuffer()))
      photos++
    }
  }
  manifest.photos = photos
  console.log(`  fotos: ${photos}`)

  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), project: url, counts: manifest }, null, 2))
  console.log(`\nRespaldo listo en ${root}\nCópialo también a otro lugar (USB o una carpeta privada en la nube).`)
}

// runs only when called as a script (the test imports TABLES)
if (/scripts[\\/]backup\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => {
    console.error(`\nERROR: ${e.message}`)
    process.exit(1)
  })
}
