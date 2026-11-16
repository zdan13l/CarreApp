// Minimal stand-ins for the Vercel request/response objects and the Supabase client, so the
// serverless handlers (api/users.ts, api/push.ts) can be exercised without any network.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export interface FakeRes {
  statusCode: number
  body: unknown
  headers: Record<string, string>
}

export function mockRes(): VercelResponse & FakeRes {
  const res = { statusCode: 200, body: undefined, headers: {} } as FakeRes & Record<string, unknown>
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: unknown) => {
    res.body = body
    return res
  }
  res.setHeader = (key: string, value: string) => {
    res.headers[key] = value
  }
  return res as unknown as VercelResponse & FakeRes
}

export function mockReq(init: { method?: string; headers?: Record<string, string>; body?: unknown }): VercelRequest {
  return { method: init.method ?? 'POST', headers: init.headers ?? {}, body: init.body } as unknown as VercelRequest
}

type Result = { data?: unknown; error?: { message: string } | null }

/** A chainable query builder whose final result is chosen by the test. */
export function queryBuilder(result: Result | (() => Result)) {
  const settle = () => (typeof result === 'function' ? result() : result)
  const b: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'in', 'insert', 'delete', 'update']) b[name] = () => b
  b.maybeSingle = () => Promise.resolve(settle())
  b.then = (resolve: (r: Result) => unknown) => resolve(settle()) // `await builder`
  return b
}
