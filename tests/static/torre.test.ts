// The two experiences of "Visado": the runner's passport (light paper) and the coordinator's control tower (always dark).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')
const css = read('src/index.css')

describe('control tower (coordinator)', () => {
  it('the panel is always dark, whatever the mode of the app: it has its own palette and no light/dark switch', () => {
    expect(read('src/pages/admin/AdminLayout.tsx')).toMatch(/className="admin tower"/)
    expect(css).toMatch(/\.tower \{\s*color-scheme: dark;/)
    expect(read('src/pages/admin/AdminNav.tsx')).toMatch(/showTheme=\{false\}/)
    expect(read('src/components/AccountMenu.tsx')).toMatch(/showTheme && \(/)
    expect(read('src/pages/admin/Mapa.tsx')).toMatch(/lightPreset="night"/)
  })

  it('both palettes define the same tower colours (they are variables, never literals in the layer)', () => {
    const blocks = [/\n:root \{[\s\S]*?\n\}/.exec(css)![0], /\n:root\[data-theme='light'\] \{[\s\S]*?\n\}/.exec(css)![0]]
    const names = (b: string) => [...b.matchAll(/(--tw-[\w-]+)\s*:/g)].map((m) => m[1]).sort()
    expect(names(blocks[0]).length).toBeGreaterThan(10)
    expect(names(blocks[0])).toEqual(names(blocks[1]))
  })

  it('the modules read real data: flights from the matches, the log from matches and alerts, the verification from the matches of each group', () => {
    const live = read('src/pages/admin/EnVivo.tsx')
    expect(live).toMatch(/from\('alerts'\)/)
    expect(live).toMatch(/buildOpEvents\(\{ matches, alerts/)
    expect(live).toMatch(/<FlightBoard teams=\{teams\} matches=\{matches\}/)
    expect(read('src/components/FlightBoard.tsx')).toMatch(/flightOf\(t\.id, matches\)/)
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/Passport Verification/)
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/<PassportMatrix teams=\{teams\} matches=\{matches\}/)
    // nothing simulated: no random data or placeholder numbers in the control components
    for (const f of ['src/components/FlightBoard.tsx', 'src/components/OpsLog.tsx', 'src/lib/flight.ts']) expect(read(f), f).not.toMatch(/Math\.random|faker|lorem/i)
  })

  it('the call sign of a group is the same on the runner phone and on the coordinator panel', () => {
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/flightCodes\(teams\.map/)
    expect(read('src/pages/admin/EnVivo.tsx')).toMatch(/flightCodes\(teams\)/)
  })
})

describe('official logo', () => {
  it('is used from its own files, with its natural proportions (width and height attributes of the file, never stretched)', () => {
    for (const f of ['src/pages/Login.tsx', 'src/components/Passport.tsx', 'src/pages/admin/AdminNav.tsx']) {
      expect(read(f), f).toMatch(/width=\{480\} height=\{627\}/)
    }
    expect(css).toMatch(/\.uni-mark \{[^}]*width: auto/)
    expect(css).toMatch(/\.tower-uni \{[^}]*width: auto/)
  })
})
