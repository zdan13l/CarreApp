import { supabase } from './supabase'
import type { UserRole } from '../types'

async function call(method: 'POST' | 'PATCH' | 'DELETE', body: object): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesión expirada. Vuelve a entrar.')
  const res = await fetch('/api/users', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.error ?? 'No se pudo completar la acción.')
  }
}

export const createUser = (u: { username: string; password: string; full_name: string; role: UserRole }) =>
  call('POST', u)
export const resetPassword = (userId: string, password: string) =>
  call('PATCH', { user_id: userId, password })
export const deleteUser = (userId: string) => call('DELETE', { user_id: userId })
