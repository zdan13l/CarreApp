import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { serverNow, syncClock } from './clock'

// ---------- Sound and vibration ----------
// Browsers (and iOS especially) only allow sound after a tap, and they suspend it again when the
// phone locks or the app goes to the background. So:
//   * the user turns sound on once with a button (the setting is remembered), and
//   * every tap anywhere in the app wakes the audio up again (see `unlock` below).
// For alerts while the phone is locked or the app is closed, push notifications are used.
const KEY = 'carreapp.alert-sound'
export const ALERT_REPEAT_MS = 30_000 // a delay alert sounds every 30 seconds while it lasts
let audio: AudioContext | null = null

function context(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  audio ??= new Ctx()
  return audio
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function audioRunning(): boolean {
  return audio?.state === 'running'
}

// Plays a silent tick: on iOS this is what really "unlocks" the audio after a tap.
async function unlock() {
  const ctx = context()
  if (!ctx) return
  try {
    await ctx.resume()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
  } catch {
    // still locked: the next tap tries again
  }
}

if (typeof window !== 'undefined') {
  const wake = () => {
    if (soundEnabled() && !audioRunning()) void unlock()
  }
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, wake, { passive: true })
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake()
  })
}

export async function enableSound(): Promise<void> {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: works until the page is closed
  }
  await unlock()
  playAlertSound() // short confirmation
}

export function disableSound() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function playAlertSound() {
  if (!soundEnabled()) return
  const ctx = context()
  if (ctx && ctx.state !== 'closed') {
    void ctx.resume()
    const start = ctx.currentTime
    ;[880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start + i * 0.28)
      gain.gain.exponentialRampToValueAtTime(0.3, start + i * 0.28 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.28 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + i * 0.28)
      osc.stop(start + i * 0.28 + 0.24)
    })
  }
  navigator.vibrate?.([300, 120, 300, 120, 300]) // not available on iPhone
}

// ---------- Hooks ----------
export function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    void syncClock().then(() => setNow(serverNow()))
    const id = setInterval(() => {
      void syncClock()
      setNow(serverNow())
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// True while the audio is awake. False after a reload or a lock until the user taps again.
export function useAudioRunning(): boolean {
  const [running, setRunning] = useState(audioRunning)
  useEffect(() => {
    const id = setInterval(() => setRunning(audioRunning()), 1000)
    return () => clearInterval(id)
  }, [])
  return running
}

// Sounds right away when `active` turns on and then every `everyMs` while it stays on.
export function useRepeatingAlert(active: boolean, everyMs = ALERT_REPEAT_MS) {
  useEffect(() => {
    if (!active) return
    playAlertSound()
    const id = setInterval(playAlertSound, everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
}

export interface ManualAlert {
  id: string
  match_id: string
  message: string
  created_at: string
  target?: 'groups' | 'base' // 0019; rows from before it are for the groups
}

const RECENT_MS = 20 * 60 * 1000 // alerts stay visible for 20 minutes
const FRESH_MS = 90 * 1000 // and sound repeatedly (every 30 s) during their first minute and a half

// Manual alerts sent by the coordinator for the given matches. They arrive live, and the list is
// also refreshed every 10 s and whenever the app comes back to the foreground (a locked phone
// drops the live connection), so an alert is never missed.
export function useManualAlerts(matchIds: string[], target: 'groups' | 'base' = 'groups') {
  const [alerts, setAlerts] = useState<ManualAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const now = useNow(5000)
  const idsKey = matchIds.join(',')
  const idsRef = useRef(new Set(matchIds))

  useEffect(() => {
    idsRef.current = new Set(matchIds)
    // matchIds is tracked through idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  useEffect(() => {
    if (!supabase || matchIds.length === 0) return
    const client = supabase
    let cancelled = false
    const refresh = async () => {
      const since = new Date(serverNow() - RECENT_MS).toISOString()
      const { data } = await client
        .from('alerts')
        .select('*')
        .in('match_id', matchIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (!cancelled && data) setAlerts((data as ManualAlert[]).filter((a) => (a.target ?? 'groups') === target))
    }
    void refresh()
    const poll = setInterval(() => void refresh(), 10_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const channel = client
      .channel(`alerts-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const row = payload.new as ManualAlert
        if (!idsRef.current.has(row.match_id) || (row.target ?? 'groups') !== target) return
        setAlerts((prev) => (prev.some((a) => a.id === row.id) ? prev : [row, ...prev]))
      })
      .subscribe()
    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      void client.removeChannel(channel)
    }
    // matchIds is tracked through idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const visible = alerts.filter((a) => !dismissed.has(a.id) && now - new Date(a.created_at).getTime() < RECENT_MS)
  const freshAlerts = visible.filter((a) => now - new Date(a.created_at).getTime() < FRESH_MS)
  const fresh = freshAlerts.length > 0
  useRepeatingAlert(fresh)

  // A NEW alert rings at once even when an earlier one is still on the screen (the repeating sound only starts when the
  // first fresh alert appears, so without this the second one would stay silent until the next 30 s tick).
  const newestFresh = freshAlerts.reduce<ManualAlert | null>((n, a) => (!n || a.created_at > n.created_at ? a : n), null)?.id ?? null
  const lastRung = useRef<string | null>(null)
  useEffect(() => {
    if (newestFresh && lastRung.current !== null && lastRung.current !== newestFresh) playAlertSound()
    lastRung.current = newestFresh ?? lastRung.current
  }, [newestFresh])

  return {
    alerts: visible,
    dismiss: (id: string) => setDismissed((prev) => new Set(prev).add(id)),
  }
}
