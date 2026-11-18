// Exports the results of a Carrera as a CSV (opens in Excel). Finishing a Carrera resets its progress (0020), so
// the final standings are downloaded first. `buildResultsCsv` is pure; `exportResults` reads the data and saves the file.
import { supabase } from './supabase'
import { ITEM_LABEL, SCORE_ITEMS, type MatchScore } from '../types'

interface NamedRow { id: string; name: string }
export interface ResultMatch {
  round_number: number
  base_id: string
  team_a: string
  team_b: string
  match_scores: MatchScore[]
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildResultsCsv(eventName: string, teams: NamedRow[], bases: NamedRow[], matches: ResultMatch[]): string {
  const teamName = new Map(teams.map((t) => [t.id, t.name]))
  const baseName = new Map(bases.map((b) => [b.id, b.name]))
  const points = new Map(teams.map((t) => [t.id, 0]))
  for (const m of matches) for (const s of m.match_scores) {
    if (s.winner_team_id && !s.voided) points.set(s.winner_team_id, (points.get(s.winner_team_id) ?? 0) + 1)
  }
  const ranking = [...teams].sort((a, b) => (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'es'))

  const lines: (string | number)[][] = [
    [eventName],
    [],
    ['Clasificación'],
    ['Puesto', 'Grupo', 'Puntos'],
    ...ranking.map((t, i) => [i + 1, t.name, points.get(t.id) ?? 0]),
    [],
    ['Detalle por cruce'],
    ['Ronda', 'Base', 'Grupo A', 'Grupo B', ...SCORE_ITEMS.map((i) => ITEM_LABEL[i])],
    ...[...matches]
      .sort((a, b) => a.round_number - b.round_number)
      .map((m) => [
        m.round_number,
        baseName.get(m.base_id) ?? '',
        teamName.get(m.team_a) ?? '',
        teamName.get(m.team_b) ?? '',
        ...SCORE_ITEMS.map((item) => {
          const s = m.match_scores.find((x) => x.item === item)
          if (!s) return 'Sin jugar'
          return s.voided ? 'Invalidado' : teamName.get(s.winner_team_id ?? '') ?? ''
        }),
      ]),
  ]
  return '﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')
}

export function saveCsv(filename: string, content: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Reads the Carrera and downloads its results. Returns false when it could not be read (nothing was saved).
export async function exportResults(eventId: string, eventName: string): Promise<boolean> {
  if (!supabase) return false
  const [t, b, m] = await Promise.all([
    supabase.from('teams').select('id, name').eq('event_id', eventId),
    supabase.from('bases').select('id, name').eq('event_id', eventId),
    supabase.from('matches').select('round_number, base_id, team_a, team_b, match_scores(item, winner_team_id, voided)').eq('event_id', eventId),
  ])
  if (t.error || b.error || m.error) return false
  const safe = eventName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'carrera'
  saveCsv(`resultados-${safe}.csv`, buildResultsCsv(eventName, t.data ?? [], b.data ?? [], (m.data ?? []) as ResultMatch[]))
  return true
}
