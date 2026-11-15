import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Calls `reload` whenever one of the tables changes in the database (Supabase Realtime).
// Bursts of events (e.g. 3 scores inserted together) are merged into a single reload.
export function useRealtimeReload(tables: string[], reload: () => void | Promise<void>) {
  const reloadRef = useRef(reload)
  useEffect(() => {
    reloadRef.current = reload
  })

  const key = tables.join(',')
  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let timer: ReturnType<typeof setTimeout> | undefined
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void reloadRef.current(), 250)
    }
    let channel = client.channel(`rt-${key}-${crypto.randomUUID()}`)
    for (const table of key.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, trigger)
    }
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      void client.removeChannel(channel)
    }
  }, [key])
}
