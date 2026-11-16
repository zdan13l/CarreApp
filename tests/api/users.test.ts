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
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: state.authError }),
      admin: { createUser: state.createUser, deleteUser: state.deleteUser, updateUserById: state.updateUserById },
    },
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`unexpected table ${table}`)
      const select = queryBuilder(() => ({ data: state.callerRole ? { role: state.callerRole } : null }))
      return { select: select.select, insert: (row: unknown) => Promise.resolve(state.insertProfile(row)) }
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
