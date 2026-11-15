export type UserRole = 'admin' | 'base' | 'runner'

export interface Profile {
  id: string
  username: string
  full_name: string
  role: UserRole
}

export interface EventRow {
  id: string
  name: string
  is_active: boolean
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

export interface BaseQuestion {
  position: number
  question: string
}

export interface BaseRow {
  id: string
  name: string
  location_photo_path: string | null
  info: string | null
  sort_order: number
  base_questions: BaseQuestion[]
  base_staff: { user_id: string }[]
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Coordinador',
  base: 'Inductor de base',
  runner: 'Corredor',
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
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En juego',
  finished: 'Terminado',
}

export type ScoreItem = 'barra' | 'pregunta' | 'minijuego'
export const SCORE_ITEMS: ScoreItem[] = ['barra', 'pregunta', 'minijuego']
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
