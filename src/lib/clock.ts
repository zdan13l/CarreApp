import { supabase } from './supabase'

// The delay alerts compare "now" with a time stamped by the server. A phone whose clock is a few minutes
// off would raise a false alarm (or hide a real one), so `serverNow()` corrects the phone clock with the
// offset measured against the database (`server_now()`), and falls back to the phone clock if it cannot.
let offsetMs = 0
let lastSync = 0

export const serverNow = () => Date.now() + offsetMs

export async function syncClock(): Promise<void> {
  if (!supabase || Date.now() - lastSync < 5 * 60_000) return
  lastSync = Date.now()
  const t0 = Date.now()
  const { data, error } = await supabase.rpc('server_now')
  const t1 = Date.now()
  if (error || typeof data !== 'string') return
  offsetMs = new Date(data).getTime() - (t0 + t1) / 2 // half of the round trip is the trip back
}
