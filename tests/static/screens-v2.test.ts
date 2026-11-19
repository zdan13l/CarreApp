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
    expect(run).toMatch(/<StatusBar name=\{team\.name\} photoPath=\{team\.photo_path\} points=\{myPoints\} \/>/)
  })
  it('has no walking map; the location tab exists only for the designated user, with a fixed map', () => {
    expect(fs.existsSync(rootPath('src/components/RunnerMap.tsx'))).toBe(false)
    expect(run).toMatch(/isTracker \? \[TABS\[0\], LOCATION_TAB, TABS\[1\], TABS\[2\]\] : TABS/)
    expect(read('src/components/LocationShare.tsx')).toMatch(/<LazyMap[^>]*recenter/) // a map that moves, with a button that centres it on the campus
    expect(read('src/components/LocationShare.tsx')).not.toMatch(/fetchWalkingRoute/)
  })
  it('Top shows the same passenger ticket as Visado and the OTHER groups under a white title card; no flight code on the ticket', () => {
    expect(run).toMatch(/export function TopTab[\s\S]*<StatusBar[\s\S]*title-tag[\s\S]*<TeamNames/)
    expect(run).toMatch(/tab === 'ronda' && \([\s\S]*<StatusBar/)
    expect(run).not.toMatch(/flight-chip/)
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

describe('the runner phone screen (visado pass)', () => {
  const read2 = (f: string) => fs.readFileSync(rootPath(f), 'utf8')
  it('the cover of the passport is shown every time the tab opens and waits for a tap', () => {
    const p = read2('src/components/Passport.tsx')
    expect(p).not.toMatch(/sessionStorage/)
    expect(p).toMatch(/useState<'closed' \| 'opening' \| 'open'>\('closed'\)/)
    expect(p).not.toMatch(/setPhase\('opening'\), 900/)
  })
  it('the main card shows the points, not "x de y destinos"', () => {
    expect(read2('src/pages/RunnerHome.tsx')).not.toMatch(/de \{stamps\.total\} destinos|destinos`\}/)
  })
  it('the sound switch decides what a tap means from how it looked when the finger went down', () => {
    expect(read2('src/components/Alerts.tsx')).toMatch(/asleepOnPress/)
    expect(read2('src/lib/alerts.ts')).toMatch(/export function useSoundEnabled/)
  })
  it('the tabs slide by themselves and the page turn is not doubled', () => {
    expect(read2('src/pages/RunnerHome.tsx')).toMatch(/className=\{`tab-view \$\{dir\}`\}/)
    expect(read2('src/pages/RunnerHome.tsx')).toMatch(/transition=\{false\}/)
  })
  it('a stamp opens big in a dialog drawn outside the booklet (its perspective would trap a fixed overlay)', () => {
    const p = read2('src/components/Passport.tsx')
    expect(p).toMatch(/createPortal\(/)
    expect(p).toMatch(/aria-haspopup="dialog"/)
  })
  it('the pattern of the entrance is behind every runner tab', () => {
    expect(read2('src/index.css')).toMatch(/html:has\(\.tab-view\), body:has\(\.tab-view\)/)
  })
  it('the top bar uses the full crest, big', () => {
    expect(read2('src/components/AppShell.tsx')).toMatch(/<Logo size=\{44\} detail \/>/)
  })
})

describe('the stamp moment, the passport and the top-bar buttons', () => {
  const read3 = (f: string) => fs.readFileSync(rootPath(f), 'utf8')
  it('the new stamp stays on screen until the person taps "Seguir"', () => {
    const m = read3('src/components/StampMoment.tsx')
    expect(m).not.toMatch(/setTimeout/)
    expect(m).not.toMatch(/<div className="moment"[^>]*onClick/)
    expect(m).toMatch(/Seguir/)
  })
  it('the passport does not say "Passport" and the cover says Carrera 2710', () => {
    const p = read3('src/components/Passport.tsx')
    expect(p).not.toMatch(/Passport ·|· Passport/)
    expect(p).toMatch(/cover-sub">Carrera 2710</)
  })
  it('the bell keeps one colour (the state is the icon and the light), and the phone bar shows the first name', () => {
    const css = read3('src/index.css')
    expect(css).not.toMatch(/\.bell\.is-on \{ color/)
    expect(css).toMatch(/\.topbar button\.bell\.ghost \{/)
    expect(read3('src/components/AppShell.tsx')).toMatch(/<AccountMenu short/)
  })
})

describe('runner round 3: dialogs, map, passport and finish card', () => {
  const read4 = (f: string) => fs.readFileSync(rootPath(f), 'utf8')
  it('dialogs lock the page behind them (stamp moment, stamp zoom, account sheet, alerts sheet)', () => {
    expect(read4('src/lib/scrollLock.ts')).toMatch(/overflow = 'hidden'/)
    for (const f of ['src/components/StampMoment.tsx', 'src/components/Passport.tsx', 'src/components/AccountMenu.tsx', 'src/components/Alerts.tsx']) {
      expect(read4(f), f).toMatch(/useScrollLock\(/)
    }
  })
  it('the finished route is a celebration with the stamps and a way to the passport, not one line of text', () => {
    const run = read4('src/pages/RunnerHome.tsx')
    expect(run).toMatch(/<FinishedCard/)
    expect(run).not.toMatch(/Terminaste todos tus cruces/)
    expect(run).toMatch(/Ver mi pasaporte/)
  })
  it('the map has a "Centrar" button and the location tab keeps only the share button', () => {
    expect(read4('src/components/MapView.tsx')).toMatch(/Centrar el mapa en la Javeriana/)
    const loc = read4('src/components/LocationShare.tsx')
    expect(loc).not.toMatch(/Ubicación del grupo|usuario designado para el GPS/)
    expect(loc).toMatch(/Compartir mi ubicación/)
  })
  it('the top button opens a sheet with the big photo, the theme switch and sign out; the bar shows the @user', () => {
    const a = read4('src/components/AccountMenu.tsx')
    expect(a).toMatch(/account-sheet/)
    expect(a).toMatch(/size=\{148\}/)
    expect(a).toMatch(/`@\$\{user\?\.username \?\? ''\}`/)
    expect(read4('src/index.css')).toMatch(/\.topbar \{[^}]*background: var\(--surface\)/)
  })
  it('the alerts sheet has no explanation paragraph', () => {
    const a = read4('src/components/Alerts.tsx')
    expect(a).not.toMatch(/Para que te avisemos/)
  })
  it('the passport slides only (no page buttons), keeps one size, shows the total and has no "tap a stamp" hint', () => {
    const p = read4('src/components/Passport.tsx')
    expect(p).not.toMatch(/Página anterior|Página siguiente|slot-hint|Toca un sello/)
    expect(p).toMatch(/stamp-total/)
    expect(p).toMatch(/leaf-body/)
    expect(read4('src/index.css')).toMatch(/\.leaf \{ display: flex; flex-direction: column; height: var\(--leaf-h\)/)
    expect(read4('src/index.css')).toMatch(/\.leaf \.mrz \{[^}]*text-align: center/)
  })
})
