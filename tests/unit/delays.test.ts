import { describe, expect, it } from 'vitest'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'
import { legKey } from '../../src/lib/travel'

const NOW = Date.parse('2027-01-20T15:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60000).toISOString()

const match = (id: string, round: number, base: string, a: string, b: string, o: Partial<TimedMatch> = {}): TimedMatch => ({
  id, round_number: round, base_id: base, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null, ...o,
})
const finished = (id: string, round: number, base: string, a: string, b: string, ago: number) =>
  match(id, round, base, a, b, { status: 'finished', finished_at: minutesAgo(ago) })

describe('lateTeams', () => {
  // round 1: b0 (A,B) and b1 (C,D) finished 12 min ago; round 2: A and C walk to b2, B and D to b3
  const base = () => [
    finished('m1', 1, 'b0', 'A', 'B', 12),
    finished('m2', 1, 'b1', 'C', 'D', 12),
    match('m3', 2, 'b2', 'A', 'C'),
    match('m4', 2, 'b3', 'B', 'D'),
  ]

  it('is quiet while everybody is within the allowed time', () => {
    expect(lateTeams(base(), 15, NOW)).toEqual([])
  })

  it('flags every group that walked longer than the allowed time, with the minutes', () => {
    const late = lateTeams(base(), 10, NOW)
    expect(late.map((l) => l.teamId).sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(late[0]).toMatchObject({ elapsedMin: 12, overMin: 2, maxMin: 10 })
  })

  it('is late exactly AT the limit (>=), not before', () => {
    const matches = [finished('m1', 1, 'b0', 'A', 'B', 10), match('m2', 2, 'b1', 'A', 'B')]
    expect(lateTeams(matches, 10, NOW)).toHaveLength(2)
    expect(lateTeams([finished('m1', 1, 'b0', 'A', 'B', 9), match('m2', 2, 'b1', 'A', 'B')], 10, NOW)).toEqual([])
  })

  it('uses the time of the leg (from base -> to base) when it exists, else the general time', () => {
    const travel = new Map([[legKey('b0', 'b2'), 20], [legKey('b1', 'b3'), 5]])
    const late = lateTeams(base(), 10, NOW, travel)
    const byTeam = Object.fromEntries(late.map((l) => [l.teamId, l.maxMin]))
    expect(byTeam).toEqual({ B: 10, C: 10, D: 5 }) // A walks b0->b2 (20 min allowed): not late; D walks b1->b3 (5)
  })

  it('stops flagging a match when the base confirmed the arrival of both groups', () => {
    const matches = base()
    matches[2] = match('m3', 2, 'b2', 'A', 'C', { arrived_at: minutesAgo(1), status: 'in_progress' })
    expect(lateTeams(matches, 10, NOW).map((l) => l.matchId)).toEqual(['m4', 'm4'])
  })

  it('ignores round 1 and matches whose previous match is not finished yet', () => {
    expect(lateTeams([match('m1', 1, 'b0', 'A', 'B')], 1, NOW)).toEqual([])
    const unfinished = [match('m1', 1, 'b0', 'A', 'B', { status: 'in_progress' }), match('m2', 2, 'b1', 'A', 'B')]
    expect(lateTeams(unfinished, 1, NOW)).toEqual([])
  })

  it('measures from the group\'s LAST previous match, not an older one', () => {
    const matches = [
      finished('m1', 1, 'b0', 'A', 'B', 60),
      finished('m2', 2, 'b1', 'A', 'C', 2),
      match('m3', 3, 'b2', 'A', 'D'),
    ]
    expect(lateTeams(matches, 10, NOW).filter((l) => l.teamId === 'A')).toEqual([])
  })

  it('does NOT flag a group whose next match is at the base where it already is (it does not walk)', () => {
    // A and C stay at their base for round 2; B and D change base
    const matches = [
      finished('m1', 1, 'b0', 'A', 'B', 30),
      finished('m2', 1, 'b1', 'C', 'D', 30),
      match('m3', 2, 'b1', 'A', 'C'), // A walks b0->b1, C stays at b1
      match('m4', 2, 'b0', 'B', 'D'), // B stays at b0, D walks b1->b0
    ]
    expect(lateTeams(matches, 10, NOW).map((l) => l.teamId).sort()).toEqual(['A', 'D'])
  })
})
