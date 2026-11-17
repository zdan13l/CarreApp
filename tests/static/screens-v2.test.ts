// Screen changes of 2026-11-17: nobody on a phone sees who leads, no walking map, location only for the designated user,
// a hand-made schedule, alerts to the base, medals for the coordinator.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('the runner screen', () => {
  const run = read('src/pages/RunnerHome.tsx')
  it('never loads or shows points of other groups, nor the position', () => {
    expect(run).not.toMatch(/team_standings/)
    expect(run).not.toMatch(/position/i)
    expect(run).not.toMatch(/Puesto/)
    expect(run).toMatch(/<StatusBar name=\{team\.name\} photoPath=\{team\.photo_path\} \/>/)
  })
  it('has no walking map; the location tab exists only for the designated user, with a fixed map', () => {
    expect(fs.existsSync(rootPath('src/components/RunnerMap.tsx'))).toBe(false)
    expect(run).toMatch(/isTracker \? \[TABS\[0\], LOCATION_TAB, TABS\[1\], TABS\[2\]\] : TABS/)
    expect(read('src/components/LocationShare.tsx')).toMatch(/interactive=\{false\}/)
    expect(read('src/components/LocationShare.tsx')).not.toMatch(/fetchWalkingRoute/)
  })
  it('Top shows the own team with its points and every group by name only', () => {
    expect(run).toMatch(/export function TopTab[\s\S]*Tu equipo[\s\S]*<TeamNames/)
    expect(read('src/components/TeamNames.tsx')).not.toMatch(/points|pts/)
  })
})

describe('the base screen', () => {
  const base = read('src/pages/BaseHome.tsx')
  it('has no ranking: groups by name and picture, and the history of what it scored', () => {
    expect(base).not.toMatch(/team_standings|<Ranking|Top equipos/)
    expect(base).toMatch(/<TeamNames teams=/)
    expect(base).toMatch(/Cruces de tu base/)
  })
  it('shows a calm explanation when the Carrera is not active, and plain words if the database refuses an action', () => {
    expect(base).toMatch(/<NoActiveCarrera role="base" \/>/)
    expect(base).toMatch(/La Carrera no está activa para tu usuario/)
  })
  it('receives the alerts of the coordinator (sound and notification settings included)', () => {
    expect(base).toMatch(/useManualAlerts\(matches\.map\(\(m\) => m\.id\), 'base'\)/)
    expect(base).toMatch(/<AlertSettings \/>/)
  })
})

describe('the coordinator screens', () => {
  it('the schedule is made by hand: no automatic proposal', () => {
    expect(read('src/pages/admin/Cruces.tsx')).not.toMatch(/generateSchedule|Generar propuesta/)
  })
  it('En vivo can alert the groups or the base of a match', () => {
    const ev = read('src/pages/admin/EnVivo.tsx')
    expect(ev).toMatch(/hurry\(m, 'groups'\)/)
    expect(ev).toMatch(/hurry\(m, 'base'\)/)
    expect(read('src/components/DelaysPanel.tsx')).toMatch(/target: 'groups' \| 'base'/)
  })
  it('the first three of the ranking get a gold, silver and bronze frame', () => {
    expect(read('src/components/Ranking.tsx')).toMatch(/medal-\$\{position\}/)
    const css = read('src/index.css')
    for (const n of [1, 2, 3]) expect(css).toMatch(new RegExp(`\.top-teams li\.medal-${n}`))
  })
  it('deleting a Carrera removes everything: users and photos, no optional checkbox', () => {
    const car = read('src/pages/admin/Carrera.tsx')
    expect(car).toMatch(/deletePhotos\(/)
    expect(car).not.toMatch(/withUsers/)
  })
})

describe('maps', () => {
  const map = read('src/components/MapView.tsx')
  it('can be fixed (not interactive) and hides the labels that would overlap', () => {
    expect(map).toMatch(/interactive = true/)
    expect(map).toMatch(/function declutterLabels/)
    expect(read('src/index.css')).toMatch(/\.mk\.hide-label \.mk-label \{ display: none; \}/)
  })
})
