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
  it('the carrera shell says which carrera it is and its state (a thin strip on phones; the side menu does it on computers), with no bar of tabs', () => {
    const shell = read('src/pages/admin/CarreraShell.tsx')
    expect(shell).toMatch(/PHASE_LABEL\[event\.phase\]/)
    expect(shell).toMatch(/PRUEBA/)
    expect(shell).not.toMatch(/carrera-tabs|NavLink/)
  })
})

describe('creating the carrera and ending it', () => {
  it('the ordered steps to prepare the carrera live in Resumen y control, scoped to the open carrera, and Configuración only holds settings', () => {
    const steps = read('src/components/PrepSteps.tsx')
    expect(steps).toMatch(/Pasos para preparar la carrera/)
    expect(steps).toContain('/admin/carreras/${eventId}/${path}')
    for (const s of ['configuracion', 'tematica', 'grupos', 'bases', 'cruces', 'comites', 'inductores', 'usuarios']) expect(steps).toContain(`to('${s}')`)
    expect(read('src/pages/admin/EnVivo.tsx')).toMatch(/<PrepSteps /)
    const car = read('src/pages/admin/Carrera.tsx')
    expect(car).not.toMatch(/PrepSteps|event_problems/) // the checklist is not repeated in Configuración
    expect(car).toMatch(/<BulkImport \/>/)
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
    for (const s of ['tematica', 'inductores', 'comites']) expect(app).toContain(`path="${s}"`)
    expect(read('src/pages/admin/AdminNav.tsx')).toMatch(/path: 'tematica'[\s\S]*path: 'comites'[\s\S]*path: 'inductores'/)
    // the old Sellos tab of a carrera sends to the workshop (the only place where seals are made)
    expect(app).toMatch(/path="sellos" element=\{<SealsRedirect \/>\}/)
  })
  it('the theme page edits the carrera\'s own theme (by its semester), never a template', () => {
    expect(read('src/pages/admin/CarreraTematica.tsx')).toMatch(/from\('themes'\)\.select\('key, name'\)\.eq\('term_id', termId\)/)
    expect(read('src/pages/admin/Programas.tsx')).toMatch(/filter\(\(t\) => !t\.termId\)/) // the global page lists templates only
  })
  it('the seal editor offers shape, colour and picture with a preview, and the coordi seal is golden', () => {
    const p = read('src/components/SealEditor.tsx')
    for (const w of ['Forma', 'Color', 'Subir imagen', 'Previsualización del sello']) expect(p).toContain(w)
    expect(read('src/components/ElementSeal.tsx')).toContain("gold={e.kind === 'coordinator'}")
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

describe('the seals of a carrera are used in the passports (0038)', () => {
  it('the culture and committee seals take the carrera\'s own seal when it has one', () => {
    expect(read('src/components/Seals.tsx')).toMatch(/sealOverride\(eventOfTheme\(theme\), 'subtheme', culture\)/)
    expect(read('src/components/CommitteeSeal.tsx')).toMatch(/sealOverride\(eventId, 'committee', c\.key\)/)
    expect(read('src/components/MemberPassport.tsx')).toMatch(/eventId=\{eventOfTerm\(record\.term_id\)\}/)
    expect(read('src/lib/passportPdf.ts')).toMatch(/eventSealFilesOf\(/) // the PDF embeds their pictures
  })
  it('the stamps of the bases use the edited seal, and every seal belongs to one carrera', () => {
    expect(read('src/lib/seals.ts')).toMatch(/baseOverrides\.get\(seed\)/)
    expect(read('src/lib/seals.ts')).toMatch(/c\.eventId === eventId/)
    expect(read('src/components/CustomSealsManager.tsx')).toMatch(/event_id: eventId/) // an uploaded seal is tied to its carrera
    expect(read('src/pages/admin/Sellos.tsx')).toMatch(/Editar el de siempre/)
  })
})

describe('nothing is entered twice in the panel', () => {
  const pages = ['Carreras', 'Carrera', 'CarreraShell', 'CarreraTematica', 'CarreraComites', 'CarreraInductores', 'Comites', 'Programas', 'Insignias', 'Sellos', 'EnVivo', 'Grupos', 'Bases', 'Cruces', 'Usuarios', 'Puntajes', 'Mapa', 'Inductores'].map((p) => [p, read(`src/pages/admin/${p}.tsx`)] as const)
  const using = (re: RegExp) => pages.filter(([, src]) => re.test(src)).map(([name]) => name)

  it('the state of a carrera is controlled in ONE place (Resumen y control)', () => {
    expect(using(/<PhaseControl/)).toEqual(['EnVivo'])
  })
  it('a PERSON is created in ONE place: Administración global → Inductores (inside a carrera people only join it)', () => {
    const src = read('src/pages/admin/Inductores.tsx')
    expect(src).toMatch(/\{!isCarrera && panel === 'new' && \(\s*<section className="card panel-card">\s*<h2>Registrar inductor\/a nuevo<\/h2>\s*<NewInductorForm/) // one by one
    expect(src).toMatch(/\{!isCarrera && panel === 'bulk' && \(\s*<section className="card panel-card">\s*<h2>Carga masiva con Excel<\/h2>\s*<InductorsBulk/) // many at once
    expect(src).toMatch(/\{isCarrera && term && \(\s*<form className="card add-person" onSubmit=\{\(e\) => \{ e\.preventDefault\(\); void onJoin/) // inside a carrera they only join
    expect(src).not.toMatch(/createPassportUser\(/) // the page never creates a login: the form and the Excel do, through createInductor
    expect(src).toMatch(/view\?: 'global' \| 'carrera'/)
    expect(src).toMatch(/\{view === 'global' && editing && !locked && \(\s*<div className="person-editor-slot">/) // the profile is edited only globally, and not while an ancestor or disabled
    const makers = ['src/pages', 'src/components'].flatMap((d) => fs.readdirSync(rootPath(d), { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f)).map((f) => `${d}/${f}`)).filter((f) => /createInductor\(|createPassportUser\(/.test(read(f)))
    expect(makers.sort()).toEqual(['src/components/InductorsBulk.tsx', 'src/components/NewInductorForm.tsx'])
    expect(read('src/lib/inductors.ts').match(/createPassportUser\(/g)?.length).toBe(1) // and only one place calls the server
  })
  it('seals are made in ONE place: the workshop (Administración global → Sellos); the sections only show theirs', () => {
    expect(using(/uploadSeal\(/)).toEqual([]) // no page uploads: the manager (used by the workshop) does
    expect(using(/saveEventSeal\(|saveGenerationSeal\(/)).toEqual(['Sellos']) // only the workshop saves a seal
    expect(read('src/components/CustomSealsManager.tsx')).toMatch(/uploadSeal\(/)
    expect(read('src/pages/admin/Sellos.tsx')).toMatch(/<CustomSealsManager eventId=\{event\.id\}/)
    const section = read('src/components/SectionSeals.tsx')
    expect(section).not.toMatch(/saveEventSeal|removeEventSeal|type="file"/) // read only
    expect(section).toMatch(/workshopLink\(/)
  })
  it('the history of results has ONE entry in the menu, and the names do not clash', () => {
    const nav = read('src/pages/admin/AdminNav.tsx')
    expect(nav.match(/\/admin\/historial/g)?.length).toBeLessThanOrEqual(3) // the link, the mobile link, the active check
    expect(nav).toMatch(/label: 'Grupos participantes'/)
    expect(nav).toMatch(/label: 'Grupos organizativos'/)
    expect(nav).toMatch(/label: 'Puntajes'/) // not «Pasaportes»: that name belongs to the personal passports
  })
})
