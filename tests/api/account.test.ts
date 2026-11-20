// api/account.ts: an inductor changes THEIR OWN @ and password, proving who they are with the token and the current password.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockReq, mockRes, queryBuilder } from './fakes'

const state = vi.hoisted(() => ({
  user: { id: 'me', email: 'ana.gomez@carreapp.test' } as { id: string; email: string } | null,
  authError: null as { message: string } | null,
  passport: { id: 'me', username: 'ana.gomez' } as { id: string; username: string } | null,
  signIn: vi.fn(),
  updateUserById: vi.fn(),
  updatePassport: vi.fn(),
  clients: [] as string[],
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => {
    state.clients.push(key)
    return {
      auth: {
        getUser: async () => ({ data: { user: state.user }, error: state.authError }),
        signInWithPassword: state.signIn,
        admin: { updateUserById: state.updateUserById },
      },
      from: (table: string) => {
        if (table !== 'passports') throw new Error(`unexpected table ${table}`)
        const select = queryBuilder(() => ({ data: state.passport }))
        return { select: select.select, update: () => ({ eq: () => Promise.resolve(state.updatePassport()) }) }
      },
    }
  },
}))

import handler from '../../api/account'

const authed = { authorization: 'Bearer good-token' }
const call = async (body: unknown, headers: Record<string, string> = authed, method = 'PATCH') => {
  const res = mockRes()
  await handler(mockReq({ method, headers, body }), res)
  return res
}
const error = (r: { body: unknown }) => (r.body as { error: string }).error

beforeEach(() => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
  state.user = { id: 'me', email: 'ana.gomez@carreapp.test' }
  state.authError = null
  state.passport = { id: 'me', username: 'ana.gomez' }
  state.clients.length = 0
  state.signIn.mockReset().mockResolvedValue({ error: null })
  state.updateUserById.mockReset().mockResolvedValue({ error: null })
  state.updatePassport.mockReset().mockReturnValue({ error: null })
})

describe('who can call it', () => {
  it('only PATCH', async () => {
    const res = await call({}, authed, 'POST')
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('PATCH')
  })
  it('refuses to run without its server configuration (also without the public key)', async () => {
    delete process.env.VITE_SUPABASE_ANON_KEY
    expect((await call({ current_password: 'x', new_password: 'otraclave1' })).statusCode).toBe(500)
  })
  it('needs a valid token', async () => {
    expect((await call({}, {})).statusCode).toBe(401)
    state.user = null
    state.authError = { message: 'bad jwt' }
    expect((await call({ current_password: 'x', new_password: 'otraclave1' })).statusCode).toBe(401)
  })
  it('is only for the personal passports: the group, base and coordinator logins are managed by the coordinator', async () => {
    state.passport = null
    const res = await call({ current_password: 'x', new_password: 'otraclave1' })
    expect(res.statusCode).toBe(403)
    expect(state.updateUserById).not.toHaveBeenCalled()
  })
})

describe('the current password', () => {
  it('is required and checked like a sign-in with the PUBLIC key before anything changes', async () => {
    expect((await call({ new_password: 'otraclave1' })).statusCode).toBe(400)
    state.signIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await call({ current_password: 'mala', new_password: 'otraclave1' })
    expect(res.statusCode).toBe(403)
    expect(error(res)).toMatch(/contraseña actual/)
    expect(state.updateUserById).not.toHaveBeenCalled()
    expect(state.signIn).toHaveBeenCalledWith({ email: 'ana.gomez@carreapp.test', password: 'mala' })
    expect(state.clients).toContain('anon-key')
  })
})

describe('validation', () => {
  it.each([
    [{ current_password: 'x' }, /nada que cambiar/],
    [{ current_password: 'x', username: 'ab' }, /3-30 caracteres/],
    [{ current_password: 'x', username: 'con espacio' }, /3-30 caracteres/],
    [{ current_password: 'x', new_password: '1234567' }, /al menos 8/],
  ])('rejects %j', async (body, message) => {
    const res = await call(body)
    expect(res.statusCode).toBe(400)
    expect(error(res)).toMatch(message)
    expect(state.updateUserById).not.toHaveBeenCalled()
  })
})

describe('changing the @', () => {
  it('changes the login email and the passport together, normalising what was typed', async () => {
    const res = await call({ current_password: 'clave', username: '  @Ana.G ' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, username: 'ana.g' })
    expect(state.updateUserById).toHaveBeenCalledWith('me', { email: 'ana.g@carreapp.test', email_confirm: true })
    expect(state.updatePassport).toHaveBeenCalled()
  })

  it('answers 409 when the @ is taken (by another login) and changes nothing', async () => {
    state.updateUserById.mockResolvedValue({ error: { message: 'A user with this email address has already been registered' } })
    const res = await call({ current_password: 'clave', username: 'sara.ramirez' })
    expect(res.statusCode).toBe(409)
    expect(state.updatePassport).not.toHaveBeenCalled()
  })

  it('undoes the email when the passport row cannot take the new @ (no login out of step with its passport)', async () => {
    state.updatePassport.mockReturnValue({ error: { message: 'duplicate key value violates unique constraint' } })
    const res = await call({ current_password: 'clave', username: 'sara.ramirez' })
    expect(res.statusCode).toBe(409)
    expect(state.updateUserById).toHaveBeenLastCalledWith('me', { email: 'ana.gomez@carreapp.test', email_confirm: true })
  })

  it('the same @ again is not a change', async () => {
    const res = await call({ current_password: 'clave', username: 'ana.gomez' })
    expect(res.statusCode).toBe(200)
    expect(state.updateUserById).not.toHaveBeenCalled()
  })
})

describe('changing the password', () => {
  it('sets the new one', async () => {
    const res = await call({ current_password: 'clave', new_password: 'D3lF1nZ4p4t00482' })
    expect(res.statusCode).toBe(200)
    expect(state.updateUserById).toHaveBeenCalledWith('me', { password: 'D3lF1nZ4p4t00482' })
  })
  it('reports a failure of the auth service', async () => {
    state.updateUserById.mockResolvedValue({ error: { message: 'boom' } })
    expect((await call({ current_password: 'clave', new_password: 'otraclave1' })).statusCode).toBe(500)
  })
  it('can change both at once', async () => {
    const res = await call({ current_password: 'clave', username: 'ana.nueva', new_password: 'otraclave1' })
    expect(res.statusCode).toBe(200)
    expect(state.updateUserById).toHaveBeenCalledTimes(2)
  })
})
