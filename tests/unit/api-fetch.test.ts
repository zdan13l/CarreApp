// The calls to our own /api/* endpoints: a 401 renews the session once and repeats the call before asking the person to sign in again.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}))
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth } }))

import { apiFetch } from '../../src/lib/apiFetch'

const reply = (status: number) => new Response(JSON.stringify({}), { status })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  auth.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'old' } } })
  auth.refreshSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'new' } } })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const bearerOf = (call: number) => (fetchMock.mock.calls[call][1] as { headers: Record<string, string> }).headers.Authorization

describe('apiFetch', () => {
  it('sends the token of the session and does nothing else when the server accepts it', async () => {
    fetchMock.mockResolvedValueOnce(reply(200))
    const res = await apiFetch('/api/users', { method: 'PATCH', body: { user_id: 'u' } })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bearerOf(0)).toBe('Bearer old')
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it('on a 401 it renews the session and repeats the call with the new token', async () => {
    fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200))
    const res = await apiFetch('/api/users', { method: 'PATCH', body: { user_id: 'u', username: 'nuevo.arroba' } })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bearerOf(1)).toBe('Bearer new')
    expect((fetchMock.mock.calls[1][1] as { body: string }).body).toContain('nuevo.arroba') // the same request
  })

  it('does not retry other errors (a 403 or a 409 is an answer, not an expired session)', async () => {
    fetchMock.mockResolvedValueOnce(reply(409))
    expect((await apiFetch('/api/users', { method: 'PATCH', body: {} })).status).toBe(409)
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it('asks to sign in again when the session cannot be renewed, or when the new token is refused too', async () => {
    fetchMock.mockResolvedValueOnce(reply(401))
    auth.refreshSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(apiFetch('/api/users', { method: 'PATCH', body: {} })).rejects.toThrow(/vuelve a entrar/)

    fetchMock.mockReset().mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401))
    await expect(apiFetch('/api/users', { method: 'PATCH', body: {} })).rejects.toThrow(/vuelve a entrar/)
    expect(fetchMock).toHaveBeenCalledTimes(2) // once only: no loop
  })

  it('without a session it does not even call the server', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(apiFetch('/api/users', { method: 'PATCH', body: {} })).rejects.toThrow(/Sesión expirada/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
