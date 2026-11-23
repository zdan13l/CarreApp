// Admin panel in two modes (2026-11-18): Preparación (create the Carrera) and En carrera (watch it run).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('the admin panel has three levels (global, carreras, one carrera)', () => {
  const nav = read('src/pages/admin/AdminNav.tsx')
  it('the side menu separates the carreras, the open carrera and the global administration', () => {
    expect(nav).toMatch(/export const GLOBAL_TABS/)
    expect(nav).toMatch(/export const CARRERA_TABS/)
    expect(nav).toMatch(/Administración global/)
    for (const g of ['inductores', 'programas', 'comites', 'insignias', 'sellos']) expect(nav).toContain(`/admin/${g}`)
  })
  it('what belongs to ONE carrera hangs from /admin/carreras/<id>, and the global pages are outside of it', () => {
    const app = read('src/App.tsx')
    expect(app).toMatch(/path="carreras\/:eventId" element=\{<CarreraShell \/>\}/)
    for (const s of ['configuracion', 'grupos', 'bases', 'cruces', 'usuarios', 'puntajes', 'mapa']) expect(app).toContain(`path="${s}"`)
    expect(app).toMatch(/LegacyRedirect/) // the old addresses keep working
    const lay = read('src/pages/admin/AdminLayout.tsx')
    expect(lay).toMatch(/useMatch\('\/admin\/carreras\/:eventId\/\*'\)/) // the open carrera comes from the address
  })
  it('the carrera shell always shows which carrera it is, its state and what is allowed now', () => {
    const shell = read('src/pages/admin/CarreraShell.tsx')
    expect(shell).toMatch(/PHASE_LABEL\[event\.phase\]/)
    expect(shell).toMatch(/ALLOWED\[event\.phase\]/)
    expect(shell).toMatch(/PRUEBA/)
  })
})

describe('creating the carrera and ending it', () => {
  it('the settings open with the ordered steps to create the carrera, scoped to the open carrera', () => {
    const car = read('src/pages/admin/Carrera.tsx')
    expect(car).toMatch(/export function PrepSteps/)
    expect(car).toMatch(/Pasos para crear la carrera/)
    for (const s of ['grupos', 'bases', 'usuarios', 'cruces']) expect(car).toContain('/admin/carreras/${eventId}/' + s)
  })
  it('carreras are created with the next code by the database, never typed, and never deleted from the panel', () => {
    const list = read('src/pages/admin/Carreras.tsx')
    expect(list).toMatch(/rpc\('create_event', \{ p_theme: template \}\)/)
    expect(list).toMatch(/rpc\('next_event_code'\)/)
    for (const f of ['Carreras.tsx', 'Carrera.tsx', 'CarreraShell.tsx', 'PhaseControl.tsx']) expect(read(`src/pages/admin/${f}`), f).not.toMatch(/from\('events'\)\.delete\(\)/)
    expect(read('src/pages/admin/Carrera.tsx')).not.toMatch(/DeleteEvent/)
  })
  it('the carrera has five states with one control, finishing keeps the data and disabling still warns that the progress is reset', () => {
    const ctl = read('src/pages/admin/PhaseControl.tsx')
    for (const label of ['Habilitar carrera', 'Iniciar carrera', 'Terminar carrera', 'Finalizar carrera', 'Reabrir', 'Reiniciar', 'Deshabilitar']) expect(ctl).toContain(label)
    expect(ctl).toMatch(/rpc\('event_action'/)
    expect(ctl).toMatch(/se REINICIA su avance/)
    expect(ctl).toMatch(/CON TODOS SUS DATOS/)
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

describe('what is particular of each carrera (phase B, 0037)', () => {
  it('the carrera has its own theme, seals, committees, coordi and inductores', () => {
    const app = read('src/App.tsx')
    for (const s of ['tematica', 'sellos', 'inductores', 'comites']) expect(app).toContain(`path="${s}"`)
    expect(read('src/pages/admin/AdminNav.tsx')).toMatch(/path: 'tematica'[\s\S]*path: 'sellos'[\s\S]*path: 'inductores'[\s\S]*path: 'comites'/)
  })
  it('the theme page edits the carrera\'s own theme (by its semester), never a template', () => {
    expect(read('src/pages/admin/CarreraTematica.tsx')).toMatch(/from\('themes'\)\.select\('key, name'\)\.eq\('term_id', termId\)/)
    expect(read('src/pages/admin/Programas.tsx')).toMatch(/filter\(\(t\) => !t\.termId\)/) // the global page lists templates only
  })
  it('the seals page offers shape, colour and picture with a preview, and the coordi seal is golden', () => {
    const p = read('src/pages/admin/CarreraSellos.tsx')
    for (const w of ['Forma', 'Color', 'Subir imagen', 'Previsualización del sello', 'gold={e.kind === \'coordinator\'}']) expect(p).toContain(w)
    expect(read('src/lib/eventSeals.ts')).toMatch(/ya lo usa otro elemento/)
  })
  it('the coordi and the committees of a carrera are chosen inside it; the global committees page only keeps the catalog', () => {
    expect(read('src/pages/admin/CarreraComites.tsx')).toMatch(/from\('event_committees'\)/)
    expect(read('src/pages/admin/CarreraComites.tsx')).toMatch(/coordinator_id/)
    expect(read('src/pages/admin/Comites.tsx')).not.toMatch(/setCoordi/)
  })
  it('the inductores of a carrera are the records of ITS semester (the picker is fixed)', () => {
    expect(read('src/pages/admin/CarreraInductores.tsx')).toMatch(/fixedTermId=\{event\.term_id\}/)
  })
})
