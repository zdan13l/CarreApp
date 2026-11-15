// Pure scheduling logic (no Supabase): round-robin generator and schedule analysis.
// The database is the final judge of the rules (no repeated pairs, a team plays once per
// round, a base hosts one match per round); this module only helps the coordinator build
// and review a schedule before saving it.

export interface PlannedMatch {
  round_number: number
  base_id: string
  team_a: string
  team_b: string
}

// Circle method: with N teams every pair meets exactly once over N-1 rounds (N even; with
// N odd one team rests each round). Matches of a round go to different bases, and the
// base order shifts every round so teams visit different bases. If there are fewer bases
// than matches in a round, the extra matches are left out (the coordinator can add them).
export function generateSchedule(teamIds: string[], baseIds: string[], rounds: number): PlannedMatch[] {
  if (teamIds.length < 2 || baseIds.length < 1 || rounds < 1) return []
  const ring: (string | null)[] = [...teamIds]
  if (ring.length % 2 === 1) ring.push(null) // bye
  const n = ring.length
  const planned: PlannedMatch[] = []

  for (let r = 0; r < Math.min(rounds, n - 1); r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]
      const b = ring[n - 1 - i]
      if (a && b) pairs.push([a, b])
    }
    pairs.slice(0, baseIds.length).forEach(([a, b], i) => {
      planned.push({ round_number: r + 1, base_id: baseIds[(i + r) % baseIds.length], team_a: a, team_b: b })
    })
    // rotate everything except the first element
    ring.splice(1, 0, ring.pop() as string | null)
  }
  return planned
}

export interface Analysis {
  warnings: string[]
  pairsPlanned: number
  pairsTotal: number
}

export function analyzeSchedule(
  matches: PlannedMatch[],
  teams: { id: string; name: string }[],
  bases: { id: string; name: string }[],
): Analysis {
  const warnings: string[] = []
  const rounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const baseName = new Map(bases.map((b) => [b.id, b.name]))

  for (const t of teams) {
    const mine = matches.filter((m) => m.team_a === t.id || m.team_b === t.id)
    if (mine.length === 0) {
      warnings.push(`"${t.name}" no tiene ningún cruce.`)
      continue
    }
    const idle = rounds - new Set(mine.map((m) => m.round_number)).size
    if (idle > 0) warnings.push(`"${t.name}" descansa en ${idle} ${idle === 1 ? 'ronda' : 'rondas'}.`)
    const visits = new Map<string, number>()
    for (const m of mine) visits.set(m.base_id, (visits.get(m.base_id) ?? 0) + 1)
    for (const [baseId, count] of visits) {
      if (count > 1) warnings.push(`"${t.name}" pasa ${count} veces por la base "${baseName.get(baseId) ?? '?'}".`)
    }
  }

  const n = teams.length
  return { warnings, pairsPlanned: matches.length, pairsTotal: (n * (n - 1)) / 2 }
}

// Turns a database error from the matches table into a clear Spanish message.
export function matchErrorMessage(message: string): string {
  if (message.includes('matches_no_repeat_pair')) return 'Esos dos grupos ya se enfrentan en otra ronda.'
  if (message.includes('dos bases')) return 'Un grupo no puede estar en dos bases durante la misma ronda.'
  if (message.includes('base_id_round_number') || message.includes('duplicate'))
    return 'Esa base ya tiene un cruce en esa ronda.'
  return 'No se pudo guardar el cruce.'
}

// The round being played now: the first one that still has an unfinished match
// (or the last one when everything is finished).
export function currentRound(matches: { round_number: number; status: string }[]): number {
  if (matches.length === 0) return 1
  const open = matches.filter((m) => m.status !== 'finished').map((m) => m.round_number)
  return open.length > 0 ? Math.min(...open) : Math.max(...matches.map((m) => m.round_number))
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}
