// Resets the database and leaves the Carrera 2710 (Mitologías) ready: fictitious groups, bases and matches, the login of every
// group and base, and the personal passport of every inductor of the Excel. It talks to Supabase with the service-role key, so it runs
// on the maintainer's computer and never ships with the app.
//
//   npx tsx --env-file=.env.local scripts/seed-2710.ts --inductores "<Excel>" --dry     # shows the plan, touches nothing
//   npx tsx --env-file=.env.local scripts/seed-2710.ts --inductores "<Excel>" --yes     # DELETES EVERYTHING but the admin, then seeds
//
// Needs VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (the file is gitignored). Writes the Excel with every @ and password
// (passwords exist only at this moment): keep it OUT of git (credenciales-*.xlsx is ignored).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import readXlsxFile from 'read-excel-file/node'
import writeXlsxFile from 'write-excel-file/node'
import { generatePassword } from '../src/lib/password'
import { themeOf } from '../src/lib/themes'

const EMAIL_DOMAIN = 'carreapp.test'
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/
const TERM = { name: '2710', theme: 'mitologias' }
const EVENT_NAME = 'Carrera 2710'
const ROUNDS = 6
const PHOTOS = ['/campus.jpg', '/campus-800.jpg', '/campus-noche.jpg']

// Generations: the first half of the year is 2X10, the second 2X30 and the intersemestrales 2X20.
const GENERATIONS: Record<string, { label: string; term: string }> = {
  minichips: { label: 'Minichips', term: '2710' },
  barbies: { label: 'Barbies', term: '2630' },
  peluches: { label: 'Peluches', term: '2610' },
  champinones: { label: 'Champiñones', term: '2510' },
}

const GROUP_NAMES = ['Fénix', 'Minotauros', 'Valquirias', 'Quimeras', 'Hidras', 'Cíclopes', 'Centauros', 'Grifos', 'Sirenas', 'Titanes', 'Pegasos', 'Dragones', 'Kraken', 'Anubis', 'Quetzales', 'Nahuales', 'Fenrires', 'Gorgonas', 'Trolls', 'Basiliscos', 'Sátiros', 'Ninfas', 'Golems', 'Banshees']
const BASE_NAMES = ['Olimpo', 'Valhalla', 'Atlántida', 'Tebas', 'Troya', 'Esparta', 'Delfos', 'Ítaca', 'Midgard', 'Bifrost', 'Teotihuacán', 'Tenochtitlán', 'Menfis', 'Giza', 'Luxor', 'Xian', 'Shangri-La', 'Asgard', 'Hades', 'Camelot', 'Eleusis', 'Micenas', 'Cnosos', 'Abidos']
const QUESTIONS = [
  ['¿Quién robó el fuego para dárselo a los humanos?', '¿Cómo se llama el martillo de Thor?', '¿Qué dios egipcio pesa el corazón de los muertos?'],
  ['¿Qué monstruo de mil cabezas combatió Hércules?', '¿Cuál es el árbol que sostiene los nueve mundos nórdicos?', '¿Qué dios azteca es la serpiente emplumada?'],
  ['¿Quién es la diosa griega de la sabiduría?', '¿Cómo se llama el barco de los nórdicos?', '¿Qué animal sagrado representa a Bastet?'],
]

const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const flat = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

interface Person {
  line: number
  fullName: string
  career: string
  committee: string | null
  nickname: string | null
  username: string
  generation: string | null
  joinedTerm: string | null
  coordinator: boolean
  role: 'runner' | 'base' | 'coordinator'
  culture: string
  lead: boolean
  password: string
  note: string
}

const args = process.argv.slice(2)
const flag = (n: string) => args.includes(`--${n}`)
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : undefined
}

async function readPeople(file: string): Promise<{ people: Person[]; problems: string[] }> {
  const sheets = await readXlsxFile(file)
  const rows = sheets[0].data as unknown[][]
  const head = rows[0].map((c) => flat(String(c ?? '')))
  const col = (name: string) => head.findIndex((h) => h.startsWith(name))
  const C = { name: col('nombre'), career: col('carrera'), committee: col('comite'), nick: col('apodo'), user: col('usuario'), gen: col('generacion'), role: col('rol') }
  const theme = themeOf(TERM.theme)
  const problems: string[] = []
  const taken = new Set<string>()
  const people: Person[] = []
  rows.slice(1).forEach((r, i) => {
    const cell = (n: number) => (n >= 0 && r[n] != null ? String(r[n]).trim() : '')
    const fullName = cell(C.name)
    if (!fullName) return
    const line = i + 2
    const career = cell(C.career)
    const culture = theme.cultureOf(career)
    if (!culture) problems.push(`Línea ${line}: la carrera "${career}" no tiene cultura en Mitologías.`)
    const username = cell(C.user).replace(/^@/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._-]/g, '')
    if (!USERNAME_PATTERN.test(username)) problems.push(`Línea ${line}: el usuario "${cell(C.user)}" no es válido.`)
    if (taken.has(username)) problems.push(`Línea ${line}: el usuario "${username}" está repetido.`)
    taken.add(username)
    const committee = flat(cell(C.committee)) || null
    // "Barbies / Pendiente": the person entered twice; the ones the app does not know yet stay as written
    const gens = cell(C.gen).split('/').map((g) => g.trim()).filter(Boolean)
    const known = gens.map((g) => GENERATIONS[slug(g)]).filter(Boolean)
    const generation = known.length ? gens.map((g) => GENERATIONS[slug(g)]?.label ?? g).join(' / ') : null
    const joinedTerm = known.length ? known.map((k) => k.term).sort()[0] : null
    const roleText = flat(cell(C.role))
    const coordinator = roleText.startsWith('coordi')
    people.push({
      line,
      fullName,
      career,
      committee,
      nickname: cell(C.nick).slice(0, 24) || null,
      username,
      generation,
      joinedTerm,
      coordinator,
      role: coordinator ? 'coordinator' : 'runner',
      culture: culture ?? 'general',
      lead: false,
      password: generatePassword(),
      note: coordinator ? cell(C.role) : '',
    })
  })
  // "Coordi Sistemas/Clausura" coordinates the committee after the slash and gets its golden stamp (Caos has two coordinators, 0026).
  // Coordinators of the Welcome committee and Persona's second committee (Meraki) wait for their own pages: a person has one committee for now.
  for (const p of people.filter((x) => x.coordinator && x.committee)) if (flat(p.note).endsWith(`/${p.committee}`)) p.lead = true
  return { people, problems }
}

/** 18 groups of two runners and the rest on bases (53 people -> 18 groups and 17 bases). */
function assign(people: Person[]) {
  const rest = people.filter((p) => !p.coordinator)
  const groups = Math.max(2, Math.round(rest.length / 3))
  const bases = Math.max(1, rest.length - 2 * groups)
  // the Carrera committee runs; the pairs mix careers (the i-th with the (i+groups)-th of a list ordered by career)
  const ordered = [...rest].sort((a, b) => Number(b.committee === 'carrera') - Number(a.committee === 'carrera'))
  const runners = ordered.slice(0, 2 * groups).sort((a, b) => a.career.localeCompare(b.career))
  const baseStaff = ordered.slice(2 * groups)
  const pairs: Person[][] = Array.from({ length: groups }, (_, i) => [runners[i], runners[i + groups]])
  for (const p of runners) p.role = 'runner'
  for (const p of baseStaff) p.role = 'base'
  return { groups, bases, pairs, baseStaff }
}

/** Round robin (circle method): ROUNDS rounds, every pair of groups at most once, a group once per round. */
function schedule(groups: number) {
  const ids = Array.from({ length: groups }, (_, i) => i)
  const rounds: [number, number][][] = []
  for (let r = 0; r < Math.min(ROUNDS, groups - 1); r++) {
    const round: [number, number][] = []
    for (let i = 0; i < groups / 2; i++) round.push([ids[i], ids[groups - 1 - i]])
    rounds.push(round)
    ids.splice(1, 0, ids.pop()!)
  }
  return rounds
}

const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}

async function wipe(db: SupabaseClient) {
  const admins = must(await db.from('profiles').select('id, username').eq('role', 'admin'), 'leer admins')
  if (!admins.length) throw new Error('No hay ningún administrador: no borro nada.')
  const keep = new Set(admins.map((a) => a.id))
  console.log(`Se conserva al administrador: ${admins.map((a) => a.username).join(', ')}`)
  let deleted = 0
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw new Error(`listar usuarios: ${error.message}`)
    const victims = data.users.filter((u) => !keep.has(u.id))
    if (!victims.length) break
    for (const u of victims) {
      const { error: e } = await db.auth.admin.deleteUser(u.id)
      if (e) throw new Error(`borrar ${u.email}: ${e.message}`)
      deleted++
    }
  }
  console.log(`Usuarios borrados: ${deleted}`)
  must(await db.from('events').update({ is_active: false }).eq('is_active', true), 'desactivar la Carrera')
  must(await db.from('events').delete().not('id', 'is', null), 'borrar Carreras')
  must(await db.from('terms').delete().not('id', 'is', null), 'borrar inducciones')
  for (const folder of ['teams', 'bases', 'users']) {
    const { data } = await db.storage.from('photos').list(folder, { limit: 1000 })
    if (data?.length) await db.storage.from('photos').remove(data.map((f) => `${folder}/${f.name}`))
  }
  console.log('Carreras, inducciones, pasaportes y fotos borrados.')
}

async function createLogin(db: SupabaseClient, username: string, password: string) {
  const { data, error } = await db.auth.admin.createUser({ email: `${username}@${EMAIL_DOMAIN}`, password, email_confirm: true })
  if (error || !data.user) throw new Error(`crear ${username}: ${error?.message}`)
  return data.user.id
}

async function main() {
  const file = opt('inductores')
  if (!file) throw new Error('Falta --inductores "<ruta del Excel>".')
  const { people, problems } = await readPeople(file)
  const plan = assign(people)
  const rounds = schedule(plan.groups)
  const groupNames = GROUP_NAMES.slice(0, plan.groups)
  const baseNames = BASE_NAMES.slice(0, plan.bases)
  if (groupNames.length < plan.groups || baseNames.length < plan.bases) throw new Error('Faltan nombres ficticios para tantos grupos o bases.')

  console.log(`\n${people.length} inductores · ${people.filter((p) => p.coordinator).length} coordinadores · ${plan.groups} grupos de 2 · ${plan.bases} bases · ${rounds.length} rondas · ${rounds.flat().length} cruces`)
  for (const p of problems) console.log(`  ! ${p}`)
  console.log(`  Con generación: ${people.filter((p) => p.generation).length} · pendientes: ${people.filter((p) => !p.generation).map((p) => p.fullName).join(', ')}`)
  if (problems.some((p) => !p.startsWith('Comité'))) throw new Error('Corrige el Excel antes de seguir.')
  if (flag('dry') || !flag('yes')) {
    console.log('\nModo de prueba: no se tocó nada. Para ejecutar de verdad agrega --yes.')
    return
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.')
  const db = createClient(url, key, { auth: { persistSession: false } })

  await wipe(db)

  const term = must(await db.from('terms').insert({ ...TERM, is_current: true }).select('id').single(), 'crear la inducción')
  const event = must(await db.from('events').insert({ name: EVENT_NAME, is_active: false, term_id: term.id }).select('id').single(), 'crear la Carrera')

  const teams = must(
    await db.from('teams').insert(groupNames.map((name, i) => ({ event_id: event.id, name, photo_path: PHOTOS[i % 3], sort_order: i }))).select('id, name, sort_order'),
    'crear grupos',
  ).sort((a, b) => a.sort_order - b.sort_order)
  const bases = must(
    await db
      .from('bases')
      .insert(baseNames.map((name, i) => ({ event_id: event.id, name, location_photo_path: PHOTOS[(i + 1) % 3], lat: 4.6285 + (i % 5) * 0.0004, lng: -74.0645 + Math.floor(i / 5) * 0.0004, sort_order: i })))
      .select('id, name, sort_order'),
    'crear bases',
  ).sort((a, b) => a.sort_order - b.sort_order)
  must(await db.from('base_details').insert(bases.map((b) => ({ base_id: b.id, info: `Base ficticia de ${b.name}: cada grupo juega las tres etapas (barra, pregunta y minijuego) y suma un punto por etapa.` }))), 'info de bases')
  must(
    await db.from('base_questions').insert(bases.flatMap((b, i) => QUESTIONS[i % 3].map((question, k) => ({ base_id: b.id, position: k + 1, question })))),
    'preguntas de bases',
  )

  // the matches: the circle method for the pairs, the bases take turns (a base hosts one match per round)
  const perRound = plan.groups / 2
  const matches = rounds.flatMap((round, r) =>
    round.map(([a, b], k) => ({ event_id: event.id, round_number: r + 1, base_id: bases[(r * perRound + k) % bases.length].id, team_a: teams[a].id, team_b: teams[b].id })),
  )
  must(await db.from('matches').insert(matches), 'crear cruces')

  // the login of every group and every base (these are the ones used during the Carrera)
  const logins: { kind: string; name: string; username: string; password: string; detail: string }[] = []
  for (const [i, t] of teams.entries()) {
    const username = `grupo.${slug(t.name)}`.slice(0, 30)
    const password = generatePassword()
    const id = await createLogin(db, username, password)
    must(await db.from('profiles').insert({ id, username, full_name: `Grupo ${t.name}`, role: 'runner', event_id: event.id }), `perfil ${username}`)
    must(await db.from('team_runners').insert({ team_id: t.id, user_id: id, is_gps_tracker: true }), `grupo ${username}`)
    logins.push({ kind: 'Grupo', name: t.name, username, password, detail: plan.pairs[i].map((p) => p.fullName).join(' y ') })
  }
  for (const [i, b] of bases.entries()) {
    const username = `base.${slug(b.name)}`.slice(0, 30)
    const password = generatePassword()
    const id = await createLogin(db, username, password)
    must(await db.from('profiles').insert({ id, username, full_name: `Base ${b.name}`, role: 'base', event_id: event.id }), `perfil ${username}`)
    must(await db.from('base_staff').insert({ base_id: b.id, user_id: id }), `base ${username}`)
    logins.push({ kind: 'Base', name: b.name, username, password, detail: plan.baseStaff[i]?.fullName ?? '' })
  }

  // the personal passport of every inductor
  const teamOf = new Map<string, string>()
  plan.pairs.forEach((pair, i) => pair.forEach((p) => teamOf.set(p.username, teams[i].id)))
  const baseOf = new Map<string, string>()
  plan.baseStaff.forEach((p, i) => baseOf.set(p.username, bases[i].id))
  for (const p of people) {
    const id = await createLogin(db, p.username, p.password)
    must(
      await db.from('passports').insert({ id, username: p.username, full_name: p.fullName, nickname: p.nickname, generation: p.generation, joined_term: p.joinedTerm }),
      `pasaporte ${p.username}`,
    )
    must(
      await db.from('passport_records').insert({
        passport_id: id,
        term_id: term.id,
        role: p.role,
        career: p.career,
        culture: p.culture,
        committee: p.committee,
        committee_lead: p.lead,
        team_id: teamOf.get(p.username) ?? null,
        base_id: baseOf.get(p.username) ?? null,
      }),
      `registro ${p.username}`,
    )
  }

  // activate (it needs the photos, the info and the questions that were just created)
  const { error: activateError } = await db.from('events').update({ is_active: true }).eq('id', event.id)
  console.log(activateError ? `\nLa Carrera quedó SIN activar: ${activateError.message}` : '\nLa Carrera 2710 quedó activa.')

  const bold = (value: string) => ({ value, fontWeight: 'bold' as const })
  const sheet = (rows: string[][], header: string[]) => [header.map(bold), ...rows.map((r) => r.map((value) => ({ value })))]
  const out = opt('out') ?? 'credenciales-2710.xlsx'
  const widths = (...w: number[]) => w.map((width) => ({ width }))
  await writeXlsxFile([
    { data: sheet(people.map((p) => [p.fullName, `@${p.username}`, p.password, p.career, p.committee ?? '', p.role, p.generation ?? 'Pendiente']), ['Nombre', 'Usuario (@)', 'Contraseña', 'Carrera', 'Comité', 'Papel', 'Generación']), sheet: 'Pasaportes', columns: widths(34, 24, 22, 24, 12, 12, 22) },
    { data: sheet(logins.map((l) => [l.kind, l.name, l.username, l.password, l.detail]), ['Tipo', 'Nombre', 'Usuario', 'Contraseña', 'Quién']), sheet: 'Grupos y bases', columns: widths(10, 18, 24, 22, 50) },
  ]).toFile(out)
  console.log(`Credenciales guardadas en ${out}. No las subas a git.`)
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}`)
  process.exit(1)
})
