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

// A team is "late" when its previous match finished more than the time allowed for that leg
// (`travel`, from one base to the next; `maxMinutes` when the leg has no time of its own) ago and the base has
// not yet confirmed that both teams arrived for the next one. Computed on each device from the
// shared data, so no server job is needed.
export function lateTeams(
  matches: TimedMatch[],
  maxMinutes: number,
  now: number,
  travel: Map<string, number> = new Map(),
): LateTeam[] {
  const late: LateTeam[] = []
  for (const m of matches) {
    if (m.status !== 'pending' || m.arrived_at) continue
    for (const teamId of [m.team_a, m.team_b]) {
      const prev = matches
        .filter((x) => x.round_number < m.round_number && (x.team_a === teamId || x.team_b === teamId))
        .sort((x, y) => y.round_number - x.round_number)[0]
      if (!prev || prev.status !== 'finished' || !prev.finished_at) continue
      const allowed = travel.get(legKey(prev.base_id, m.base_id)) ?? maxMinutes
      const elapsedMin = Math.floor((now - new Date(prev.finished_at).getTime()) / 60000)
      if (elapsedMin >= allowed) late.push({ matchId: m.id, teamId, elapsedMin, overMin: elapsedMin - allowed, maxMin: allowed })
    }
  }
  return late
}

export const DEFAULT_ALERT_MESSAGE = 'Llevan mucho tiempo en el traslado. ¡Apúrense hacia la base!'
