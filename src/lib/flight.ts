// The airport vocabulary of the app, built only from real data: every group is a "flight" with a call sign, every base is a
// "destination" with a three-letter code, and a group's journey has a status taken from its matches. Nothing here is stored
// or invented: it is derived from the groups, bases and matches the screens already read.
import type { MatchScore, MatchStatus } from '../types'
import { SCORE_ITEMS } from '../types'

const STOP = new Set(['DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'EN', 'A'])

const clean = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .trim()

/** Three-letter code of a destination, like an airport: "Biblioteca" -> BIB, "Cancha de Fútbol" -> CFU. */
export function airportCode(name: string): string {
  const words = clean(name).split(/\s+/).filter((w) => w && !STOP.has(w))
  if (words.length === 0) return '???'
  if (words.length === 1) return words[0].padEnd(3, 'X').slice(0, 3)
  if (words.length === 2) return (words[0][0] + words[1].slice(0, 2)).padEnd(3, 'X')
  return (words[0][0] + words[1][0] + words[2][0]).slice(0, 3)
}

/** The call sign of every group: JV 213, JV 226… Sorted by name so the runner, the base and the coordinator all see the same one. */
export function flightCodes(teams: { id: string; name: string }[]): Map<string, string> {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
  return new Map(sorted.map((t, i) => [t.id, `JV ${200 + i * 13}`]))
}

export interface JourneyMatch {
  id: string
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null
  finished_at: string | null
  match_scores?: MatchScore[]
}

export type FlightState = 'sin-itinerario' | 'en-ruta' | 'en-puerta' | 'aterrizado'

export const FLIGHT_LABEL: Record<FlightState | 'demora', string> = {
  'sin-itinerario': 'Sin itinerario',
  'en-ruta': 'En ruta',
  'en-puerta': 'En puerta',
  aterrizado: 'Aterrizado',
  demora: 'Demora',
}

export interface Flight {
  teamId: string
  state: FlightState
  current: JourneyMatch | null // the match the group is travelling to, or playing now
  completed: number
  total: number
  lastStamp: string | null // when the last destination was completed
}

/** Where a group is in its journey: heading to a base, at the gate (the base confirmed the arrival), or landed (all matches done). */
export function flightOf(teamId: string, matches: JourneyMatch[]): Flight {
  const mine = matches.filter((m) => m.team_a === teamId || m.team_b === teamId).sort((a, b) => a.round_number - b.round_number)
  const current = mine.find((m) => m.status !== 'finished') ?? null
  const completed = mine.filter((m) => m.status === 'finished').length
  const lastStamp = mine.filter((m) => m.finished_at).map((m) => m.finished_at!).sort().pop() ?? null
  let state: FlightState = 'sin-itinerario'
  if (mine.length > 0) state = !current ? 'aterrizado' : current.arrived_at || current.status === 'in_progress' ? 'en-puerta' : 'en-ruta'
  return { teamId, state, current, completed, total: mine.length, lastStamp }
}

export type StageState = 'done' | 'active' | 'todo'

/** The three stages of a base (barra, pregunta, minijuego): done once the base has scored it, whoever won or if it was voided. */
export function stageStates(scores: MatchScore[], atGate: boolean): { item: (typeof SCORE_ITEMS)[number]; state: StageState }[] {
  let activeSet = false
  return SCORE_ITEMS.map((item) => {
    if (scores.some((s) => s.item === item)) return { item, state: 'done' as const }
    if (atGate && !activeSet) {
      activeSet = true
      return { item, state: 'active' as const }
    }
    return { item, state: 'todo' as const }
  })
}
