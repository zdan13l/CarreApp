// Notifications that always ring, pretty pop-ups, funny passwords, who won each item.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath, sourceFiles } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('push notifications', () => {
  const sw = read('src/sw.ts')
  it('every alert is a brand new notification: older ones are taken down first and the tag is unique', () => {
    expect(sw).toMatch(/getNotifications\(\)/)
    expect(sw).toMatch(/previous\.forEach\(\(n\) => n\.close\(\)\)/)
    expect(sw).toMatch(/tag: `\$\{data\.tag \?\? 'carreapp'\}-\$\{Date\.now\(\)\}`/)
    expect(sw).not.toMatch(/renotify/)
  })
  it('stays on screen until it is read, and does not die in a minute if the phone is slow', () => {
    expect(sw).toMatch(/requireInteraction: true/)
    expect(read('api/push.ts')).toMatch(/TTL: 180/)
  })
  it('a new in-app alert rings at once even if an older one is still showing', () => {
    expect(read('src/lib/alerts.ts')).toMatch(/newestFresh[\s\S]*playAlertSound\(\)/)
  })
})

describe('pop-ups', () => {
  it('no screen uses the browser confirm() or prompt() any more: they all go through the dialog host', () => {
    const offenders = sourceFiles('src')
      .filter((f) => f.file !== 'src/lib/dialog.ts' && /window\.(confirm|prompt|alert)\(/.test(f.text))
      .map((f) => f.file)
    expect(offenders).toEqual([])
    expect(read('src/App.tsx')).toMatch(/<DialogHost \/>/)
  })
  it('the dialog is a sheet from the bottom on a phone, closes with Escape and respects reduced motion', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/\.dialog-backdrop \{ place-items: end center/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{ \.dialog, \.dialog-backdrop \{ animation: none; \} \}/)
    expect(read('src/components/DialogHost.tsx')).toMatch(/e\.key === 'Escape'/)
  })
})

describe('the settings bell and the base history', () => {
  it('the sound and notification switches live in the account sheet, between the theme and "Cerrar sesión" (no bell in the top bar)', () => {
    const menu = read('src/components/AccountMenu.tsx')
    expect(menu).toMatch(/\{alerts && <AlertSettings \/>\}/)
    expect(menu.indexOf('Modo claro')).toBeLessThan(menu.indexOf('<AlertSettings />'))
    expect(menu.indexOf('<AlertSettings />')).toBeLessThan(menu.indexOf('account-action danger'))
    expect(read('src/components/Alerts.tsx')).not.toMatch(/AlertBell/)
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/alerts=\{Boolean\(team\)\}/)
    expect(read('src/pages/BaseHome.tsx')).toMatch(/alerts=\{Boolean\(base\)\}/) // the base uses the same sheet
    expect(read('src/components/AppShell.tsx')).toMatch(/alerts=\{alerts\}/)
  })
  it('"Cruces de tu base" says who won each item', () => {
    expect(read('src/pages/BaseHome.tsx')).toMatch(/<WonItems match=\{m\} teams=\{teams\} \/>/)
  })
})
