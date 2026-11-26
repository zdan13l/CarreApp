// api/users.ts: only the coordinator may create, reset or delete users.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockReq, mockRes, queryBuilder } from './fakes'

const state = vi.hoisted(() => ({
  user: { id: 'caller-1' } as { id: string } | null,
  authError: null as { message: string } | null,
  callerRole: 'admin' as string | null,
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  updateUserById: vi.fn(),
  insertProfile: vi.fn(),
  insertPassport: vi.fn(),
  updatePassport: vi.fn(),
  passportUsername: 'viejo.usuario' as string | null,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.authError }),
      admin: { createUser: state.createUser, deleteUser: state.deleteUser, updateUserById: state.updateUserById },
    },
    from: (table: string) => {
      if (table !== 'profiles' && table !== 'passports') throw new Error(`unexpected table ${table}`)
      const select = queryBuilder(() => ({ data: table === 'passports' ? (state.passportUsername ? { id: 'p', username: state.passportUsername } : null) : state.callerRole ? { role: state.callerRole } : null }))
      const insert = table === 'passports' ? state.insertPassport : state.insertProfile
      return { select: select.select, insert: (row: unknown) => Promise.resolve(insert(row)), update: (row: unknown) => ({ eq: () => Promise.resolve(state.updatePassport(row)) }) }
    },
  }),
}))

import handler from '../../api/users'

const authed = { authorization: 'Bearer good-token' }
const call = async (method: string, body: unknown, headers: Record<string, string> = authed) => {
  const res = mockRes()
  await handler(mockReq({ method, headers, body }), res)
  return res
}

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  state.user = { id: 'caller-1' }
  state.authError = null
  state.callerRole = 'admin'
  state.createUser.mockReset().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null })
  state.deleteUser.mockReset().mockResolvedValue({ error: null })
  state.updateUserById.mockReset().mockResolvedValue({ error: null })
  state.insertProfile.mockReset().mockReturnValue({ error: null })
  state.insertPassport.mockReset().mockReturnValue({ error: null })
  state.updatePassport.mockReset().mockReturnValue({ error: null })
  state.passportUsername = 'viejo.usuario'
})

describe('authentication and authorization', () => {
  it('refuses to run without its server configuration', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect((await call('POST', {})).statusCode).toBe(500)
  })

  it('rejects a request without a token (401) or with an invalid one (401)', async () => {
    expect((await call('POST', {}, {})).statusCode).toBe(401)
    state.user = null
    state.authError = { message: 'bad jwt' }
    expect((await call('POST', {})).statusCode).toBe(401)
  })

  it.each(['runner', 'base', null])('rejects a caller whose role is %s (403)', async (role) => {
    state.callerRole = role
    const res = await call('POST', { username: 'valido', password: 'secreto1', full_name: 'X', role: 'runner' })
    expect(res.statusCode).toBe(403)
    expect(state.createUser).not.toHaveBeenCalled()
  })
})

describe('POST: create a user', () => {
  const valid = { username: '  Nuevo.Usuario ', password: 'secreto1', full_name: ' Nuevo Usuario ', role: 'runner' }

  it('creates the account with the internal email and the profile, normalising the input', async () => {
    const res = await call('POST', valid)
    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({ id: 'new-user', username: 'nuevo.usuario', full_name: 'Nuevo Usuario', role: 'runner' })
    expect(state.createUser).toHaveBeenCalledWith({ email: 'nuevo.usuario@carreapp.test', password: 'secreto1', email_confirm: true })
    expect(state.insertProfile).toHaveBeenCalledWith({ id: 'new-user', username: 'nuevo.usuario', full_name: 'Nuevo Usuario', role: 'runner', event_id: null })
  })

  it('accepts the ñ in the @: the login email carries it as «+», the profile keeps it as written', async () => {
    const res = await call('POST', { ...valid, username: ' Daniela.Muñoz ' })
    expect(res.statusCode).toBe(201)
    expect(state.createUser).toHaveBeenCalledWith({ email: 'daniela.mu+oz@carreapp.test', password: 'secreto1', email_confirm: true })
    expect(state.insertProfile).toHaveBeenCalledWith(expect.objectContaining({ username: 'daniela.muñoz' }))
  })

  it('stores the Carrera of a runner, but never gives one to a coordinator', async () => {
    await call('POST', { ...valid, event_id: 'evt-1' })
    expect(state.insertProfile).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'runner', event_id: 'evt-1' }))
    await call('POST', { ...valid, username: 'otro.admin', role: 'admin', event_id: 'evt-1' })
    expect(state.insertProfile).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'admin', event_id: null }))
  })

  it.each([
    [{ ...valid, username: 'ab' }, /3-30 caracteres/],
    [{ ...valid, username: 'con espacio' }, /3-30 caracteres/],
    [{ ...valid, password: '12345' }, /al menos 6/],
    [{ ...valid, full_name: '   ' }, /nombre es obligatorio/],
    [{ ...valid, role: 'superadmin' }, /Rol inválido/],
  ])('validates the input %#', async (body, message) => {
    const res = await call('POST', body)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toMatch(message)
    expect(state.createUser).not.toHaveBeenCalled()
  })

  it('answers 409 when the username already exists', async () => {
    state.createUser.mockResolvedValue({ data: { user: null }, error: { message: 'User already registered' } })
    const res = await call('POST', valid)
    expect(res.statusCode).toBe(409)
    expect((res.body as { error: string }).error).toContain('Ese usuario ya existe')
  })

  it('rolls the account back when the profile cannot be written, so no orphan login remains', async () => {
    state.insertProfile.mockReturnValue({ error: { message: 'profile failed' } })
    const res = await call('POST', valid)
    expect(res.statusCode).toBe(500)
    expect(state.deleteUser).toHaveBeenCalledWith('new-user')
  })

  it('lets the coordinator create another coordinator (handover to the next committee)', async () => {
    expect((await call('POST', { ...valid, role: 'admin' })).statusCode).toBe(201)
  })
})

describe('POST: the personal passport of an inductor (role "member")', () => {
  const member = { username: 'Ana.Gomez', password: 'D3lF1nZ4p4t00482', full_name: 'Ana Gómez', role: 'member', event_id: 'evt-1' }

  it('creates the login and a passport row, with no profile and no Carrera', async () => {
    const res = await call('POST', member)
    expect(res.statusCode).toBe(201)
    expect(state.createUser).toHaveBeenCalledWith({ email: 'ana.gomez@carreapp.test', password: 'D3lF1nZ4p4t00482', email_confirm: true })
    expect(state.insertPassport).toHaveBeenCalledWith({ id: 'new-user', username: 'ana.gomez', full_name: 'Ana Gómez' })
    expect(state.insertProfile).not.toHaveBeenCalled() // a profile would open the live operation to it
  })

  it('rolls the login back when the passport cannot be written (and says the migration may be missing)', async () => {
    state.insertPassport.mockReturnValue({ error: { message: 'relation "passports" does not exist' } })
    const res = await call('POST', member)
    expect(res.statusCode).toBe(500)
    expect((res.body as { error: string }).error).toMatch(/0023/)
    expect(state.deleteUser).toHaveBeenCalledWith('new-user')
  })

  it('is only for the coordinator', async () => {
    state.callerRole = 'runner'
    expect((await call('POST', member)).statusCode).toBe(403)
    expect(state.insertPassport).not.toHaveBeenCalled()
  })
})

describe('PATCH: reset a password', () => {
  it('changes it', async () => {
    const res = await call('PATCH', { user_id: 'u1', password: 'nuevaclave' })
    expect(res.statusCode).toBe(200)
    expect(state.updateUserById).toHaveBeenCalledWith('u1', { password: 'nuevaclave' })
  })
  it.each([[{ password: 'nuevaclave' }, /Falta el usuario/], [{ user_id: 'u1', password: '123' }, /al menos 6/]])('validates %j', async (body, message) => {
    const res = await call('PATCH', body)
    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toMatch(message)
  })
  it('reports a failure from the auth service', async () => {
    state.updateUserById.mockResolvedValue({ error: { message: 'boom' } })
    expect((await call('PATCH', { user_id: 'u1', password: 'nuevaclave' })).statusCode).toBe(500)
  })
})

describe('PATCH: change the @ of a personal passport', () => {
  it('changes the login and the row together, normalising the @', async () => {
    const res = await call('PATCH', { user_id: 'u1', username: ' @Nuevo.Usuario ' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, username: 'nuevo.usuario' })
    expect(state.updateUserById).toHaveBeenCalledWith('u1', { email: 'nuevo.usuario@carreapp.test', email_confirm: true })
    expect(state.updatePassport).toHaveBeenCalledWith({ username: 'nuevo.usuario' })
  })
  it('changes an @ to one with ñ (the ñ written as n + tilde is the same one)', async () => {
    const res = await call('PATCH', { user_id: 'u1', username: 'Muñoz.perez' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, username: 'muñoz.perez' })
    expect(state.updateUserById).toHaveBeenCalledWith('u1', { email: 'mu+oz.perez@carreapp.test', email_confirm: true })
  })
  it('validates the @, needs something to change and only works on a passport', async () => {
    expect((await call('PATCH', { user_id: 'u1', username: 'ab' })).statusCode).toBe(400)
    expect((await call('PATCH', { user_id: 'u1' })).statusCode).toBe(400)
    state.passportUsername = null
    expect((await call('PATCH', { user_id: 'u1', username: 'valido' })).statusCode).toBe(404)
    expect(state.updateUserById).not.toHaveBeenCalled()
  })
  it('answers 409 when the @ is taken, and puts the old login back when the row is refused', async () => {
    state.updateUserById.mockResolvedValueOnce({ error: { message: 'A user with this email address has already been registered' } })
    expect((await call('PATCH', { user_id: 'u1', username: 'tomado' })).statusCode).toBe(409)
    state.updateUserById.mockReset().mockResolvedValue({ error: null })
    state.updatePassport.mockReturnValue({ error: { message: 'duplicate key value violates unique constraint' } })
    const res = await call('PATCH', { user_id: 'u1', username: 'tomado' })
    expect(res.statusCode).toBe(409)
    expect(state.updateUserById).toHaveBeenLastCalledWith('u1', { email: 'viejo.usuario@carreapp.test', email_confirm: true })
  })
  it('can change the @ and the password in one go', async () => {
    expect((await call('PATCH', { user_id: 'u1', username: 'nuevo.usuario', password: 'nuevaclave' })).statusCode).toBe(200)
    expect(state.updateUserById).toHaveBeenLastCalledWith('u1', { password: 'nuevaclave' })
  })
})

describe('DELETE: remove a user', () => {
  it('deletes another user', async () => {
    expect((await call('DELETE', { user_id: 'u1' })).statusCode).toBe(200)
    expect(state.deleteUser).toHaveBeenCalledWith('u1')
  })
  it('never lets the coordinator delete their own account', async () => {
    const res = await call('DELETE', { user_id: 'caller-1' })
    expect(res.statusCode).toBe(400)
    expect(state.deleteUser).not.toHaveBeenCalled()
  })
  it('needs a user', async () => {
    expect((await call('DELETE', {})).statusCode).toBe(400)
  })
})

describe('other methods', () => {
  it('answers 405 and lists the allowed ones', async () => {
    const res = await call('GET', undefined)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST, PATCH, DELETE')
  })
})
