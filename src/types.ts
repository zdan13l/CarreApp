// 'member' is the personal passport of an inductor (no profile row: it lives in public.passports, migration 0023)
export type UserRole = 'admin' | 'base' | 'runner' | 'member'

export interface Profile {
  id: string
  username: string
  full_name: string
  role: UserRole
  event_id?: string | null
  photo_path?: string | null
}

// A Carrera is Deshabilitada (draft or history) -> Habilitada (ready, buttons off, tutorial) -> Iniciada (the time runs) -> Terminada (locked, to validate).
export type EventPhase = 'disabled' | 'enabled' | 'started' | 'finished'

export interface EventRow {
  id: string
  name: string
  is_active: boolean
  phase: EventPhase
  started_at: string | null
  max_travel_minutes: number
}

export interface TeamRunner {
  user_id: string
  is_gps_tracker: boolean
}

export interface TeamRow {
  id: string
  name: string
  photo_path: string | null
  sort_order: number
  team_runners: TeamRunner[]
}

// PostgREST returns a one-to-one embed as an object (or an array in some versions).
export type InfoEmbed = { info: string | null } | { info: string | null }[] | null

export function infoOf(d: InfoEmbed | undefined): string | null {
  if (!d) return null
  return Array.isArray(d) ? (d[0]?.info ?? null) : d.info
}

export interface BaseQuestion {
  position: number
  question: string
  answer?: string | null // migration 0030
}

export const MIN_QUESTIONS = 5 // a base needs at least this many questions, each with its answer, to activate the Carrera
export const MAX_QUESTIONS = 10

export interface BaseRow {
  id: string
  name: string
  location_photo_path: string | null
  lat: number | null
  lng: number | null
  base_details: InfoEmbed // private info: only admin and the base's inductors can read it
  sort_order: number
  base_questions: BaseQuestion[]
  base_staff: { user_id: string }[]
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Coordinador',
  base: 'Inductor de base',
  runner: 'Corredor',
  member: 'Inductor',
}

export type MatchStatus = 'pending' | 'in_progress' | 'finished'

export interface MatchRow {
  id: string
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  status: MatchStatus
  arrived_at: string | null // when the base confirmed both teams arrived
  finished_at: string | null // when its 3 items were scored or voided
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En juego',
  finished: 'Terminado',
}

export type ScoreItem = 'barra' | 'pregunta' | 'minijuego'
export const SCORE_ITEMS: ScoreItem[] = ['minijuego', 'pregunta', 'barra'] // the order they are played and scored in
export const ITEM_LABEL: Record<ScoreItem, string> = {
  barra: 'Barra',
  pregunta: 'Pregunta',
  minijuego: 'Minijuego',
}

export interface MatchScore {
  item: ScoreItem
  winner_team_id: string | null // null only when the item is voided
  voided: boolean // the coordinator cancelled this item (e.g. no time): nobody scores
}

export interface StandingRow {
  team_id: string
  name: string
  photo_path: string | null
  points: number
}
