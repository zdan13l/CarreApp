import { supabase } from './supabase'
import type { UserRole } from '../types'

async function call(method: 'POST' | 'PATCH' | 'DELETE', body: object): Promise<{ id?: string }> {
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
  return res.json().catch(() => ({}))
}

export const createUser = (u: { username: string; password: string; full_name: string; role: UserRole; event_id?: string | null }) =>
  call('POST', u)
// The personal passport of an inductor: a login (the @) that opens only their passport, with no Carrera and no operation access.
export const createPassportUser = (u: { username: string; password: string; full_name: string }) =>
  call('POST', { ...u, role: 'member' })
export const resetPassword = (userId: string, password: string) =>
  call('PATCH', { user_id: userId, password })
// The coordi changes the @ of a person: the login follows it (the server changes both, and undoes the first if the second fails).
export const renameUser = (userId: string, username: string) => call('PATCH', { user_id: userId, username })
export const deleteUser = (userId: string) => call('DELETE', { user_id: userId })
