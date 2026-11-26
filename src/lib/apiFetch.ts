import { supabase } from './supabase'

// Calls one of our serverless endpoints (/api/*) as the person who is signed in.
// The server checks the token against Supabase, so a token that the phone still believes is alive can be refused (an expired one
// while the clock of the computer is off, a session renewed in another tab…): on a 401 the session is renewed ONCE and the call is
// repeated before telling the person to sign in again.
export async function apiFetch(path: string, init: { method: 'POST' | 'PATCH' | 'DELETE'; body: object }): Promise<Response> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesión expirada. Vuelve a entrar.')

  const send = (bearer: string) =>
    fetch(path, {
      method: init.method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(init.body),
    })

  const first = await send(token)
  if (first.status !== 401) return first

  const { data: renewed } = await supabase.auth.refreshSession()
  const fresh = renewed.session?.access_token
  if (!fresh) throw new Error('Tu sesión venció: cierra sesión y vuelve a entrar.')
  const second = await send(fresh)
  if (second.status === 401) throw new Error('Tu sesión ya no es válida: cierra sesión y vuelve a entrar.')
  return second
}
