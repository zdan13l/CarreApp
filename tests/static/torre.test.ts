// "Visado": the runner's passport, the base's counter and the coordinator's control center share one design language and the light / dark mode.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')
const css = read('src/index.css')

describe('control tower (coordinator)', () => {
  it('the panel follows the light / dark mode of the app, like the runner and the base (no palette of its own)', () => {
    expect(read('src/pages/admin/AdminLayout.tsx')).toMatch(/className="admin tower"/)
    expect(css).not.toMatch(/\.tower \{\s*color-scheme: dark;/) // it is not locked to dark any more
    expect(css).not.toMatch(/--tw-/) // the instrument palette (cyan / radar green) is gone: the panel uses the tokens of the app
    expect(read('src/pages/admin/AdminNav.tsx')).not.toMatch(/showTheme=\{false\}/)
    expect(read('src/components/AccountMenu.tsx')).toMatch(/showTheme && \(/)
    expect(read('src/pages/admin/Mapa.tsx')).toMatch(/lightPreset="night"/) // the radar map keeps its night look inside the navy frame
  })

  it('it speaks the language of the runner and the base: navy desk, boarding-pass tickets, gold foil, the paper pattern', () => {
    const layer = css.slice(css.indexOf('Capa de diseño 6'))
    for (const piece of ['.tower .admin-nav', '.tower .kpis', '.tower .board', '.tower .list.gates li.mrow', '.carrera-pass', '.step-tag', '.title-row']) expect(layer, piece).toContain(piece)
    expect(layer).toMatch(/var\(--pass-navy\)/)
    expect(layer).toMatch(/var\(--foil\)/)
    expect(layer).toMatch(/login-pattern\.svg/)
    expect(layer).toMatch(/login-pattern-dark\.svg/) // the night pattern in dark mode
    // the head of a carrera and every carrera of the list are the same boarding pass the runners know
    expect(read('src/components/CarreraTicket.tsx')).toMatch(/className="tc-wrap carrera-ticket"/)
    expect(read('src/pages/admin/Carreras.tsx')).toMatch(/className="tc-stub"/)
    // no kicker above the headings of the panel: the heading speaks, and the step is a tag
    for (const f of ['EnVivo', 'Grupos', 'Bases', 'Cruces', 'Usuarios', 'Puntajes', 'Mapa', 'Carreras', 'Sellos', 'Generaciones']) expect(read(`src/pages/admin/${f}.tsx`), f).not.toMatch(/className="eyebrow"/)
  })

  it('the colours the navy needs exist in both palettes with the same value (variables, never literals in the layer)', () => {
    const blocks = [/\n:root \{[\s\S]*?\n\}/.exec(css)![0], /\n:root\[data-theme='light'\] \{[\s\S]*?\n\}/.exec(css)![0]]
    for (const token of ['--on-hero-ok', '--on-hero-warn', '--on-hero-danger', '--pass-navy', '--pass-gold', '--foil']) {
      const values = blocks.map((b) => new RegExp(`${token}:\\s*([^;]+);`).exec(b)?.[1])
      expect(values[0], token).toBeTruthy()
      expect(values[0], token).toEqual(values[1])
    }
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
