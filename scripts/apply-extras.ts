// Applies, on the database that is already running, the committees a person has besides their main one and a few identity fixes (a generation),
// without touching passwords or anything else. The people come from a LOCAL file (never committed: it has real usernames), one entry per @:
//   { "ana.perez": { "extra": ["meraki", "bienvenida"], "leads": ["meraki"] }, "luis.mora": { "generation": "Textiles" } }
//   npx tsx --env-file=.env.local scripts/apply-extras.ts --file scripts/extras-2710.local --dry     # only shows what would change
//   npx tsx --env-file=.env.local scripts/apply-extras.ts --file scripts/extras-2710.local --yes     # applies it
// Needs migration 0027 (the extra committees). Keys: extra (committees besides the main one), leads (which of those they coordinate),
// committee / lead (the main one), generation, joined_term.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { COMMITTEES } from '../src/lib/committees'

interface Entry {
  extra?: string[]
  leads?: string[]
  committee?: string
  lead?: boolean
  generation?: string | null
  joined_term?: string | null
}

const args = process.argv.slice(2)
const opt = (n: string) => args[args.indexOf(`--${n}`) + 1]
const flag = (n: string) => args.includes(`--${n}`)

async function main() {
  const file = opt('file')
  if (!file) throw new Error('Falta --file <archivo>.')
  const entries = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, Entry>
  const keys = new Set(COMMITTEES.map((c) => c.key))
  for (const [user, e] of Object.entries(entries)) {
    for (const k of [...(e.extra ?? []), ...(e.leads ?? []), ...(e.committee ? [e.committee] : [])]) if (!keys.has(k as never)) throw new Error(`${user}: el comité "${k}" no existe.`)
    if ((e.leads ?? []).some((k) => !(e.extra ?? []).includes(k))) throw new Error(`${user}: solo puede coordinar comités que tiene.`)
  }
  console.log(`${Object.keys(entries).length} personas en el archivo.`)
  if (flag('dry') || !flag('yes')) {
    for (const [user, e] of Object.entries(entries)) console.log(`  @${user}`, JSON.stringify(e))
    console.log('\nModo de prueba: no se tocó nada. Para aplicar agrega --yes.')
    return
  }
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data: term, error: te } = await db.from('terms').select('id').eq('is_current', true).maybeSingle()
  if (te || !term) throw new Error('No hay una inducción vigente.')
  for (const [user, e] of Object.entries(entries)) {
    const { data: p, error } = await db.from('passports').select('id').eq('username', user).maybeSingle()
    if (error || !p) {
      console.log(`  ! @${user}: no existe`)
      continue
    }
    const record: Record<string, unknown> = {}
    if (e.extra) record.extra_committees = e.extra
    if (e.leads || e.extra) record.extra_leads = e.leads ?? []
    if (e.committee) record.committee = e.committee
    if (e.lead !== undefined) record.committee_lead = e.lead
    if (Object.keys(record).length) {
      const { error: re } = await db.from('passport_records').update(record).eq('passport_id', p.id).eq('term_id', term.id)
      if (re) throw new Error(`@${user}: ${re.message}`)
    }
    const identity: Record<string, unknown> = {}
    if (e.generation !== undefined) identity.generation = e.generation
    if (e.joined_term !== undefined) identity.joined_term = e.joined_term
    if (Object.keys(identity).length) {
      const { error: ie } = await db.from('passports').update(identity).eq('id', p.id)
      if (ie) throw new Error(`@${user}: ${ie.message}`)
    }
    console.log(`  ✓ @${user}`)
  }
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`)
  process.exit(1)
})
