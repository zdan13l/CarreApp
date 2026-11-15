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
