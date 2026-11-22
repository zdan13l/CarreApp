// Builders for a complete Carrera, written the way the coordinator would set it up (through the
// service role / SQL, bypassing RLS) so each test starts from a known, valid state.
import { generateSchedule } from '../../src/lib/schedule'
import type { Row, TestDb } from './harness'

let counter = 0
const tag = () => (++counter).toString(36)

export type Role = 'admin' | 'base' | 'runner'

export async function addUser(db: TestDb, username: string, role: Role): Promise<string> {
  const [user] = await db.sql<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [`${username}@carreapp.test`])
  await db.sql(`insert into public.profiles (id, username, full_name, role) values ($1, $2, $3, $4)`, [
    user.id,
    username,
    `Persona ${username}`,
    role,
  ])
  return user.id
}

const admins = new WeakMap<TestDb, string>()
export async function getAdmin(db: TestDb): Promise<string> {
  let id = admins.get(db)
  if (!id) {
    id = await addUser(db, 'coordinador', 'admin')
    admins.set(db, id)
  }
  return id
}

export interface TeamSeed {
  id: string
  name: string
  runners: string[]
  tracker: string // the runner designated for the GPS
}
export interface BaseSeed {
  id: string
  name: string
  staff: string
}
export interface CarreraSeed {
  eventId: string
  admin: string
  teams: TeamSeed[]
  bases: BaseSeed[]
}

export interface SeedOptions {
  teams?: number
  bases?: number
  runnersPerTeam?: number
  /** photos, base information and the 3 questions (default true) */
  complete?: boolean
  maxTravelMinutes?: number
}

export async function seedCarrera(db: TestDb, opts: SeedOptions = {}): Promise<CarreraSeed> {
  const { teams = 4, bases = 2, runnersPerTeam = 2, complete = true, maxTravelMinutes = 10 } = opts
  const admin = await getAdmin(db)
  const t = tag()
  const [event] = await db.sql<{ id: string }>(
    `insert into public.events (name, max_travel_minutes) values ($1, $2) returning id`,
    [`Carrera ${t}`, maxTravelMinutes],
  )

  const teamSeeds: TeamSeed[] = []
  for (let i = 1; i <= teams; i++) {
    const [row] = await db.sql<{ id: string }>(
      `insert into public.teams (event_id, name, photo_path, sort_order) values ($1, $2, $3, $4) returning id`,
      [event.id, `Grupo ${i}`, complete ? `teams/${t}-${i}.jpg` : null, i],
    )
    const runners: string[] = []
    for (let r = 1; r <= runnersPerTeam; r++) {
      const id = await addUser(db, `corredor.${t}.${i}.${r}`, 'runner')
      await db.sql(`insert into public.team_runners (team_id, user_id, is_gps_tracker) values ($1, $2, $3)`, [row.id, id, r === 1])
      runners.push(id)
    }
    teamSeeds.push({ id: row.id, name: `Grupo ${i}`, runners, tracker: runners[0] })
  }

  const baseSeeds: BaseSeed[] = []
  for (let i = 1; i <= bases; i++) {
    const [row] = await db.sql<{ id: string }>(
      `insert into public.bases (event_id, name, location_photo_path, lat, lng, sort_order)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [event.id, `Base ${i}`, complete ? `bases/${t}-${i}.jpg` : null, 4.6286 + i / 10000, -74.0647 - i / 10000, i],
    )
    if (complete) {
      await db.sql(`insert into public.base_details (base_id, info) values ($1, $2)`, [row.id, `Información de la base ${i}`])
      for (let q = 1; q <= 5; q++) {
        await db.sql(`insert into public.base_questions (base_id, position, question, answer) values ($1, $2, $3, $4)`, [row.id, q, `¿Pregunta ${q} de la base ${i}?`, `Respuesta ${q} de la base ${i}`])
      }
    }
    const staff = await addUser(db, `inductor.${t}.${i}`, 'base')
    await db.sql(`insert into public.base_staff (base_id, user_id) values ($1, $2)`, [row.id, staff])
    baseSeeds.push({ id: row.id, name: `Base ${i}`, staff })
  }

  return { eventId: event.id, admin, teams: teamSeeds, bases: baseSeeds }
}

export interface MatchSeed {
  id: string
  round: number
  baseId: string
  teamA: string
  teamB: string
}

export async function insertMatch(db: TestDb, c: CarreraSeed, round: number, baseId: string, teamA: string, teamB: string): Promise<MatchSeed> {
  const [row] = await db.sql<{ id: string }>(
    `insert into public.matches (event_id, base_id, round_number, team_a, team_b) values ($1, $2, $3, $4, $5) returning id`,
    [c.eventId, baseId, round, teamA, teamB],
  )
  return { id: row.id, round, baseId, teamA, teamB }
}

/** Schedules the Carrera with the SAME generator the coordinator's screen uses. */
export async function scheduleWithGenerator(db: TestDb, c: CarreraSeed, rounds: number): Promise<MatchSeed[]> {
  const planned = generateSchedule(
    c.teams.map((x) => x.id),
    c.bases.map((x) => x.id),
    rounds,
  )
  const out: MatchSeed[] = []
  for (const p of planned) out.push(await insertMatch(db, c, p.round_number, p.base_id, p.team_a, p.team_b))
  return out
}

/** Makes this Carrera the active one (inductors only act on the active Carrera). */
export async function activate(db: TestDb, c: Pick<CarreraSeed, 'eventId'>): Promise<void> {
  await db.sql(`update public.events set is_active = false where is_active and id <> $1`, [c.eventId])
  await db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
}

/** Makes a base confirm arrival and score all its items for a match (winner = teamA or teamB). */
export async function playMatch(db: TestDb, c: CarreraSeed, m: MatchSeed, winners: [string, string, string]): Promise<void> {
  await activate(db, c)
  const staff = c.bases.find((b) => b.id === m.baseId)!.staff
  const as = db.asUser(staff)
  await as.sql(`select public.confirm_arrival($1)`, [m.id])
  const items = ['barra', 'pregunta', 'minijuego']
  for (const [i, item] of items.entries()) {
    await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, winners[i]])
  }
}

export const first = <T extends Row>(rows: T[]): T => rows[0]

/** Moves a match's finish time into the past, to simulate minutes of walking. */
export async function finishedMinutesAgo(db: TestDb, matchId: string, minutes: number, seconds = 5): Promise<void> {
  await db.sql(
    `update public.matches set status = 'finished', finished_at = now() - make_interval(mins => $2, secs => $3) where id = $1`,
    [matchId, minutes, seconds],
  )
}
