// A free Supabase project is paused after a week without activity, and a paused project cannot open any passport until someone wakes it up.
// Vercel calls this endpoint once a day (the cron in vercel.json); it asks the database for one row, which counts as activity.
// It reads nothing private: with the public key and row level security an anonymous request sees no rows at all.
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return res.status(500).json({ ok: false, error: 'Servidor sin configurar.' })
  try {
    const r = await fetch(`${url}/rest/v1/events?select=id&limit=1`, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } })
    if (!r.ok) return res.status(502).json({ ok: false, status: r.status })
    return res.status(200).json({ ok: true, at: new Date().toISOString() })
  } catch {
    return res.status(502).json({ ok: false })
  }
}
