// Serverless endpoint (Vercel) to manage users. It needs the Supabase service-role key,
// which must NEVER reach the browser, so user creation/deletion lives here.
//   POST   /api/users  { username, password, full_name, role, event_id? } -> create user + profile (event_id: the Carrera of a runner/inductor)
//   PATCH  /api/users  { user_id, password }                    -> reset password
//   DELETE /api/users  { user_id }                              -> delete user
// Only callers whose profile has role "admin" are allowed.
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const EMAIL_DOMAIN = 'carreapp.test'
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/
const ROLES = ['admin', 'base', 'runner']
const MIN_PASSWORD_LENGTH = 6

function fail(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return fail(res, 500, 'Servidor sin configurar.')

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1) Authenticate the caller and make sure they are an admin.
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(res, 401, 'No autenticado.')
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return fail(res, 401, 'Sesión inválida.')
  const callerId = userData.user.id
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .maybeSingle()
  if (callerProfile?.role !== 'admin') return fail(res, 403, 'Solo el coordinador puede hacer esto.')

  const body = (typeof req.body === 'object' && req.body) || {}

  // 2) Dispatch by method.
  if (req.method === 'POST') {
    const username = String(body.username ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const role = String(body.role ?? '')
    const eventId = role === 'admin' || !body.event_id ? null : String(body.event_id)

    if (!USERNAME_PATTERN.test(username))
      return fail(res, 400, 'El usuario debe tener 3-30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
    if (password.length < MIN_PASSWORD_LENGTH)
      return fail(res, 400, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    if (!fullName) return fail(res, 400, 'El nombre es obligatorio.')
    if (!ROLES.includes(role)) return fail(res, 400, 'Rol inválido.')

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
    })
    if (createError || !created.user) {
      const taken = /already|registered|exists/i.test(createError?.message ?? '')
      return fail(res, taken ? 409 : 500, taken ? 'Ese usuario ya existe (los nombres de usuario son únicos en todas las Carreras: prueba con otro, por ejemplo con el año).' : 'No se pudo crear el usuario.')
    }

    const { error: profileError } = await admin
      .from('profiles')
      .insert({ id: created.user.id, username, full_name: fullName, role, event_id: eventId })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id) // roll back
      return fail(res, 500, 'No se pudo crear el perfil del usuario.')
    }
    return res.status(201).json({ id: created.user.id, username, full_name: fullName, role })
  }

  if (req.method === 'PATCH') {
    const userId = String(body.user_id ?? '')
    const password = String(body.password ?? '')
    if (!userId) return fail(res, 400, 'Falta el usuario.')
    if (password.length < MIN_PASSWORD_LENGTH)
      return fail(res, 400, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return fail(res, 500, 'No se pudo cambiar la contraseña.')
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const userId = String(body.user_id ?? '')
    if (!userId) return fail(res, 400, 'Falta el usuario.')
    if (userId === callerId) return fail(res, 400, 'No puedes eliminar tu propio usuario.')
    const { error } = await admin.auth.admin.deleteUser(userId) // profile cascades
    if (error) return fail(res, 500, 'No se pudo eliminar el usuario.')
    return res.status(200).json({ ok: true })
  }

  res.setHeader('Allow', 'POST, PATCH, DELETE')
  return fail(res, 405, 'Método no permitido.')
}
