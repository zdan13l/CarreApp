// Migration 0032: a Carrera is Deshabilitada -> Habilitada -> Iniciada -> Terminada, bases only act while it is Iniciada,
// "Reiniciar" undoes a finished test run, and the delay clock counts from the rotation notice.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { finishedMinutesAgo, getAdmin, insertMatch, seedCarrera, type CarreraSeed } from './seed'

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
  await db.sql(`update public.events set is_active = false`)
})

const phaseOf = async (c: Pick<CarreraSeed, 'eventId'>) => (await db.sql<{ phase: string; is_active: boolean }>(`select phase, is_active from public.events where id = $1`, [c.eventId]))[0]
const act = async (c: Pick<CarreraSeed, 'eventId'>, action: string) => {
  const admin = await getAdmin(db)
  return db.asUser(admin).sql(`select public.event_action($1, $2)`, [c.eventId, action])
}

async function oneMatch() {
  const c = await seedCarrera(db, { teams: 2, bases: 1 })
  const m = await insertMatch(db, c, 1, c.bases[0].id, c.teams[0].id, c.teams[1].id)
  return { c, m }
}

describe('the four states (0032)', () => {
  it('a new Carrera is disabled; the old way of switching is_active still means started', async () => {
    const { c } = await oneMatch()
    expect(await phaseOf(c)).toEqual({ phase: 'disabled', is_active: false })
    await db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])
    expect(await phaseOf(c)).toEqual({ phase: 'started', is_active: true })
    await db.sql(`update public.events set is_active = false where id = $1`, [c.eventId])
    expect(await phaseOf(c)).toEqual({ phase: 'disabled', is_active: false })
  })

  it('walks enable -> start -> finish -> disable, stamping the times, and only the coordinator moves it', async () => {
    const { c } = await oneMatch()
    await expect(db.asUser(c.bases[0].staff).sql(`select public.event_action($1, 'enable')`, [c.eventId])).rejects.toThrow(/Solo el coordinador/)
    await act(c, 'enable')
    expect(await phaseOf(c)).toEqual({ phase: 'enabled', is_active: true })
    await act(c, 'start')
    const [started] = await db.sql<{ started_at: string | null }>(`select started_at from public.events where id = $1`, [c.eventId])
    expect(started.started_at).not.toBeNull()
    await act(c, 'finish')
    const [done] = await db.sql<{ finished_at: string | null }>(`select finished_at from public.events where id = $1`, [c.eventId])
    expect(done.finished_at).not.toBeNull()
    await act(c, 'disable')
    expect(await phaseOf(c)).toEqual({ phase: 'disabled', is_active: false })
  })

  it('each move has its own rule', async () => {
    const { c } = await oneMatch()
    await expect(act(c, 'start')).rejects.toThrow(/habilitada/)
    await expect(act(c, 'finish')).rejects.toThrow(/iniciada/)
    await expect(act(c, 'reset')).rejects.toThrow(/termina la Carrera/i)
    await act(c, 'enable')
    await expect(act(c, 'enable')).rejects.toThrow(/ya está habilitada/)
    await act(c, 'start')
    await expect(act(c, 'disable')).rejects.toThrow(/Termina la Carrera antes/)
    await expect(act(c, 'reset')).rejects.toThrow(/termina la Carrera/i)
    await expect(act(c, 'nope')).rejects.toThrow(/desconocida/)
  })

  it('an incomplete Carrera cannot be enabled, and only one Carrera is active at a time', async () => {
    const incomplete = await seedCarrera(db, { teams: 2, bases: 1, complete: false })
    await expect(act(incomplete, 'enable')).rejects.toThrow(/No se puede activar la Carrera/)
    const { c } = await oneMatch()
    const other = await seedCarrera(db, { teams: 2, bases: 1 })
    await act(c, 'enable')
    await expect(act(other, 'enable')).rejects.toThrow(/otra Carrera activa/)
  })

  it('disabling still saves the history and resets the progress', async () => {
    const { c, m } = await oneMatch()
    await act(c, 'enable')
    await act(c, 'start')
    await db.asUser(c.bases[0].staff).sql(`select public.confirm_arrival($1)`, [m.id])
    await act(c, 'finish')
    await act(c, 'disable')
    const [row] = await db.sql<{ arrived_at: string | null }>(`select arrived_at from public.matches where id = $1`, [m.id])
    expect(row.arrived_at).toBeNull()
  })
})

describe('bases only act while the Carrera is started', () => {
  const tryAll = async (c: CarreraSeed, m: { id: string }) => {
    const as = db.asUser(c.bases[0].staff)
    return {
      arrival: await as.sql(`select public.confirm_arrival($1)`, [m.id]).then(() => true, () => false),
      alert: await as.sql(`insert into public.alerts (event_id, match_id, message) values ($1, $2, 'x')`, [c.eventId, m.id]).then(() => true, () => false),
    }
  }

  it('habilitada: nothing; iniciada: everything; terminada: nothing again', async () => {
    const { c, m } = await oneMatch()
    await act(c, 'enable')
    expect(await tryAll(c, m)).toEqual({ arrival: false, alert: false })
    await act(c, 'start')
    expect(await tryAll(c, m)).toEqual({ arrival: true, alert: true })
    const as = db.asUser(c.bases[0].staff)
    await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, c.teams[0].id])
    await act(c, 'finish')
    await expect(as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'pregunta', $2)`, [m.id, c.teams[0].id])).rejects.toThrow(/row-level security/)
  })

  it('the coordinator can still correct in every state, and the base still READS when finished', async () => {
    const { c, m } = await oneMatch()
    await act(c, 'enable')
    await act(c, 'start')
    const as = db.asUser(c.bases[0].staff)
    await as.sql(`select public.confirm_arrival($1)`, [m.id])
    await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, c.teams[0].id])
    await act(c, 'finish')
    expect(await as.sql(`select 1 from public.match_scores where match_id = $1`, [m.id])).toHaveLength(1)
    const admin = await getAdmin(db)
    await db.asUser(admin).sql(`update public.match_scores set winner_team_id = $2 where match_id = $1`, [m.id, c.teams[1].id])
  })

  it('a base cannot confirm the rotation before the Carrera starts', async () => {
    const { c } = await oneMatch()
    await act(c, 'enable')
    const admin = await getAdmin(db)
    const [rot] = await db.asUser(admin).sql<{ id: string }>(`insert into public.round_rotations (event_id, round_number) values ($1, 1) returning id`, [c.eventId])
    const b = c.bases[0]
    await expect(db.asUser(b.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [rot.id, b.id])).rejects.toThrow()
    await act(c, 'start')
    await db.asUser(b.staff).sql(`insert into public.rotation_acks (rotation_id, base_id) values ($1, $2)`, [rot.id, b.id])
  })
})

describe('Reiniciar (only from Terminada)', () => {
  it('clears scores, arrivals and rotations without the history and leaves the Carrera enabled', async () => {
    const { c, m } = await oneMatch()
    await act(c, 'enable')
    await act(c, 'start')
    const as = db.asUser(c.bases[0].staff)
    await as.sql(`select public.confirm_arrival($1)`, [m.id])
    await as.sql(`insert into public.match_scores (match_id, item, winner_team_id) values ($1, 'barra', $2)`, [m.id, c.teams[0].id])
    await db.sql(`insert into public.round_rotations (event_id, round_number) values ($1, 1)`, [c.eventId])
    await act(c, 'finish')
    const archivesBefore = (await db.sql(`select 1 from public.event_archives where event_id = $1`, [c.eventId])).length
    await act(c, 'reset')
    expect(await phaseOf(c)).toEqual({ phase: 'enabled', is_active: true })
    expect(await db.sql(`select 1 from public.match_scores where match_id = $1`, [m.id])).toHaveLength(0)
    expect(await db.sql(`select 1 from public.round_rotations where event_id = $1`, [c.eventId])).toHaveLength(0)
    const [row] = await db.sql<{ arrived_at: string | null; status: string }>(`select arrived_at, status from public.matches where id = $1`, [m.id])
    expect(row).toEqual({ arrived_at: null, status: 'pending' })
    expect((await db.sql(`select 1 from public.event_archives where event_id = $1`, [c.eventId])).length).toBe(archivesBefore) // nothing went to the history
    const [t] = await db.sql<{ started_at: string | null; finished_at: string | null }>(`select started_at, finished_at from public.events where id = $1`, [c.eventId])
    expect(t).toEqual({ started_at: null, finished_at: null })
    // and it can be started again
    await act(c, 'start')
    expect((await phaseOf(c)).phase).toBe('started')
  })
})

describe('the delay clock counts from the rotation notice (0032)', () => {
  const tick = () => db.sql(`select public.check_delays()`)
  const calls = async () => (await db.httpCalls()).flatMap((call) => call.body.notifications)

  async function rounds() {
    const c = await seedCarrera(db, { teams: 3, bases: 2, maxTravelMinutes: 10 })
    const [t1, t2, t3] = c.teams
    const r1 = await insertMatch(db, c, 1, c.bases[0].id, t1.id, t2.id)
    await finishedMinutesAgo(db, r1.id, 15) // finished 15 min ago: long past the 10 minutes
    await insertMatch(db, c, 2, c.bases[1].id, t1.id, t3.id) // group 1 walks from base 1 to base 2 (group 3 has no previous match)
    return c
  }

  it('without a rotation notice it counts from the end of the match, as before', async () => {
    const c = await rounds()
    await act(c, 'enable')
    await act(c, 'start')
    await tick()
    expect(await calls()).toHaveLength(1)
  })

  it('with a recent rotation notice the groups are not late yet; an old one makes them late', async () => {
    const c = await rounds()
    await act(c, 'enable')
    await act(c, 'start')
    await db.sql(`insert into public.round_rotations (event_id, round_number, created_at) values ($1, 1, now() - interval '2 minutes')`, [c.eventId])
    await tick()
    expect(await calls()).toHaveLength(0)
    await db.sql(`update public.round_rotations set created_at = now() - interval '11 minutes' where event_id = $1`, [c.eventId])
    await tick()
    expect(await calls()).toHaveLength(1)
  })

  it('nobody is late before the Carrera starts', async () => {
    const c = await rounds()
    await act(c, 'enable')
    await tick()
    expect(await calls()).toHaveLength(0)
  })
})
