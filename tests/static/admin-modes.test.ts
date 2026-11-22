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
  it('the Carrera has four states with one control (Preparación and En carrera), and disabling still warns that the progress is reset', () => {
    const ctl = read('src/pages/admin/PhaseControl.tsx')
    for (const label of ['Habilitar Carrera', 'Iniciar Carrera', 'Terminar Carrera', 'Reiniciar', 'Deshabilitar']) expect(ctl).toContain(label)
    expect(ctl).toMatch(/rpc\('event_action'/)
    expect(ctl).toMatch(/se REINICIA todo su avance/)
    // the final results are saved to a file before anything is erased
    expect(ctl).toMatch(/exportResults/)
    expect(read('src/pages/admin/EnVivo.tsx')).toMatch(/<PhaseControl/)
    expect(read('src/pages/admin/Carrera.tsx')).toMatch(/<PhaseControl/)
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/Descargar resultados/)
  })
})

describe('alerts do not pile up after a reload', () => {
  const al = read('src/lib/alerts.ts')
  it('closed alerts are remembered on the phone and only the newest one is shown', () => {
    expect(al).toMatch(/carreapp\.dismissedAlerts/)
    expect(al).toMatch(/alerts: newest && enabled \? \[newest\] : \[\]/)
    expect(al).toMatch(/closing the newest one also closes the older ones/)
  })
})
