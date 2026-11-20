// Serverless endpoint (Vercel) so an inductor can change THEIR OWN @ and password (the personal passport login, migration 0023).
// It needs the Supabase service-role key (an email cannot be changed from the browser without a confirmation mail), so it lives here.
//   PATCH /api/account  { current_password, username?, new_password? }
// The caller proves who they are with their token AND with their current password (checked with the public key, like a sign-in);
// only logins that have a row in public.passports are served: the group, base and coordinator users are managed by the coordinator.
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EMAIL_DOMAIN = 'carreapp.test'
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/
const MIN_PASSWORD_LENGTH = 8

function fail(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return fail(res, 405, 'Método no permitido.')
  }
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) return fail(res, 500, 'Servidor sin configurar.')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1) Who is calling: a login of the personal passport.
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'No autenticado.')
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return fail(res, 401, 'Sesión inválida.')
  const user = userData.user
  const { data: passport } = await admin.from('passports').select('id, username').eq('id', user.id).maybeSingle()
  if (!passport) return fail(res, 403, 'Esta cuenta no es un pasaporte personal.')

  const body = (typeof req.body === 'object' && req.body) || {}
  const current = String(body.current_password ?? '')
  const username = body.username === undefined ? null : String(body.username).trim().toLowerCase().replace(/^@/, '')
  const newPassword = body.new_password === undefined ? null : String(body.new_password)

  if (!current) return fail(res, 400, 'Escribe tu contraseña actual.')
  if (username === null && newPassword === null) return fail(res, 400, 'No hay nada que cambiar.')
  if (username !== null && !USERNAME_PATTERN.test(username))
    return fail(res, 400, 'El usuario debe tener 3-30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
  if (newPassword !== null && newPassword.length < MIN_PASSWORD_LENGTH)
    return fail(res, 400, `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)

  // 2) The current password, checked like a sign-in with the public key (this client keeps no session).
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error: signInError } = await anon.auth.signInWithPassword({ email: user.email ?? `${passport.username}@${EMAIL_DOMAIN}`, password: current })
  if (signInError) return fail(res, 403, 'La contraseña actual no es correcta.')

  // 3) The changes.
  let changedUsername = passport.username as string
  if (username !== null && username !== passport.username) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { email: `${username}@${EMAIL_DOMAIN}`, email_confirm: true })
    if (error) {
      const taken = /already|registered|exists|duplicate/i.test(error.message ?? '')
      return fail(res, taken ? 409 : 500, taken ? 'Ese usuario ya existe: prueba con otro.' : 'No se pudo cambiar el usuario.')
    }
    const { error: rowError } = await admin.from('passports').update({ username }).eq('id', user.id)
    if (rowError) {
      await admin.auth.admin.updateUserById(user.id, { email: user.email ?? `${passport.username}@${EMAIL_DOMAIN}`, email_confirm: true }) // undo
      const taken = /duplicate|unique/i.test(rowError.message ?? '')
      return fail(res, taken ? 409 : 500, taken ? 'Ese usuario ya existe: prueba con otro.' : 'No se pudo cambiar el usuario.')
    }
    changedUsername = username
  }
  if (newPassword !== null) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword })
    if (error) return fail(res, 500, 'No se pudo cambiar la contraseña.')
  }
  return res.status(200).json({ ok: true, username: changedUsername })
}
