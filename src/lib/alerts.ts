import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// ---------- Sound and vibration ----------
// Browsers (and iOS especially) only allow sound after a user tap, so the user turns it on with a
// button ("Activar sonido"); that tap unlocks the audio context.
const KEY = 'carreapp.alert-sound'
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

export async function enableSound(): Promise<void> {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: works until the page is closed
  }
  await context()?.resume()
  playAlertSound() // short confirmation beep
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
  if (ctx) {
    void ctx.resume()
    const start = ctx.currentTime
    ;[880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start + i * 0.28)
      gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.28 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.28 + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + i * 0.28)
      osc.stop(start + i * 0.28 + 0.24)
    })
  }
  navigator.vibrate?.([300, 120, 300, 120, 300]) // not available on iPhone
}

// ---------- Hooks ----------
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// Plays the alert sound when a key shows up that was not there before (and again every `repeatMs`
// while it stays, so a late team is not forgotten). The first render never beeps.
export function useAlertSound(keys: string[], repeatMs = 3 * 60 * 1000) {
  const seen = useRef<Map<string, number> | null>(null)
  const signature = keys.join('|')
  useEffect(() => {
    const now = Date.now()
    const current = new Map<string, number>()
    let beep = false
    for (const k of keys) {
      const last = seen.current?.get(k)
      if (seen.current !== null && (last === undefined || now - last >= repeatMs)) {
        beep = true
        current.set(k, now)
      } else current.set(k, last ?? now)
    }
    seen.current = current
    if (beep) playAlertSound()
    // keys are compared through their signature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])
}

export interface ManualAlert {
  id: string
  match_id: string
  message: string
  created_at: string
}

const RECENT_MS = 20 * 60 * 1000

// Manual alerts sent by the coordinator for the given matches: loads the recent ones and listens
// for new ones live (sound included).
export function useManualAlerts(matchIds: string[]) {
  const [alerts, setAlerts] = useState<ManualAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
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
    const since = new Date(Date.now() - RECENT_MS).toISOString()
    void client
      .from('alerts')
      .select('id, match_id, message, created_at')
      .in('match_id', matchIds)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled && data) setAlerts(data)
      })
    const channel = client
      .channel(`alerts-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        const row = payload.new as ManualAlert
        if (!idsRef.current.has(row.match_id)) return
        setAlerts((prev) => (prev.some((a) => a.id === row.id) ? prev : [row, ...prev]))
        playAlertSound()
      })
      .subscribe()
    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
    // matchIds is tracked through idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return {
    alerts: alerts.filter((a) => !dismissed.has(a.id) && Date.now() - new Date(a.created_at).getTime() < RECENT_MS),
    dismiss: (id: string) => setDismissed((prev) => new Set(prev).add(id)),
  }
}
