import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Maximum travel time per leg (from one base to the next), keyed "fromBaseId>toBaseId".
// Legs without their own time use the general maximum of the Carrera.
export const legKey = (fromBase: string, toBase: string) => `${fromBase}>${toBase}`

export function useTravelTimes(eventId: string | undefined): Map<string, number> {
  const [times, setTimes] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    if (!supabase || !eventId) return
    const client = supabase
    let cancelled = false
    const load = async () => {
      const { data } = await client
        .from('base_travel_times')
        .select('from_base_id, to_base_id, minutes')
        .eq('event_id', eventId)
      if (!cancelled && data) setTimes(new Map(data.map((r) => [legKey(r.from_base_id, r.to_base_id), r.minutes])))
    }
    void load()
    const id = setInterval(() => void load(), 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [eventId])
  return times
}
