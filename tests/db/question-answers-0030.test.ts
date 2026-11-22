// Migration 0030: every base needs at least 5 questions with their answer to activate a Carrera; up to 10 can be saved.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { seedCarrera } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

const problems = async (eventId: string) => (await db.sql<{ p: string[] }>(`select public.event_problems($1) as p`, [eventId]))[0].p.join(' | ')

describe('five questions with their answer (0030)', () => {
  it('a complete Carrera (5 questions with answer in every base) has no problems', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 2 })
    expect(await problems(c.eventId)).toBe('')
  })

  it('a base with fewer than 5 questions, or without their answers, blocks the activation and says how many it has', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    await db.sql(`delete from public.base_questions where base_id = $1 and position > 3`, [c.bases[0].id])
    expect(await problems(c.eventId)).toContain('La base "Base 1" tiene 3 de 5 preguntas con su respuesta')
    await expect(db.sql(`update public.events set is_active = true where id = $1`, [c.eventId])).rejects.toThrow(/No se puede activar la Carrera/)
    await db.sql(`insert into public.base_questions (base_id, position, question) values ($1, 4, '¿Otra?'), ($1, 5, '¿Y otra?')`, [c.bases[0].id])
    expect(await problems(c.eventId)).toContain('tiene 3 de 5') // two more questions, but without an answer, do not count
    await db.sql(`update public.base_questions set answer = 'Sí' where base_id = $1 and answer is null`, [c.bases[0].id])
    expect(await problems(c.eventId)).toBe('')
  })

  it('up to 10 questions can be saved, an eleventh cannot, and the answer has a limit', async () => {
    const c = await seedCarrera(db, { teams: 2, bases: 1 })
    for (let p = 6; p <= 10; p++) await db.sql(`insert into public.base_questions (base_id, position, question, answer) values ($1, $2, 'q', 'a')`, [c.bases[0].id, p])
    await expect(db.sql(`insert into public.base_questions (base_id, position, question) values ($1, 11, 'q')`, [c.bases[0].id])).rejects.toThrow()
    await expect(db.sql(`update public.base_questions set answer = repeat('x', 601) where base_id = $1 and position = 1`, [c.bases[0].id])).rejects.toThrow()
  })
})
