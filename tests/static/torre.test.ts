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
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/<h1>Puntajes<\/h1>/)
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/<PassportMatrix teams=\{teams\} matches=\{matches\}/)
    // nothing simulated: no random data or placeholder numbers in the control components
    for (const f of ['src/components/FlightBoard.tsx', 'src/components/OpsLog.tsx', 'src/lib/flight.ts']) expect(read(f), f).not.toMatch(/Math\.random|faker|lorem/i)
  })

  it('the call sign of a group is the same on the runner phone and on the coordinator panel', () => {
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/flightCodes\(teams\.map/)
    expect(read('src/pages/admin/EnVivo.tsx')).toMatch(/flightCodes\(teams\)/)
  })
})

describe('CarreApp logo (the crest, dorado)', () => {
  it('is one component painted with masks, used on the login, the menus and the bars, and never stretched (width follows the height)', () => {
    const logo = read('src/components/Logo.tsx')
    expect(logo).toMatch(/logo-crest/)
    expect(logo).toMatch(/logo-word/)
    expect(css).toMatch(/\.logo-crest \{[^}]*width: calc\(var\(--logo-s, 34px\) \* \.915\)/)
    for (const f of ['src/pages/Login.tsx', 'src/pages/admin/AdminNav.tsx', 'src/components/AppShell.tsx']) expect(read(f), f).toMatch(/<Logo/)
  })

  it('the cover of the passport shows the gold crest and the identity page the compact one, with the proportions of their files', () => {
    const pass = read('src/components/Passport.tsx')
    expect(pass).toMatch(/src="\/crest-dorado\.svg" alt="CarreApp" width=\{1110\} height=\{1215\}/)
    expect(pass).toMatch(/src="\/crest-simple\.svg" alt="CarreApp" width=\{569\} height=\{622\}/)
    expect(css).toMatch(/\.cover-uni \{[^}]*width: auto/)
  })

  it('the installable icons and the favicon are the gold crest without the name, and the old logo gallery is gone', () => {
    expect(fs.existsSync(rootPath('src/components/logos.tsx'))).toBe(false)
    expect(fs.existsSync(rootPath('src/pages/LogoGallery.tsx'))).toBe(false)
    expect(read('vite.config.ts')).toMatch(/pwa-maskable-512\.png/)
    expect(read('public/favicon.svg')).not.toMatch(/<text/)
  })
})
