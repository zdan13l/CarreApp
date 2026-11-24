import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Counts {
  teams: number
  bases: number
  users: number
  matches: number
  warnings: string[]
}

const EMPTY: Counts = { teams: 0, bases: 0, users: 0, matches: 0, warnings: [] }

// What is still missing to enable a carrera (`event_problems` of the database) and what is worth checking, with the counts of what is already
// there. It is read in ONE place: the Resumen y control of a carrera that is being prepared.
export function usePrepStatus(eventId: string | undefined, enabled = true) {
  const [problems, setProblems] = useState<string[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY)

  const check = useCallback(async () => {
    if (!supabase || !eventId || !enabled) return
    const [probs, teams, bases, users, matches] = await Promise.all([
      supabase.rpc('event_problems', { p_event: eventId }),
      supabase.from('teams').select('name, team_runners(is_gps_tracker)').eq('event_id', eventId),
      supabase.from('bases').select('name, lat, base_staff(user_id)').eq('event_id', eventId),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('event_id', eventId).neq('role', 'admin'),
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    ])
    setProblems((probs.data as string[] | null) ?? [])
    const warnings: string[] = []
    for (const t of teams.data ?? []) {
      if (t.team_runners.length === 0) warnings.push(`El grupo "${t.name}" no tiene corredores.`)
      else if (!t.team_runners.some((r) => r.is_gps_tracker)) warnings.push(`El grupo "${t.name}" no tiene corredor designado para el GPS.`)
    }
    for (const b of bases.data ?? []) {
      if (b.base_staff.length === 0) warnings.push(`La base "${b.name}" no tiene inductores asignados.`)
      if (b.lat === null) warnings.push(`La base "${b.name}" no tiene ubicación en el mapa.`)
    }
    setCounts({ teams: teams.data?.length ?? 0, bases: bases.data?.length ?? 0, users: users.count ?? 0, matches: matches.count ?? 0, warnings })
  }, [eventId, enabled])

  useEffect(() => {
    void check()
  }, [check])

  return { problems, counts, reload: check }
}
