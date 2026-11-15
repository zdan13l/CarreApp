export type UserRole = 'admin' | 'base' | 'runner'

export interface Profile {
  id: string
  username: string
  full_name: string
  role: UserRole
}
