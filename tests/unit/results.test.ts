import { describe, expect, it } from 'vitest'
import { buildResultsCsv } from '../../src/lib/results'

const teams = [{ id: 'a', name: 'Alfa' }, { id: 'b', name: 'Beta; "Los" mejores' }, { id: 'c', name: 'Cero' }]
const bases = [{ id: 'x', name: 'Atrio' }]

describe('buildResultsCsv', () => {
  const csv = buildResultsCsv('Carrera 1', teams, bases, [
    { round_number: 2, base_id: 'x', team_a: 'a', team_b: 'c', match_scores: [] },
    {
      round_number: 1, base_id: 'x', team_a: 'a', team_b: 'b',
      match_scores: [
        { item: 'barra', winner_team_id: 'b', voided: false },
        { item: 'pregunta', winner_team_id: null, voided: true },
      ],
    },
  ])
  const lines = csv.replace('﻿', '').split('\r\n')

  it('ranks by points; a voided item gives nobody a point; ties go by name', () => {
    expect(lines.slice(3, 7)).toEqual(['Puesto;Grupo;Puntos', '1;"Beta; ""Los"" mejores";1', '2;Alfa;0', '3;Cero;0'])
  })
  it('lists each match by round with its items (unplayed, voided or the winner)', () => {
    const detail = lines.slice(lines.indexOf('Detalle por cruce') + 2)
    expect(detail[0]).toBe('1;Atrio;Alfa;"Beta; ""Los"" mejores";"Beta; ""Los"" mejores";Invalidado;Sin jugar')
    expect(detail[1]).toBe('2;Atrio;Alfa;Cero;Sin jugar;Sin jugar;Sin jugar')
  })
  it('starts with a BOM so Excel reads the accents', () => {
    expect(csv.startsWith('﻿')).toBe(true)
  })
})
