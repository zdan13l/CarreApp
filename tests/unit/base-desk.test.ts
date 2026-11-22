// QA, sixth run: the states of the base "visa counter" (BaseHome.tsx), rendered on the server with sample data.
// There is no browser here: this checks what each state shows, which buttons exist and the plural/singular wording.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClosedDesk, MatchCard, NextRound, WonItems, type BaseMatch, type Team } from '../../src/pages/BaseHome'
import { AlertBanner } from '../../src/components/Alerts'
import { clockText, lateTeams, legInfo, legRemainingSec, type LegInfo, type RotationTimes, type TimedMatch } from '../../src/lib/delays'

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
  it('pending: only the groups on their way (clock rows), the hurry buttons and the arrival confirmation; no scoring, no steps', () => {
    const html = card(match())
    expect(html).toContain('Ya llegaron ambos grupos')
    expect(html).toContain('Apurar a los grupos')
    expect(html).not.toContain('Elige un ganador')
    expect(html).not.toContain('class="choices"')
    expect(html).toContain('Sin tiempo de traslado definido') // no leg data in this sample
    expect(html).toContain('JV 200')
    expect(html).toContain('aria-label="Apurar a Dioses Griegos"')
    expect(html).not.toContain('desk-flow') // the steps and the versus board only show once the groups are here
    expect(html).not.toContain('class="versus"')
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
    expect(html).toContain('?') // the missing group has no name to show, but the card still renders
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

describe('walking groups: where they come from and the clock (hurrying one or both)', () => {
  const NOW = Date.parse('2027-01-20T15:00:00Z')
  const ago = (m: number) => new Date(NOW - m * 60000).toISOString()
  const tm = (id: string, round: number, baseId: string, a: string, b: string, o: Partial<TimedMatch> = {}): TimedMatch => ({
    id, round_number: round, base_id: baseId, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null, ...o,
  })

  it('legInfo: the previous base and the time of that leg (its own, or the Carrera maximum)', () => {
    const all = [tm('p', 1, 'other', 'a', 'x', { status: 'finished', finished_at: ago(4) }), tm('m', 2, 'atrio', 'a', 'b')]
    const own = legInfo(all, 'm', 'a', 10, new Map([['other>atrio', 7]]))
    expect(own).toMatchObject({ kind: 'walking', fromBaseId: 'other', allowedMin: 7 })
    expect(legInfo(all, 'm', 'a', 10)).toMatchObject({ allowedMin: 10 })
    expect(legRemainingSec(own as Extract<LegInfo, { kind: 'walking' }>, NOW)).toBe(3 * 60) // 7 minutes allowed, 4 gone
  })

  it('legInfo: no clock when it plays here again, when its last match is still going, or on the first round', () => {
    const all = [
      tm('p', 1, 'atrio', 'a', 'x', { status: 'finished', finished_at: ago(4) }),
      tm('q', 1, 'other', 'b', 'y', { status: 'in_progress' }),
      tm('m', 2, 'atrio', 'a', 'b'),
    ]
    expect(legInfo(all, 'm', 'a', 10).kind).toBe('stay')
    expect(legInfo(all, 'm', 'b', 10).kind).toBe('waiting')
    expect(legInfo(all, 'p', 'a', 10).kind).toBe('none')
  })

  it('the clock text is minutes and seconds, also when over the time', () => {
    expect(clockText(65)).toBe('1:05')
    expect(clockText(-125)).toBe('2:05')
  })

  it('the card shows each group with where it comes from, its clock and its own "Apurar", plus one for both', () => {
    const legs: Record<string, LegInfo> = {
      a: { kind: 'walking', fromBaseId: 'bx', since: Date.now() - 2 * 60000, allowedMin: 10 },
      b: { kind: 'stay' },
    }
    const html = renderToStaticMarkup(h(MatchCard, { match: match(), teams, onSent: noop, eventId: 'e1', base, codes, legs, baseNames: new Map([['bx', 'Biblioteca']]) }))
    expect(html).toContain('Viene de Biblioteca · máximo 10 min')
    expect(html).toContain('Ya está en tu base')
    expect(html).toContain('role="timer"')
    expect(html).toContain('aria-label="Apurar a Dioses Griegos"')
    expect(html).toContain('aria-label="Apurar a Samuráis"')
    expect(html).toMatch(/disabled=""[^>]*aria-label="Apurar a Samuráis"|aria-label="Apurar a Samuráis"[^>]*disabled=""/) // already here: nothing to hurry
    expect(html).toContain('Apurar a los grupos')
  })
})

describe('the clock counts from the rotation notice (0032)', () => {
  const NOW = Date.parse('2027-01-20T15:00:00Z')
  const ago = (m: number) => NOW - m * 60000
  const tm = (id: string, round: number, baseId: string, a: string, b: string, o: Partial<TimedMatch> = {}): TimedMatch => ({
    id, round_number: round, base_id: baseId, team_a: a, team_b: b, status: 'pending', arrived_at: null, finished_at: null, ...o,
  })
  const all = [tm('p', 1, 'other', 'a', 'x', { status: 'finished', finished_at: new Date(ago(15)).toISOString() }), tm('m', 2, 'atrio', 'a', 'b')]

  it('without a notice it counts from the end of the match; with a recent one the group is not late and has the full time left', () => {
    expect(lateTeams(all, 10, NOW).map((l) => l.teamId)).toEqual(['a'])
    const notice: RotationTimes = new Map([[1, ago(2)]])
    expect(lateTeams(all, 10, NOW, new Map(), notice)).toEqual([])
    const info = legInfo(all, 'm', 'a', 10, new Map(), notice) as Extract<LegInfo, { kind: 'walking' }>
    expect(legRemainingSec(info, NOW)).toBe(8 * 60)
  })

  it('a notice from BEFORE the match ended changes nothing', () => {
    expect(lateTeams(all, 10, NOW, new Map(), new Map([[1, ago(40)]])).map((l) => l.teamId)).toEqual(['a'])
  })

  it('a group with no previous match walks from the start of the Carrera; before it starts there is no clock', () => {
    const first = [tm('m', 1, 'atrio', 'a', 'b')]
    expect(legInfo(first, 'm', 'a', 10).kind).toBe('none')
    expect(legInfo(first, 'm', 'a', 10, new Map(), new Map(), ago(3))).toMatchObject({ kind: 'walking', fromBaseId: null, allowedMin: 10 })
  })
})
