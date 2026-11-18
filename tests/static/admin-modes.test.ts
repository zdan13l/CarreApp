// Admin panel in two modes (2026-11-18): Preparación (create the Carrera) and En carrera (watch it run).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('the admin panel has two modes', () => {
  const nav = read('src/pages/admin/AdminNav.tsx')
  it('the side menu shows only the screens of the current mode, with a switch between Preparación and En carrera', () => {
    expect(nav).toMatch(/role="tablist" aria-label="Modo del panel"/)
    expect(nav).toMatch(/\(mode === 'live' \? LIVE_TABS : SETUP_TABS\)\.map/)
  })
  it('the live mode has nothing to create: no users, groups, bases or schedule', () => {
    const live = /export const LIVE_TABS[\s\S]*?\]\r?\n/.exec(nav)![0]
    expect(live).not.toMatch(/usuarios|grupos|bases|cruces|carrera/i)
  })
  it('starting or ending a Carrera moves the panel to the right mode by itself', () => {
    const lay = read('src/pages/admin/AdminLayout.tsx')
    expect(lay).toMatch(/chosen \?\? \(running \? 'live' : 'setup'\)/)
    expect(lay).toMatch(/navigate\(running \? '\/admin' : '\/admin\/carrera'\)/)
  })
})

describe('creating the Carrera and ending it', () => {
  it('Preparación opens with the ordered steps to create the Carrera', () => {
    const car = read('src/pages/admin/Carrera.tsx')
    expect(car).toMatch(/export function PrepSteps/)
    expect(car).toMatch(/Pasos para crear la Carrera/)
    for (const to of ['/admin/grupos', '/admin/bases', '/admin/usuarios', '/admin/cruces']) expect(car).toContain(to)
  })
  it('En carrera can end the Carrera, and both ways of switching it off warn that the progress is reset', () => {
    const ev = read('src/pages/admin/EnVivo.tsx')
    expect(ev).toMatch(/Finalizar Carrera/)
    expect(ev).toMatch(/Se REINICIA todo su avance/)
    expect(read('src/pages/admin/Carrera.tsx')).toMatch(/se REINICIA todo su avance/)
  })
})

describe('alerts do not pile up after a reload', () => {
  const al = read('src/lib/alerts.ts')
  it('closed alerts are remembered on the phone and only the newest one is shown', () => {
    expect(al).toMatch(/carreapp\.dismissedAlerts/)
    expect(al).toMatch(/alerts: newest \? \[newest\] : \[\]/)
    expect(al).toMatch(/closing the newest one also closes the older ones/)
  })
})
