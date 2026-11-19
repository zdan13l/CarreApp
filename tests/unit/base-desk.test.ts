// QA, sixth run: the states of the base "visa counter" (BaseHome.tsx), rendered on the server with sample data.
// There is no browser here: this checks what each state shows, which buttons exist and the plural/singular wording.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClosedDesk, MatchCard, NextRound, WonItems, type BaseMatch, type Team } from '../../src/pages/BaseHome'
import { AlertBanner } from '../../src/components/Alerts'
import { lateTeams, type TimedMatch } from '../../src/lib/delays'

const teams = new Map<string, Team>([
  ['a', { id: 'a', name: 'Dioses Griegos', photo_path: null }],
  ['b', { id: 'b', name: 'Samuráis', photo_path: null }],
  ['c', { id: 'c', name: 'Guerreros Aztecas', photo_path: null }],
])
const codes = new Map([['a', 'JV 200'], ['b', 'JV 252'], ['c', 'JV 239']])
const base = { id: 'base-1', name: 'Atrio', location_photo_path: null }
const noop = async () => {}
const match = (o: Partial<BaseMatch> = {}): BaseMatch => ({ id: 'm', round_number: 1, team_a: 'a', team_b: 'b', status: 'pending', arrived_at: null, match_scores: [], ...o })
const card = (m: BaseMatch, withEvent = true) =>
  renderToStaticMarkup(h(MatchCard, { match: m, teams, onSent: noop, eventId: withEvent ? 'e1' : undefined, base, codes }))

describe('MatchCard: states of the counter', () => {
  it('pending: asks to confirm arrival, offers to hurry the groups, shows no scoring buttons, groups "en camino"', () => {
    const html = card(match())
    expect(html).toContain('Ya llegaron ambos grupos')
    expect(html).toContain('Apurar a los grupos')
    expect(html).not.toContain('Elige un ganador')
    expect(html).not.toContain('class="choices"')
    expect(html).toContain('En camino')
    expect(html).toContain('JV 200')
    expect(html).toContain('Falta') // step 1 of the flow
  })

  it('in progress with arrival: scoring choices for the three items and a disabled send button', () => {
    const html = card(match({ status: 'in_progress', arrived_at: '2027-01-20T15:00:00Z' }))
    expect(html).not.toContain('Ya llegaron ambos grupos')
    expect((html.match(/class="choices"/g) ?? []).length).toBe(3)
    expect(html).toContain('Elige un ganador')
    expect(html).toContain('En la puerta')
    expect(html).toContain('0 de 3')
  })

  it('in progress without arrived_at (scores loaded by the coordinator): the base must still confirm the arrival, because the database refuses its scores until then (0022)', () => {
    const html = card(match({ status: 'in_progress', arrived_at: null }))
    expect(html).toContain('Ya llegaron ambos grupos')
    expect(html).not.toContain('class="choices"')
  })

  it('one item scored and one voided: shows the winner and "Invalidado", one choice left, running tally 1-0', () => {
    const html = card(
      match({
        status: 'in_progress',
        arrived_at: 'x',
        match_scores: [
          { item: 'barra', winner_team_id: 'a', voided: false },
          { item: 'pregunta', winner_team_id: null, voided: true },
        ] as BaseMatch['match_scores'],
      }),
    )
    expect(html).toContain('Invalidado por el coordinador')
    expect((html.match(/class="choices"/g) ?? []).length).toBe(1)
    expect(html).toContain('2 de 3')
    expect(html).toContain('1–0')
  })

  it('without eventId (history use) there is no "Apurar" button', () => {
    expect(card(match(), false)).not.toContain('Apurar a los grupos')
  })

  it('a team missing from the map (deleted group) renders without crashing', () => {
    const html = renderToStaticMarkup(h(MatchCard, { match: match({ team_b: 'ghost' }), teams, onSent: noop, eventId: 'e1', base, codes }))
    expect(html).toContain('Dioses Griegos')
    expect(html).toContain('—')
  })
})

describe('ClosedDesk, NextRound and WonItems', () => {
  it('ClosedDesk uses singular for one visa and plural otherwise', () => {
    expect(renderToStaticMarkup(h(ClosedDesk, { name: 'Atrio', sealed: 1 }))).toContain('visado sellado')
    expect(renderToStaticMarkup(h(ClosedDesk, { name: 'Atrio', sealed: 0 }))).toContain('visados sellados')
    expect(renderToStaticMarkup(h(ClosedDesk, { name: 'Atrio', sealed: 5 }))).toContain('visados sellados')
  })

  it('NextRound names both groups and the gate', () => {
    const html = renderToStaticMarkup(h(NextRound, { match: match({ round_number: 3, team_b: 'c' }), teams }))
    expect(html).toContain('Puerta 3')
    expect(html).toContain('Guerreros Aztecas')
  })

  it('WonItems: missing item "—", voided "Invalidado", winner by name', () => {
    const html = renderToStaticMarkup(
      h(WonItems, {
        match: match({ status: 'finished', match_scores: [{ item: 'barra', winner_team_id: 'a', voided: false }, { item: 'pregunta', winner_team_id: null, voided: true }] as BaseMatch['match_scores'] }),
        teams,
      }),
    )
    expect(html).toContain('Dioses Griegos')
    expect(html).toContain('Invalidado')
    expect(html).toContain('—')
  })
})

describe('late groups seen from a base (BaseHome shows the banner, MatchCard owns the "Apurar" button)', () => {
  const NOW = Date.parse('2027-01-20T15:00:00Z')
  const ago = (m: number) => new Date(NOW - m * 60000).toISOString()
  const tm = (id: string, round: number, baseId: string, a: string, b: string, o: Partial<TimedMatch> = {}): TimedMatch => ({
    id, round_number: round, base_id: baseId, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null, ...o,
  })

  it('late for the CURRENT match: the banner points to "Apurar a los grupos", which the pending card does show', () => {
    const all = [tm('p', 1, 'other', 'a', 'x', { status: 'finished', finished_at: ago(15) }), tm('m', 2, 'atrio', 'a', 'b')]
    const late = lateTeams(all, 10, NOW, new Map())
    expect(late.map((l) => l.matchId)).toEqual(['m'])
    expect(card(match({ id: 'm', round_number: 2 }))).toContain('Apurar a los grupos')
  })

  it('a group late for the NEXT round while the base still plays the current one: the banner carries its own "Apurar a los grupos" button (NextRound has none)', () => {
    const all = [
      tm('cur', 1, 'atrio', 'x', 'y', { status: 'in_progress', arrived_at: ago(3) }), // the base is still scoring round 1
      tm('prev', 1, 'other', 'a', 'z', { status: 'finished', finished_at: ago(15) }), // group A finished its round 1 elsewhere 15 min ago
      tm('next', 2, 'atrio', 'a', 'b'), // and is expected here in round 2
    ]
    const late = lateTeams(all, 10, NOW, new Map())
    expect(late.map((l) => l.matchId)).toContain('next')
    const html = renderToStaticMarkup(h(NextRound, { match: match({ id: 'next', round_number: 2 }), teams }))
    expect(html).not.toContain('Apurar') // the card of the next round has no button...
    const banner = renderToStaticMarkup(h(AlertBanner, { title: 'Ronda 2: grupos en demora', action: h('button', null, 'Apurar a los grupos') }, 'Dioses Griegos llevan 15 min'))
    expect(banner).toContain('Apurar a los grupos') // ...so the banner must offer it
    expect(banner).toContain('banner-actions')
  })
})
