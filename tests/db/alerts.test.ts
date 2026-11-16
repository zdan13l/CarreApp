// The delay-alert pipeline on the database side: check_delays() (runs every 30 s in production),
// the manual-alert trigger, and a parity check against the client implementation (lateTeams).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'
import { legKey } from '../../src/lib/travel'
import { createDb, type PushItem, type TestDb } from './harness'
import { finishedMinutesAgo, insertMatch, seedCarrera, type CarreraSeed } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
  await db.sql(`insert into public.push_config (id, url, secret) values (1, 'https://carreapp.test/api/push', 's3cr3t')`)
})
afterAll(async () => {
  await db.close()
})
beforeEach(async () => {
  await db.clearHttpCalls()
  await db.sql(`update public.events set is_active = false`) // one active Carrera at a time
})

const activate = (c: CarreraSeed) => db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
const tick = () => db.sql(`select public.check_delays()`)
const items = async (): Promise<PushItem[]> => (await db.httpCalls()).flatMap((call) => call.body.notifications)

/**
 * Round 1 finished `minutesAgo` ago for everybody; round 2 pending. 4 groups, 4 bases, so every
 * group has to WALK to a different base: t1 b0->b2, t2 b0->b3, t3 b1->b2, t4 b1->b3.
 */
async function twoRounds(minutesAgo: number, opts: { maxTravelMinutes?: number } = {}) {
  const c = await seedCarrera(db, { teams: 4, bases: 4, maxTravelMinutes: opts.maxTravelMinutes ?? 10 })
  const [t1, t2, t3, t4] = c.teams
  const r1a = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
  const r1b = await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
  await finishedMinutesAgo(db, r1a.id, minutesAgo)
  await finishedMinutesAgo(db, r1b.id, minutesAgo)
  const r2a = await insertMatch(db, c, 2, c.bases[2].id, t1.id, t3.id)
  const r2b = await insertMatch(db, c, 2, c.bases[3].id, t2.id, t4.id)
  await activate(c)
  return { c, r1a, r1b, r2a, r2b }
}

describe('check_delays (server side)', () => {
  it('does nothing while the sending configuration is missing', async () => {
    await db.sql(`update public.push_config set url = null`)
    await twoRounds(30)
    await tick()
    expect(await db.httpCalls()).toHaveLength(0)
    await db.sql(`update public.push_config set url = 'https://carreapp.test/api/push'`)
  })

  it('stays silent when nobody is late', async () => {
    await twoRounds(3)
    await tick()
    expect(await db.httpCalls()).toHaveLength(0)
  })

  it('warns each late group\'s RUNNERS (only them) in ONE call, with the secret and the right text', async () => {
    const { c } = await twoRounds(12)
    await tick()
    const calls = await db.httpCalls()
    expect(calls).toHaveLength(1) // every late group goes together
    expect(calls[0].url).toBe('https://carreapp.test/api/push')
    expect(calls[0].headers['x-push-secret']).toBe('s3cr3t')
    const sent = calls[0].body.notifications
    expect(sent).toHaveLength(4) // 4 groups are late, one notification each
    const allowed = new Set(c.teams.flatMap((t) => t.runners))
    for (const n of sent) {
      expect(n.user_ids.length).toBe(2) // both runners of the group
      expect(n.user_ids.every((u) => allowed.has(u))).toBe(true)
      expect(n.title).toMatch(/^Llevas 12 min en el traslado$/)
      expect(n.body).toMatch(/Apúrate hacia Base [34] \(máximo 10 min\)/)
      expect(n.tag).toMatch(/^late-/)
    }
    // nobody who is not a runner (inductors, coordinator) is ever notified
    const everyone = new Set(sent.flatMap((n) => n.user_ids))
    expect(everyone.has(c.admin)).toBe(false)
    for (const b of c.bases) expect(everyone.has(b.staff)).toBe(false)
  })

  it('counts only the Carrera that is active', async () => {
    await twoRounds(30)
    await db.sql(`update public.events set is_active = false`)
    await tick()
    expect(await db.httpCalls()).toHaveLength(0)
  })

  it('stops warning a match as soon as the base confirms both groups arrived', async () => {
    const { r2a } = await twoRounds(30)
    await db.sql(`update public.matches set arrived_at = now(), status = 'in_progress' where id = $1`, [r2a.id])
    await tick()
    const sent = await items()
    expect(sent.some((n) => n.tag.includes(r2a.id))).toBe(false)
    expect(sent.length).toBe(2) // the other match still has its two late groups
  })

  it('uses the time of each leg when it has one, and the general time otherwise', async () => {
    const { c } = await twoRounds(12)
    // t1 walks b0->b2 and t2 walks b0->b3. Give the first leg 20 min: t1 is not late yet at 12.
    await db.sql(`insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, 20)`, [c.eventId, c.bases[0].id, c.bases[2].id])
    await tick()
    let sent = await items()
    expect(sent).toHaveLength(3) // t2, t3, t4 (t1 still has time)
    expect(sent.some((n) => n.user_ids.includes(c.teams[0].runners[0]))).toBe(false)
    expect(sent.every((n) => /\(máximo 10 min\)/.test(n.body))).toBe(true) // the others use the general 10
    // a shorter leg makes it late sooner than the general time
    await db.sql(`update public.base_travel_times set minutes = 5`)
    await db.clearHttpCalls()
    await tick()
    sent = await items()
    expect(sent).toHaveLength(4)
    expect(sent.find((n) => n.user_ids.includes(c.teams[0].runners[0]))!.body).toMatch(/\(máximo 5 min\)/)
  })

  it('does NOT warn a group whose next match is at the same base it already is at (it does not walk)', async () => {
    // 2 bases, 4 groups: t1 and t3 swap bases (they walk); t2 and t4 play again where they are.
    const c = await seedCarrera(db, { teams: 4, bases: 2 })
    const [t1, t2, t3, t4] = c.teams
    const r1a = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    const r1b = await insertMatch(db, c, 1, c.bases[1].id, t3.id, t4.id)
    await finishedMinutesAgo(db, r1a.id, 30)
    await finishedMinutesAgo(db, r1b.id, 30)
    await insertMatch(db, c, 2, c.bases[1].id, t1.id, t3.id) // t1 walks 0->1, t3 stays at 1
    await insertMatch(db, c, 2, c.bases[0].id, t2.id, t4.id) // t2 stays at 0, t4 walks 1->0
    await activate(c)
    await tick()
    const notified = new Set((await items()).flatMap((n) => n.user_ids))
    expect(notified).toEqual(new Set([...t1.runners, ...t4.runners])) // only the two groups that really walk
  })

  it('never warns about round 1 (there is no previous base) or when the previous match is not finished', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    const r1 = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
    await db.sql(`update public.matches set status = 'in_progress' where id = $1`, [r1.id])
    await activate(c)
    await tick()
    expect(await db.httpCalls()).toHaveLength(0)
  })

  it('compares with the LAST previous match of the group, not an older one', async () => {
    // a: round 1 finished 60 min ago at b0, round 2 finished 2 min ago at b1, round 3 pending at b2.
    // y rested round 2 (its last match is 60 min old, but it was not walking: 0016), so nobody is late.
    const c = await seedCarrera(db, { teams: 4, bases: 3 })
    const [a, b, x, y] = c.teams.map((t) => t.id)
    const r1 = await insertMatch(db, c, 1, c.bases[0].id, a, b)
    const r1x = await insertMatch(db, c, 1, c.bases[1].id, x, y)
    const r2 = await insertMatch(db, c, 2, c.bases[1].id, a, x)
    await finishedMinutesAgo(db, r1.id, 60)
    await finishedMinutesAgo(db, r1x.id, 60)
    await finishedMinutesAgo(db, r2.id, 2)
    await insertMatch(db, c, 3, c.bases[2].id, a, y) // a walks b1->b2 (2 min ago: fine); y rested, so it has no deadline
    await activate(c)
    await tick()
    expect(await items()).toHaveLength(0)
  })
})

describe('manual alerts (trigger on the alerts table)', () => {
  it('reach the runners of BOTH groups of the match and nobody else', async () => {
    const { c, r2a } = await twoRounds(1)
    await db.asUser(c.admin).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Apúrense, la base los espera')`, [c.eventId, r2a.id])
    const sent = await items()
    expect(sent).toHaveLength(1)
    expect(sent[0].title).toBe('Aviso: ¡apúrense!')
    expect(sent[0].body).toBe('Apúrense, la base los espera')
    const expected = new Set([...c.teams[0].runners, ...c.teams[2].runners]) // t1 vs t3
    expect(new Set(sent[0].user_ids)).toEqual(expected)
  })

  it('also work when the inductor of the base sends them', async () => {
    const { c, r2a } = await twoRounds(1)
    await db.asUser(c.bases[2].staff).sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'Ya los esperamos')`, [c.eventId, r2a.id])
    expect(await items()).toHaveLength(1)
  })
})

describe('client and server agree on who is late (parity)', () => {
  // The same rule lives twice: lateTeams() in the browser and check_delays() in the database.
  // Random timelines must give the same late set in both.
  it.each([1, 2, 3, 4, 5, 6])('random Carrera #%i', async (seed) => {
    let s = seed * 7919
    const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const c = await seedCarrera(db, { teams: 6, bases: 3, maxTravelMinutes: 8 })
    const bases = c.bases.map((b) => b.id)
    // 3 rounds of round robin by hand (circle method for 6 groups), bases rotate
    const ids = c.teams.map((t) => t.id)
    const rounds: [string, string][][] = [
      [[ids[0], ids[1]], [ids[2], ids[3]], [ids[4], ids[5]]],
      [[ids[0], ids[2]], [ids[1], ids[4]], [ids[3], ids[5]]],
      [[ids[0], ids[3]], [ids[1], ids[5]], [ids[2], ids[4]]],
    ]
    const matches: TimedMatch[] = []
    for (const [r, pairs] of rounds.entries()) {
      for (const [i, [a, b]] of pairs.entries()) {
        const base = bases[(i + r) % bases.length]
        const row = await insertMatch(db, c, r + 1, base, a, b)
        // statuses: older rounds mostly finished at random times; the newest rounds pending, some arrived
        const finished = r < 2 && rand() > 0.15
        const minutes = Math.floor(rand() * 20)
        if (finished) await finishedMinutesAgo(db, row.id, minutes, 20)
        const arrived = !finished && rand() > 0.7
        if (arrived) await db.sql(`update public.matches set arrived_at = now(), status = 'in_progress' where id = $1`, [row.id])
        matches.push({ id: row.id, round_number: r + 1, base_id: base, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null })
      }
    }
    // a couple of legs with their own time
    const legs = new Map<string, number>()
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
      if (rand() > 0.4) {
        const minutes = 3 + Math.floor(rand() * 12)
        legs.set(legKey(bases[from], bases[to]), minutes)
        await db.sql(`insert into public.base_travel_times (event_id, from_base_id, to_base_id, minutes) values ($1, $2, $3, $4)`, [c.eventId, bases[from], bases[to], minutes])
      }
    }
    // read back what the browser would read
    const fresh = await db.sql<TimedMatch & { finished_at: string | null; arrived_at: string | null }>(
      `select id, round_number, base_id, team_a, team_b, status, arrived_at::text, finished_at::text from public.matches where event_id = $1`,
      [c.eventId],
    )
    const client = lateTeams(fresh, 8, Date.now(), legs).map((l) => `${l.matchId}|${l.teamId}`).sort()

    await db.sql(`update public.events set is_active = false`)
    await activate(c)
    await db.clearHttpCalls()
    await tick()
    const server = (await items()).map((n) => n.tag).filter((t) => /^late-[0-9a-f-]{36}-[0-9a-f-]{36}$/.test(t)).map((t) => `${t.slice(5, 41)}|${t.slice(42)}`).sort()
    expect(server).toEqual(client)
  })
})
