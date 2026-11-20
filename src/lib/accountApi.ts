import { supabase } from './supabase'

// An inductor changes their own @ and password through the server (api/account.ts): it asks for the current password.
export async function updateAccount(body: { current_password: string; username?: string; new_password?: string }): Promise<{ username: string }> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesión expirada. Vuelve a entrar.')
  const res = await fetch('/api/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error ?? 'No se pudo completar la acción.')
  return payload as { username: string }
}
