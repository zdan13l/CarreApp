import { useCallback, useEffect, useState } from 'react'
import type { RotationTimes } from './delays'
import { useRealtimeReload } from './realtime'
import { supabase } from './supabase'

// When the coordinator announced the rotation of each round (round -> time). The delay clock of the groups starts then.
export function useRotationTimes(eventId: string | undefined): RotationTimes {
  const [times, setTimes] = useState<RotationTimes>(new Map())
  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const { data, error } = await supabase.from('round_rotations').select('round_number, created_at').eq('event_id', eventId)
    if (!error) setTimes(new Map((data ?? []).map((r) => [r.round_number as number, new Date(r.created_at as string).getTime()])))
  }, [eventId])
  useEffect(() => {
    void load()
  }, [load])
  useRealtimeReload(['round_rotations'], load, 1500)
  return times
}
