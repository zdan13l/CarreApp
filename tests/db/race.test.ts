// A whole Carrera, from the coordinator's setup to the final ranking, run against the real rules.
//   npm run test:race    (prints the story of the race)
//
// 6 groups x 2 runners, 3 bases (one inductor each), full round robin = 5 rounds, 15 matches.
// On the way it injects the things that really happen: an item nobody has time to play, a score
// the coordinator has to correct, a match that is cancelled, a group that walks too slowly, alerts
// from the coordinator and from a base, and GPS positions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'
import { createDb, type PushItem, type TestDb } from './harness'
import { scheduleWithGenerator, seedCarrera, type CarreraSeed, type MatchSeed } from './seed'

let db: TestDb
let c: CarreraSeed
let matches: MatchSeed[] = []

const expected = new Map<string, number>() // team id -> points the test expects (independent model)
let voidedItems = 0
let correctedItems = 0
const log: string[] = []
const say = (line: string) => log.push(line)

// small deterministic random numbers so a failure is reproducible
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = rng(2027)

const teamName = (id: string) => c.teams.find((t) => t.id === id)!.name
const baseOf = (m: MatchSeed) => c.bases.find((b) => b.id === m.baseId)!
const ITEMS = ['barra', 'pregunta', 'minijuego'] as const
const matchesOfRound = (round: number) => matches.filter((m) => m.round === round)
const stateOf = async (id: string) => (await db.sql<{ status: string }>(`select status from public.matches where id = $1`, [id]))[0].status

async function scoreItem(m: MatchSeed, item: string, winner: string) {
  await db.asUser(baseOf(m).staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, $2, $3)`, [m.id, item, winner])
  expected.set(winner, (expected.get(winner) ?? 0) + 1)
}

beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 'secret')`)
  c = await seedCarrera(db, { teams: 6, bases: 3, runnersPerTeam: 2 })
  for (const t of c.teams) expected.set(t.id, 0)
})
afterAll(async () => {
  console.info(`\n──────── CARRERA DE ENSAYO ────────\n${log.join('\n')}\n`)
  await db.close()
})

describe('the coordinator prepares the Carrera', () => {
  it('has a complete Carrera and activates it', async () => {
    const [{ p }] = await db.sql<{ p: string[] }>(`select public.event_problems($1) as p`, [c.eventId])
    expect(p).toEqual([])
    await db.asUser(c.admin).sql(`update public.events set is_active = true where id = $1`, [c.eventId])
    say(`Carrera activa: ${c.teams.length} grupos, ${c.bases.length} bases, ${c.teams.length * 2} corredores.`)
  })

  it('builds the schedule with the generator: every pair meets exactly once, everybody plays every round', async () => {
    matches = await scheduleWithGenerator(db, c, 5)
    expect(matches).toHaveLength(15)
    const pairs = matches.map((m) => [m.teamA, m.teamB].sort().join('|'))
    expect(new Set(pairs).size).toBe(15) // C(6,2)
    for (let r = 1; r <= 5; r++) {
      const playing = matchesOfRound(r).flatMap((m) => [m.teamA, m.teamB])
      expect(new Set(playing).size).toBe(6)
    }
    say(`Cronograma: 5 rondas x 3 cruces. Todos contra todos, sin repetir.`)
  })
})

describe('round by round', () => {
  it('a base cannot jump ahead: round 2 stays locked until round 1 of that base is finished', async () => {
    const r1 = matchesOfRound(1)[0]
    const later = matches.find((m) => m.baseId === r1.baseId && m.round === 2)!
    await expect(
      db.asUser(baseOf(later).staff).sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [later.id, later.teamA]),
    ).rejects.toThrow(/Primero termina de calificar la ronda anterior/)
  })

  async function playRound(round: number) {
    say(`\nRonda ${round}`)
    for (const m of matchesOfRound(round)) {
      const base = baseOf(m)
      await db.asUser(base.staff).sql(`select public.confirm_arrival($1)`, [m.id])
      expect(await stateOf(m.id)).toBe('in_progress')
      const won = new Map<string, number>([[m.teamA, 0], [m.teamB, 0]])
      for (const item of ITEMS) {
        // scenario 1 (round 2, first match): nobody has time for the minigame; the coordinator voids it
        if (round === 2 && m === matchesOfRound(2)[0] && item === 'minijuego') {
          await db.asUser(c.admin).sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, 'minijuego', null, true)`, [m.id])
          voidedItems++
          say(`  ${base.name}: ${teamName(m.teamA)} vs ${teamName(m.teamB)} — minijuego INVALIDADO por falta de tiempo`)
          continue
        }
        // scenario 3 (round 4, first match): the match is cancelled, the coordinator voids the 3 items
        if (round === 4 && m === matchesOfRound(4)[0]) {
          await db.asUser(c.admin).sql(`insert into public.match_scores (match_id, item, winner_team_id, voided) values ($1, $2, null, true)`, [m.id, item])
          voidedItems++
          continue
        }
        const winner = random() < 0.5 ? m.teamA : m.teamB
        await scoreItem(m, item, winner)
        won.set(winner, (won.get(winner) ?? 0) + 1)
      }
      if (round === 4 && m === matchesOfRound(4)[0]) {
        say(`  ${base.name}: ${teamName(m.teamA)} vs ${teamName(m.teamB)} — CANCELADO, los 3 ítems invalidados`)
      } else if (!(round === 2 && m === matchesOfRound(2)[0])) {
        say(`  ${base.name}: ${teamName(m.teamA)} ${won.get(m.teamA)}–${won.get(m.teamB)} ${teamName(m.teamB)}`)
      }
      expect(await stateOf(m.id)).toBe('finished')
    }
  }

  it('round 1', () => playRound(1))

  it('round 2 (an item is voided)', () => playRound(2))

  it('a group walks too slowly between round 2 and round 3: its runners (only theirs) are warned', async () => {
    // pretend 12 minutes went by since round 2 ended; nobody has arrived at the next base yet
    await db.sql(`update public.matches set finished_at = now() - interval '12 minutes' where event_id = $1 and round_number = 2`, [c.eventId])
    const rows = await db.sql<TimedMatch>(
      `select id, round_number, base_id, team_a, team_b, status, arrived_at::text, finished_at::text from public.matches where event_id = $1`,
      [c.eventId],
    )
    const late = lateTeams(rows, 10, Date.now()) // what the screens compute
    expect(late.length).toBeGreaterThan(0)
    await db.clearHttpCalls()
    await db.sql(`select public.check_delays()`)
    const sent: PushItem[] = (await db.httpCalls()).flatMap((call) => call.body.notifications)
    const notifiedRunners = new Set(sent.flatMap((n) => n.user_ids))
    const expectedRunners = new Set(late.flatMap((l) => c.teams.find((t) => t.id === l.teamId)!.runners))
    expect(notifiedRunners).toEqual(expectedRunners)
    say(`\nDemora: ${late.length} grupo(s) llevan 12 min caminando (máx. 10): ${late.map((l) => teamName(l.teamId)).join(', ')}. Notificados solo sus corredores.`)

    // the coordinator and then a base hurry them up with a manual alert
    const target = matchesOfRound(3).find((m) => late.some((l) => l.matchId === m.id))!
    await db.clearHttpCalls()
    await db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense, la base los espera')`, [c.eventId, target.id])
    await db.asUser(baseOf(target).staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Seguimos esperando')`, [c.eventId, target.id])
    const alerts = (await db.httpCalls()).flatMap((call) => call.body.notifications)
    expect(alerts).toHaveLength(2)
    const both = new Set([...c.teams.find((t) => t.id === target.teamA)!.runners, ...c.teams.find((t) => t.id === target.teamB)!.runners])
    for (const a of alerts) expect(new Set(a.user_ids)).toEqual(both)
    say(`Avisos manuales (coordinador y base) enviados a los corredores de ${teamName(target.teamA)} y ${teamName(target.teamB)}.`)

    // as the bases confirm arrival, the warnings stop
    for (const m of matchesOfRound(3)) await db.asUser(baseOf(m).staff).sql(`select public.confirm_arrival($1)`, [m.id])
    await db.clearHttpCalls()
    await db.sql(`select public.check_delays()`)
    expect(await db.httpCalls()).toHaveLength(0)
  })

  it('round 3 (the coordinator corrects a score after it was sent)', async () => {
    await playRound(3)
    const m = matchesOfRound(3)[1]
    const [row] = await db.sql<{ winner_team_id: string }>(`select winner_team_id from public.match_scores where match_id = $1 and item = 'barra'`, [m.id])
    const other = row.winner_team_id === m.teamA ? m.teamB : m.teamA
    // a base cannot take it back…
    expect(await db.asUser(baseOf(m).staff).affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m.id, other])).toBe(0)
    // …the coordinator can
    expect(await db.asUser(c.admin).affected(`update public.match_scores set winner_team_id = $2 where match_id = $1 and item = 'barra'`, [m.id, other])).toBe(1)
    expected.set(row.winner_team_id, expected.get(row.winner_team_id)! - 1)
    expected.set(other, (expected.get(other) ?? 0) + 1)
    correctedItems++
    say(`  Corrección del coordinador en la barra de ${teamName(m.teamA)} vs ${teamName(m.teamB)}: ${teamName(row.winner_team_id)} → ${teamName(other)}`)
  })

  it('round 4 (a match is cancelled)', () => playRound(4))

  it('round 5', () => playRound(5))
})

describe('GPS during the race', () => {
  it('the 6 designated runners report their position; the coordinator sees all, runners see none', async () => {
    for (const [i, t] of c.teams.entries()) {
      await db.asUser(t.tracker).sql(
        `insert into public.team_locations (team_id, lat, lng, accuracy) values ($1, $2, $3, 8) on conflict (team_id) do update set lat = excluded.lat, lng = excluded.lng`,
        [t.id, 4.628 + i / 5000, -74.064 - i / 5000],
      )
    }
    expect(await db.asUser(c.admin).sql(`select * from public.team_locations`)).toHaveLength(6)
    expect(await db.asUser(c.teams[1].runners[1]).sql(`select * from public.team_locations`)).toHaveLength(0)
  })
})

describe('the final result', () => {
  it('all 15 matches finished, with their finish time', async () => {
    const rows = await db.sql<{ status: string; finished: boolean }>(`select status, finished_at is not null as finished from public.matches where event_id = $1`, [c.eventId])
    expect(rows).toHaveLength(15)
    expect(rows.every((r) => r.status === 'finished' && r.finished)).toBe(true)
  })

  it('the database standings equal an independent count of every point', async () => {
    const table = await db.asUser(c.teams[0].runners[0]).sql<{ team_id: string; name: string; points: string }>(
      `select team_id, name, points from public.team_standings where event_id = $1`,
      [c.eventId],
    )
    const actual = new Map(table.map((r) => [r.team_id, Number(r.points)]))
    for (const t of c.teams) expect(actual.get(t.id), `points of ${t.name}`).toBe(expected.get(t.id))
    // 15 matches x 3 items, minus the items nobody scored
    const total = [...actual.values()].reduce((a, b) => a + b, 0)
    expect(total).toBe(45 - voidedItems)
    expect(voidedItems).toBe(4) // 1 minigame + the 3 items of the cancelled match

    const ranking = [...table].sort((a, b) => Number(b.points) - Number(a.points))
    say(`\nRanking final`)
    ranking.forEach((r, i) => say(`  ${i + 1}. ${r.name}  ${r.points} pts`))
    const top = Number(ranking[0].points)
    const tied = ranking.filter((r) => Number(r.points) === top)
    if (tied.length > 1) say(`  Empate en el primer puesto (${tied.map((r) => r.name).join(', ')}): se desempata en la vida real.`)
  })

  it('every change is in the audit log, with who made it', async () => {
    const counts = await db.sql<{ action: string; n: string }>(`select action, count(*)::text as n from public.score_audit group by action`)
    const byAction = Object.fromEntries(counts.map((r) => [r.action, Number(r.n)]))
    expect(byAction.insert).toBe(45) // every item was resolved once (scored or voided)
    expect(byAction.update).toBe(correctedItems)
    const staff = await db.sql<{ who: string }>(`select distinct changed_by as who from public.score_audit where action = 'insert'`)
    const allowed = new Set([c.admin, ...c.bases.map((b) => b.staff)])
    expect(staff.every((r) => allowed.has(r.who))).toBe(true)
    say(`\nAuditoría: ${byAction.insert} registros de puntaje y ${byAction.update ?? 0} corrección(es).`)
  })

  it('what a runner can and cannot see at the end of the day', async () => {
    const runner = db.asUser(c.teams[2].runners[0])
    expect((await runner.sql(`select * from public.matches where event_id = $1`, [c.eventId])).length).toBe(15)
    expect(await runner.sql(`select * from public.base_details`)).toHaveLength(0) // base information stays private
    expect(await runner.sql(`select * from public.score_audit`)).toHaveLength(0)
    expect(await db.asUser(c.bases[0].staff).sql(`select * from public.base_details`)).toHaveLength(1)
  })
})
