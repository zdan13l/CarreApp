import { describe, expect, it } from 'vitest'
import { analyzeSchedule, currentRound, formatTime, generateSchedule, matchErrorMessage, type PlannedMatch } from '../../src/lib/schedule'

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`)
const pairKey = (m: PlannedMatch) => [m.team_a, m.team_b].sort().join('|')

describe('generateSchedule', () => {
  it('gives every pair of 4 groups exactly one match over 3 rounds', () => {
    const matches = generateSchedule(ids('T', 4), ids('B', 2), 3)
    expect(matches).toHaveLength(6)
    expect(new Set(matches.map(pairKey)).size).toBe(6)
  })

  it('never repeats a pair, a group in a round, or a base in a round (any size)', () => {
    for (let teams = 2; teams <= 14; teams++) {
      for (const bases of [1, 2, 3, 5, 8]) {
        const matches = generateSchedule(ids('T', teams), ids('B', bases), teams)
        const pairs = new Set<string>()
        const seen = new Set<string>()
        for (const m of matches) {
          expect(pairs.has(pairKey(m)), `${teams}x${bases} repeats ${pairKey(m)}`).toBe(false)
          pairs.add(pairKey(m))
          for (const id of [m.team_a, m.team_b, m.base_id]) {
            const k = `${m.round_number}|${id}`
            expect(seen.has(k), `${teams}x${bases} uses ${id} twice in round ${m.round_number}`).toBe(false)
            seen.add(k)
          }
        }
      }
    }
  })

  it('with an odd number of groups one rests each round', () => {
    const matches = generateSchedule(ids('T', 5), ids('B', 3), 5)
    for (let r = 1; r <= 5; r++) {
      const playing = matches.filter((m) => m.round_number === r).flatMap((m) => [m.team_a, m.team_b])
      expect(new Set(playing).size).toBe(4)
    }
  })

  it('stops at the number of rounds asked for, and never exceeds a full round robin', () => {
    expect(Math.max(...generateSchedule(ids('T', 6), ids('B', 3), 2).map((m) => m.round_number))).toBe(2)
    expect(Math.max(...generateSchedule(ids('T', 6), ids('B', 3), 50).map((m) => m.round_number))).toBe(5)
  })

  it('drops the matches that do not fit when there are fewer bases than matches in a round', () => {
    const matches = generateSchedule(ids('T', 8), ids('B', 2), 1)
    expect(matches).toHaveLength(2)
  })

  it('rotates the bases between rounds so a base is not always the same pairing', () => {
    const matches = generateSchedule(ids('T', 6), ids('B', 3), 5)
    const firstBaseByRound = [1, 2, 3].map((r) => matches.find((m) => m.round_number === r && m.team_a === 'T1')?.base_id)
    expect(new Set(firstBaseByRound).size).toBeGreaterThan(1)
  })

  it('returns nothing for impossible inputs', () => {
    expect(generateSchedule(['T1'], ['B1'], 3)).toEqual([])
    expect(generateSchedule(ids('T', 4), [], 3)).toEqual([])
    expect(generateSchedule(ids('T', 4), ids('B', 2), 0)).toEqual([])
  })
})

describe('analyzeSchedule', () => {
  const teams = ids('T', 4).map((id) => ({ id, name: `Grupo ${id}` }))
  const bases = ids('B', 2).map((id) => ({ id, name: `Base ${id}` }))

  it('is clean for a full round robin with enough bases', () => {
    const matches = generateSchedule(teams.map((t) => t.id), ['B1', 'B2', 'B3'], 3)
    const result = analyzeSchedule(matches, teams, [...bases, { id: 'B3', name: 'Base B3' }])
    expect(result.pairsTotal).toBe(6)
    expect(result.pairsPlanned).toBe(6)
  })

  it('reports a group with no match, resting groups and a base visited twice', () => {
    const matches: PlannedMatch[] = [
      { round_number: 1, base_id: 'B1', team_a: 'T1', team_b: 'T2' },
      { round_number: 2, base_id: 'B1', team_a: 'T1', team_b: 'T3' },
    ]
    const warnings = analyzeSchedule(matches, teams, bases).warnings.join(' | ')
    expect(warnings).toContain('"Grupo T4" no tiene ningún cruce')
    expect(warnings).toContain('"Grupo T2" descansa en 1 ronda')
    expect(warnings).toContain('"Grupo T1" pasa 2 veces por la base "Base B1"')
  })
})

describe('currentRound', () => {
  it('is round 1 with no matches', () => expect(currentRound([])).toBe(1))
  it('is the first round with an unfinished match', () => {
    expect(currentRound([{ round_number: 1, status: 'finished' }, { round_number: 2, status: 'in_progress' }, { round_number: 3, status: 'pending' }])).toBe(2)
  })
  it('is the last round when everything is finished', () => {
    expect(currentRound([{ round_number: 1, status: 'finished' }, { round_number: 4, status: 'finished' }])).toBe(4)
  })
})

describe('matchErrorMessage (Spanish messages for the database errors)', () => {
  it.each([
    ['duplicate key value violates unique constraint "matches_no_repeat_pair"', 'Esos dos grupos ya se enfrentan en otra ronda.'],
    ['Un grupo no puede estar en dos bases durante la misma ronda.', 'Un grupo no puede estar en dos bases durante la misma ronda.'],
    ['duplicate key value violates unique constraint "matches_base_id_round_number_key"', 'Esa base ya tiene un cruce en esa ronda.'],
    ['something else', 'No se pudo guardar el cruce.'],
  ])('%s', (message, expected) => expect(matchErrorMessage(message)).toBe(expected))
})

describe('formatTime', () => {
  it('formats the hour for Colombia', () => expect(formatTime('2027-01-20T15:30:00Z')).toMatch(/\d{1,2}:\d{2}/))
})
