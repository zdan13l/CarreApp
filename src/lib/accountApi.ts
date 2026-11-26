import { apiFetch } from './apiFetch'

// An inductor changes their own @ and password through the server (api/account.ts): it asks for the current password.
export async function updateAccount(body: { current_password: string; username?: string; new_password?: string }): Promise<{ username: string }> {
  const res = await apiFetch('/api/account', { method: 'PATCH', body })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error ?? 'No se pudo completar la acción.')
  return payload as { username: string }
}
