// Edge cases of the delay alert found in the third QA review (device clock, groups that rest a round).
import { describe, expect, it } from 'vitest'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'

const NOW = Date.parse('2027-01-20T15:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60000).toISOString()
const match = (id: string, round: number, base: string, a: string, b: string, o: Partial<TimedMatch> = {}): TimedMatch => ({
  id, round_number: round, base_id: base, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null, ...o,
})

describe('lateTeams: clock of the phone', () => {
  const walk = [
    match('m1', 1, 'b0', 'A', 'B', { status: 'finished', finished_at: minutesAgo(7) }),
    match('m2', 2, 'b1', 'A', 'C'),
  ]
  it('a phone whose clock is 4 minutes ahead raises a FALSE alarm (the server clock would not); one 4 minutes behind hides a real one', () => {
    expect(lateTeams(walk, 10, NOW, new Map())).toHaveLength(0)
    expect(lateTeams(walk, 10, NOW + 4 * 60000, new Map())).toHaveLength(1)
    const real = [match('m1', 1, 'b0', 'A', 'B', { status: 'finished', finished_at: minutesAgo(12) }), match('m2', 2, 'b1', 'A', 'C')]
    expect(lateTeams(real, 10, NOW, new Map())).toHaveLength(1)
    expect(lateTeams(real, 10, NOW - 4 * 60000, new Map())).toHaveLength(0)
  })
})

describe('lateTeams: a group that RESTS a round', () => {
  // A plays R1 at b0, rests in R2 (5 groups / odd number), plays R3 at b1. R2 is still being played by the others.
  const resting = [
    match('m1', 1, 'b0', 'A', 'B', { status: 'finished', finished_at: minutesAgo(14) }),
    match('m2', 2, 'b2', 'B', 'C', { status: 'in_progress', arrived_at: minutesAgo(5) }),
    match('m3', 3, 'b1', 'A', 'C'),
  ]
  it('does not count the rest as walking: A is not "late" for R3 while it rests', () => {
    const late = lateTeams(resting, 10, NOW, new Map())
    expect(late.map((l) => `${l.teamId}:${l.matchId}`)).not.toContain('A:m3')
  })
})
