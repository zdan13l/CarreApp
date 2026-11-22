import { describe, expect, it } from 'vitest'
import { airportCode, flightCodes, flightOf, stageStates, type JourneyMatch } from '../../src/lib/flight'
import { stampSymbol } from '../../src/lib/stamp'

describe('airport vocabulary', () => {
  it('gives every destination a three-letter code, like an airport', () => {
    expect(airportCode('Biblioteca')).toBe('BIB')
    expect(airportCode('Atrio')).toBe('ATR')
    expect(airportCode('Cancha de Fútbol')).toBe('CFU')
    expect(airportCode('Edificio Padre Arrupe Sala B')).toBe('EPA')
    expect(airportCode('Z')).toBe('ZXX')
    expect(airportCode('')).toBe('???')
  })

  it('gives every group its own call sign, the same for everyone who asks (order of the names, not of the ids)', () => {
    const teams = [{ id: 'b', name: 'Samuráis' }, { id: 'a', name: 'Dioses Griegos' }, { id: 'c', name: 'Vikingos' }]
    const codes = flightCodes(teams)
    expect(codes.get('a')).toBe('JV 200')
    expect(codes.get('b')).toBe('JV 213')
    expect(new Set(codes.values()).size).toBe(3)
    expect(flightCodes([...teams].reverse())).toEqual(codes)
  })

  it('reads a symbol from the name of the place and falls back to one drawn from its id', () => {
    expect(stampSymbol('Biblioteca Alfonso Borrero', 'x')).toBe('library')
    expect(stampSymbol('Cancha de Fútbol', 'x')).toBe('goal')
    expect(stampSymbol('Capilla', 'x')).toBe('church')
    expect(stampSymbol('Zona misteriosa', 'id-1')).toBe(stampSymbol('Zona misteriosa', 'id-1'))
  })
})

const m = (id: string, round: number, over: Partial<JourneyMatch> = {}): JourneyMatch => ({
  id, round_number: round, base_id: `b${round}`, team_a: 't1', team_b: 't2', status: 'pending', arrived_at: null, finished_at: null, match_scores: [], ...over,
})

describe('the state of a flight comes from its matches', () => {
  it('heads to the base, is at the gate once the base confirms the arrival, and lands when every match is finished', () => {
    expect(flightOf('t1', []).state).toBe('sin-itinerario')
    expect(flightOf('t1', [m('a', 1)]).state).toBe('en-ruta')
    expect(flightOf('t1', [m('a', 1, { arrived_at: '2026-01-01T10:00:00Z' })]).state).toBe('en-puerta')
    expect(flightOf('t1', [m('a', 1, { status: 'in_progress' })]).state).toBe('en-puerta')
    const landed = flightOf('t1', [m('a', 1, { status: 'finished', finished_at: '2026-01-01T10:20:00Z' }), m('b', 2, { status: 'finished', finished_at: '2026-01-01T11:00:00Z' })])
    expect(landed).toMatchObject({ state: 'aterrizado', completed: 2, total: 2, lastStamp: '2026-01-01T11:00:00Z', current: null })
  })

  it('ignores the matches of other groups and heads for the first unfinished one', () => {
    const f = flightOf('t1', [m('x', 1, { team_a: 't8', team_b: 't9' }), m('a', 2, { status: 'finished' }), m('b', 3), m('c', 4)])
    expect(f.current?.id).toBe('b')
    expect(f.completed).toBe(1)
    expect(f.total).toBe(3)
  })

  it('a stage is done once the base has scored it (whoever won, or voided); the first one left is the active stage at the gate', () => {
    const win = { winner_team_id: 't1', voided: false }
    expect(stageStates([], false).map((s) => s.state)).toEqual(['todo', 'todo', 'todo'])
    expect(stageStates([], true).map((s) => s.state)).toEqual(['active', 'todo', 'todo'])
    expect(stageStates([{ item: 'minijuego', ...win }, { item: 'pregunta', winner_team_id: null, voided: true }], true).map((s) => s.state)).toEqual(['done', 'done', 'active'])
    expect(stageStates([{ item: 'barra', ...win }, { item: 'pregunta', ...win }, { item: 'minijuego', ...win }], true).map((s) => s.state)).toEqual(['done', 'done', 'done'])
  })
})
