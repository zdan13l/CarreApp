import type { MatchStatus } from '../types'
import { legKey } from './travel'

export interface TimedMatch {
  id: string
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  finished_at: string | null
}

export interface LateTeam {
  matchId: string
  teamId: string
  elapsedMin: number // minutes since the team finished its previous match
  overMin: number // minutes beyond the allowed travel time
  maxMin: number // the time allowed for this leg
}

// A team is "late" when it has to WALK to another base (a group that plays again at the base where it
// already is never is) and its previous match finished more than the time allowed for that leg
// (`travel`, from one base to the next; `maxMinutes` when the leg has no time of its own) ago and the base has
// not yet confirmed that both teams arrived for the next one. Computed on each device from the
// shared data, so no server job is needed.
// `rotations`: round -> the moment the coordinator announced its rotation (the groups only leave then). The walk counts from that moment when it
// is later than the end of the match (check_delays() does the same).
export type RotationTimes = Map<number, number>

export function lateTeams(
  matches: TimedMatch[],
  maxMinutes: number,
  now: number,
  travel: Map<string, number> = new Map(),
  rotations: RotationTimes = new Map(),
): LateTeam[] {
  const late: LateTeam[] = []
  for (const m of matches) {
    if (m.status !== 'pending' || m.arrived_at) continue
    for (const teamId of [m.team_a, m.team_b]) {
      const prev = matches
        .filter((x) => x.round_number < m.round_number && (x.team_a === teamId || x.team_b === teamId))
        .sort((x, y) => y.round_number - x.round_number)[0]
      if (!prev || prev.status !== 'finished' || !prev.finished_at) continue
      if (prev.round_number !== m.round_number - 1) continue // the group rested a round: it was not walking, so no deadline
      if (prev.base_id === m.base_id) continue // the group is already at that base: it does not walk, so it cannot be late
      const allowed = travel.get(legKey(prev.base_id, m.base_id)) ?? maxMinutes
      const since = Math.max(new Date(prev.finished_at).getTime(), rotations.get(prev.round_number) ?? 0)
      const elapsedMin = Math.floor((now - since) / 60000)
      if (elapsedMin >= allowed) late.push({ matchId: m.id, teamId, elapsedMin, overMin: elapsedMin - allowed, maxMin: allowed })
    }
  }
  return late
}

export const DEFAULT_ALERT_MESSAGE = 'Llevan mucho tiempo en el traslado. ¡Apúrense hacia la base!'

// What a base needs to know about ONE group walking to it: where it comes from and how long it may take. No clock inside (the screen
// brings its own `now`), so it can be computed once and counted down every second.
export type LegInfo =
  | { kind: 'walking'; fromBaseId: string | null; since: number; allowedMin: number } // walks here since `since` (null base: from the start of the Carrera)
  | { kind: 'stay' } // plays again at the base where it already is: nothing to wait for
  | { kind: 'waiting'; fromBaseId: string } // the previous match is not finished yet: the clock has not started
  | { kind: 'none' } // no clock: the Carrera has not started, or it rested the round before

// The walk starts when the coordinator announces the rotation of the previous round (or when its match ended, if that is later); a group
// with no previous match walks from the start of the Carrera (`startedAt`).
export function legInfo(
  matches: TimedMatch[],
  matchId: string,
  teamId: string,
  maxMinutes: number,
  travel: Map<string, number> = new Map(),
  rotations: RotationTimes = new Map(),
  startedAt: number | null = null,
): LegInfo {
  const m = matches.find((x) => x.id === matchId)
  if (!m) return { kind: 'none' }
  const prev = matches
    .filter((x) => x.round_number < m.round_number && (x.team_a === teamId || x.team_b === teamId))
    .sort((x, y) => y.round_number - x.round_number)[0]
  if (!prev) return startedAt === null ? { kind: 'none' } : { kind: 'walking', fromBaseId: null, since: startedAt, allowedMin: maxMinutes }
  if (prev.round_number !== m.round_number - 1) return { kind: 'none' }
  if (prev.base_id === m.base_id) return { kind: 'stay' }
  if (prev.status !== 'finished' || !prev.finished_at) return { kind: 'waiting', fromBaseId: prev.base_id }
  return {
    kind: 'walking',
    fromBaseId: prev.base_id,
    since: Math.max(new Date(prev.finished_at).getTime(), rotations.get(prev.round_number) ?? 0),
    allowedMin: travel.get(legKey(prev.base_id, m.base_id)) ?? maxMinutes,
  }
}

// Seconds left of the allowed time (negative once it is over).
export const legRemainingSec = (info: Extract<LegInfo, { kind: 'walking' }>, now: number) => Math.round((info.since + info.allowedMin * 60_000 - now) / 1000)

// 4:05 style clock for a number of seconds.
export function clockText(sec: number): string {
  const s = Math.abs(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
