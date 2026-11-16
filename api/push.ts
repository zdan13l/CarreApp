// Serverless endpoint (Vercel) that sends the push notifications.
// It is called by the database (check_delays and the manual-alert trigger) with a shared secret,
// never by the browser:
//   POST /api/push   header x-push-secret   { notifications: [{ user_ids, title, body, tag }] }
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface Notification {
  user_ids: string[]
  title: string
  body: string
  tag?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await run(req, res)
  } catch (e) {
    return res.status(500).json({ error: `Error inesperado: ${(e as Error).message}` })
  }
}

async function run(req: VercelRequest, res: VercelResponse) {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const secret = process.env.PUSH_SECRET
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'https://carreapp.vercel.app'
  if (!url || !serviceKey || !secret || !publicKey || !privateKey) {
    return res.status(500).json({ error: 'Servidor sin configurar.' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' })
  if (req.headers['x-push-secret'] !== secret) return res.status(401).json({ error: 'No autorizado.' })

  const notifications: Notification[] = Array.isArray(req.body?.notifications) ? req.body.notifications : []
  if (notifications.length === 0) return res.status(200).json({ sent: 0 })

  // An invalid key (a stray space, quote or line break when pasting it) throws here; report it as a
  // readable error instead of crashing the function.
  let webpush: typeof import('web-push')
  try {
    // Loaded here (not at the top) so a problem loading the library is reported instead of crashing.
    // web-push is a CommonJS module: depending on the bundler its API is on `default` or on the module itself.
    const mod = (await import('web-push')) as unknown as { default?: typeof import('web-push') } & typeof import('web-push')
    webpush = mod.default ?? mod
    webpush.setVapidDetails(subject, publicKey.trim(), privateKey.trim())
  } catch (e) {
    return res.status(500).json({ error: `No se pudo preparar el envío (claves VAPID o librería): ${(e as Error).message}` })
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  const userIds = [...new Set(notifications.flatMap((n) => n.user_ids ?? []))]
  const { data: subs, error: subsError } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  if (subsError) return res.status(500).json({ error: `No se pudieron leer las suscripciones: ${subsError.message}` })
  const byUser = new Map<string, NonNullable<typeof subs>>()
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])

  let sent = 0
  const gone: string[] = []
  const failures: string[] = []
  await Promise.all(
    notifications.flatMap((n) =>
      (n.user_ids ?? []).flatMap((userId) =>
        (byUser.get(userId) ?? []).map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: n.title, body: n.body, tag: n.tag }),
              { TTL: 60, urgency: 'high' },
            )
            sent++
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) gone.push(s.endpoint) // the phone unsubscribed
            else failures.push(`${status ?? 'error'}: ${(e as Error).message}`.slice(0, 160))
          }
        }),
      ),
    ),
  )
  if (gone.length > 0) await db.from('push_subscriptions').delete().in('endpoint', gone)
  return res.status(200).json({ sent, removed: gone.length, failures: failures.slice(0, 3) })
}
