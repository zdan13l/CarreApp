// api/push.ts: sends the web-push notifications. Called by the database with a shared secret.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockReq, mockRes, queryBuilder } from './fakes'

type Sub = { user_id: string; endpoint: string; p256dh: string; auth: string }
const state = vi.hoisted(() => ({
  subs: [] as Sub[],
  subsError: null as { message: string } | null,
  deleted: [] as string[][],
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'push_subscriptions') throw new Error(`unexpected table ${table}`)
      const select = queryBuilder(() => ({ data: state.subsError ? null : state.subs, error: state.subsError }))
      return {
        select: select.select,
        delete: () => ({ in: (_col: string, values: string[]) => Promise.resolve(void state.deleted.push(values)) }),
      }
    },
  }),
}))

// web-push is a CommonJS module: depending on the bundler its API is on `default` or on the module
// itself. The handler must work with both (this was a production bug: every send failed with a 500).
vi.mock('web-push', () => ({
  default: { setVapidDetails: state.setVapidDetails, sendNotification: state.sendNotification },
}))

import handler from '../../api/push'

const SECRET = 's3cr3t'
const call = async (body: unknown, headers: Record<string, string> = { 'x-push-secret': SECRET }, method = 'POST') => {
  const res = mockRes()
  await handler(mockReq({ method, headers, body }), res)
  return res
}
const note = (user_ids: string[], tag = 't1') => ({ user_ids, title: 'Llevas 12 min', body: 'Apúrate', tag })

beforeEach(() => {
  Object.assign(process.env, {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    PUSH_SECRET: SECRET,
    VAPID_PUBLIC_KEY: ' pub ',
    VAPID_PRIVATE_KEY: ' priv ',
    VAPID_SUBJECT: 'https://carreapp.vercel.app',
  })
  state.subs = [
    { user_id: 'u1', endpoint: 'https://push/1', p256dh: 'k1', auth: 'a1' },
    { user_id: 'u1', endpoint: 'https://push/1b', p256dh: 'k1b', auth: 'a1b' },
    { user_id: 'u2', endpoint: 'https://push/2', p256dh: 'k2', auth: 'a2' },
  ]
  state.subsError = null
  state.deleted = []
  state.setVapidDetails.mockReset()
  state.sendNotification.mockReset().mockResolvedValue({})
})

describe('who can call it', () => {
  it('needs its server configuration (a readable 500, not a crash)', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const res = await call({ notifications: [note(['u1'])] })
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ error: 'Servidor sin configurar.' })
  })
  it('accepts only POST', async () => {
    expect((await call({}, { 'x-push-secret': SECRET }, 'GET')).statusCode).toBe(405)
  })
  it('rejects a missing or wrong secret (401)', async () => {
    expect((await call({ notifications: [note(['u1'])] }, {})).statusCode).toBe(401)
    expect((await call({ notifications: [note(['u1'])] }, { 'x-push-secret': 'nope' })).statusCode).toBe(401)
    expect(state.sendNotification).not.toHaveBeenCalled()
  })
})

describe('sending', () => {
  it('does nothing for an empty or malformed list', async () => {
    expect((await call({ notifications: [] })).body).toEqual({ sent: 0 })
    expect((await call({ notifications: 'x' })).body).toEqual({ sent: 0 })
    expect((await call(undefined)).body).toEqual({ sent: 0 })
  })

  it('sends to every phone of every addressed user, with the payload, and trims the VAPID keys', async () => {
    const res = await call({ notifications: [note(['u1']), note(['u2'], 't2')] })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ sent: 3, removed: 0 })
    expect(state.setVapidDetails).toHaveBeenCalledWith('https://carreapp.vercel.app', 'pub', 'priv')
    expect(state.sendNotification).toHaveBeenCalledTimes(3)
    const [subscription, payload, options] = state.sendNotification.mock.calls[0]
    expect(subscription).toEqual({ endpoint: 'https://push/1', keys: { p256dh: 'k1', auth: 'a1' } })
    expect(JSON.parse(payload)).toEqual({ title: 'Llevas 12 min', body: 'Apúrate', tag: 't1' })
    expect(options).toEqual({ TTL: 180, urgency: 'high' })
  })

  it('skips users who never subscribed', async () => {
    const res = await call({ notifications: [note(['nadie'])] })
    expect(res.body).toMatchObject({ sent: 0 })
    expect(state.sendNotification).not.toHaveBeenCalled()
  })

  it('forgets a phone that unsubscribed (404/410) and reports other failures without failing', async () => {
    state.sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === 'https://push/1') throw Object.assign(new Error('gone'), { statusCode: 410 })
      if (sub.endpoint === 'https://push/1b') throw Object.assign(new Error('rate limited'), { statusCode: 429 })
    })
    const res = await call({ notifications: [note(['u1', 'u2'])] })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ sent: 1, removed: 1 })
    expect((res.body as { failures: string[] }).failures[0]).toContain('429')
    expect(state.deleted).toEqual([['https://push/1']])
  })
})

describe('problems are reported, never a bare crash', () => {
  it('says so when the VAPID keys are invalid', async () => {
    state.setVapidDetails.mockImplementation(() => {
      throw new Error('Vapid public key must be a URL safe Base 64 encoded string')
    })
    const res = await call({ notifications: [note(['u1'])] })
    expect(res.statusCode).toBe(500)
    expect((res.body as { error: string }).error).toContain('Vapid public key')
  })
  it('says so when the subscriptions cannot be read', async () => {
    state.subsError = { message: 'db down' }
    const res = await call({ notifications: [note(['u1'])] })
    expect(res.statusCode).toBe(500)
    expect((res.body as { error: string }).error).toContain('db down')
  })
})
