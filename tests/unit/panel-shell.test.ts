// The shell of the coordi's panel: one menu that shows ONE level at a time, follows the life of the carrera, and the seal workshop rules.
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AdminNav, { CARRERA_TABS, GLOBAL_TABS, groupOpenIn, type NavEvent } from '../../src/pages/admin/AdminNav'
import { SECTIONS, sectionOf, workshopLink } from '../../src/lib/sealElements'
import type { EventPhase } from '../../src/types'
import { rootPath } from '../static/helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')
const event = (phase: EventPhase): NavEvent => ({ id: 'e1', name: 'Carrera 2710', code: '2710', phase })
const menu = (ev: NavEvent | null, path = '/admin') => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(AdminNav, { event: ev, onSignOut: () => {} })))

describe('inside a carrera the menu shows only that carrera', () => {
  it('the global administration is not shown (nor its pages), and there is a way back to all the carreras', () => {
    const html = menu(event('disabled'), '/admin/carreras/e1')
    expect(html).not.toContain('Administración global')
    for (const g of GLOBAL_TABS) expect(html).not.toContain(`href="${g.to}"`)
    expect(html).toContain('Todas las carreras')
    expect(html).toContain('Carrera 2710')
  })
  it('outside a carrera it shows the carreras and the global administration, but not the sections of a carrera', () => {
    const html = menu(null)
    expect(html).toContain('Administración global')
    for (const g of GLOBAL_TABS) expect(html).toContain(`href="${g.to}"`)
    expect(html).not.toContain('Preparación')
  })
  it('on phones the bottom bar inside a carrera has no Global button', () => {
    expect(menu(event('started'), '/admin/carreras/e1')).not.toContain('>Global<')
    expect(menu(null)).toContain('>Global<')
  })
})

describe('the menu follows the life of the carrera (preparation → running)', () => {
  const prep = CARRERA_TABS.filter((t) => t.group === 'prep')
  const live = CARRERA_TABS.filter((t) => t.group === 'live')
  const has = (html: string, label: string) => html.includes(`<span>${label}</span>`)

  it('Preparación comes in the order it is done, numbered, and has no seals tab (seals are made in the workshop)', () => {
    expect(prep.map((t) => t.path)).toEqual(['configuracion', 'tematica', 'grupos', 'bases', 'cruces', 'comites', 'inductores', 'usuarios'])
    expect(CARRERA_TABS.some((t) => t.path === 'sellos')).toBe(false)
    const html = menu(event('disabled'), '/admin/carreras/e1')
    expect(prep.map((_, i) => html.includes(`>${i + 1}</b>`)).every(Boolean)).toBe(true)
  })
  it('before it starts Preparación is open and En carrera is folded; once it runs it is the other way round', () => {
    for (const phase of ['disabled', 'enabled'] as EventPhase[]) {
      const html = menu(event(phase), '/admin/carreras/e1')
      for (const t of prep) expect(has(html, t.label), `${phase} ${t.label}`).toBe(true)
      for (const t of live) expect(has(html, t.label), `${phase} ${t.label}`).toBe(false)
      expect(html).toContain('al iniciar')
    }
    for (const phase of ['started', 'finished', 'archived'] as EventPhase[]) {
      const html = menu(event(phase), '/admin/carreras/e1')
      for (const t of live) expect(has(html, t.label), `${phase} ${t.label}`).toBe(true)
      for (const t of prep) expect(has(html, t.label), `${phase} ${t.label}`).toBe(false)
    }
    expect(groupOpenIn('prep', 'started')).toBe(false)
    expect(groupOpenIn('live', 'enabled')).toBe(false)
    expect(menu(event('started'), '/admin/carreras/e1')).toContain('protegida')
  })
  it('Resumen y control is always there, and the folded group opens when you are inside one of its pages', () => {
    for (const phase of ['disabled', 'started', 'archived'] as EventPhase[]) expect(has(menu(event(phase), '/admin/carreras/e1'), 'Resumen y control')).toBe(true)
    expect(has(menu(event('started'), '/admin/carreras/e1/bases'), 'Bases')).toBe(true) // you are in Bases: its group stays open
    expect(has(menu(event('disabled'), '/admin/carreras/e1/puntajes'), 'Puntajes')).toBe(true)
  })
})

describe('what each screen holds in each moment', () => {
  it('Resumen y control: while preparing it is the checklist, never the tower; once it runs it is the tower', () => {
    const src = read('src/pages/admin/EnVivo.tsx')
    expect(src).toMatch(/const preparing = event\?\.phase === 'disabled' \|\| event\?\.phase === 'enabled'/)
    expect(src).toMatch(/\{preparing && event\.phase !== undefined && \(\s*<>\s*<PrepSteps/)
    expect(src).toMatch(/\{!preparing && \(\s*<>/)
    // the tower modules are all inside the not-preparing branch
    const tower = src.slice(src.indexOf('{!preparing && ('))
    for (const piece of ['<FlightBoard', '<RotationPanel', '<DelaysPanel', '<OpsLog', 'Top equipos', 'Puertas · Ronda']) expect(tower, piece).toContain(piece)
    const gate = src.indexOf('{!preparing && (')
    for (const piece of ['<FlightBoard', '<RotationPanel', '<DelaysPanel', '<OpsLog', '<Kpi']) expect(src.indexOf(piece), piece).toBeGreaterThan(gate) // none of them before the gate
  })
  it('Configuración only holds settings: nothing of the state or the checklist', () => {
    const src = read('src/pages/admin/Carrera.tsx')
    expect(src).not.toMatch(/PhaseControl|PrepSteps|PrepReport|event_problems|PHASE_LABEL/)
  })
  it('each screen says where it is in the menu: a «Paso n de 8» tag in Preparación, nothing but the menu group in En carrera', () => {
    const steps: [string, number][] = [['Carrera', 1], ['CarreraTematica', 2], ['Grupos', 3], ['Bases', 4], ['Cruces', 5], ['CarreraComites', 6], ['Inductores', 7], ['Usuarios', 8]]
    for (const [file, n] of steps) expect(read(`src/pages/admin/${file}.tsx`), file).toMatch(new RegExp(`step=\\{(fixedTermId \\? )?${n}( : undefined)?\\}|<StepTag n=\\{${n}\\} />`))
    expect(read('src/pages/admin/PageTitle.tsx')).toMatch(/de \{STEPS\}/)
    for (const file of ['Puntajes', 'Mapa']) expect(read(`src/pages/admin/${file}.tsx`), file).not.toMatch(/StepTag|PageTitle step/)
  })
  it('the titles of the screens are the names of the menu', () => {
    const names: [string, string][] = [['Carrera', 'Configuración'], ['CarreraTematica', 'Temática'], ['Grupos', 'Grupos participantes'], ['Bases', 'Bases'], ['Cruces', 'Cruces'], ['CarreraComites', 'Coordi y comités'], ['Usuarios', 'Usuarios'], ['Puntajes', 'Puntajes'], ['Mapa', 'Radar']]
    for (const [file, h1] of names) expect(read(`src/pages/admin/${file}.tsx`), file).toMatch(new RegExp(`<h1>${h1}</h1>|<PageTitle[^>]*>${h1}</PageTitle>`))
    expect(CARRERA_TABS.map((t) => t.label)).toEqual(expect.arrayContaining(names.map(([, h1]) => h1)))
  })
})

describe('the seal workshop: seals are made in one place, for something, and (except generations) for one inducción', () => {
  it('the sections a seal can be for, and which ones belong to a carrera', () => {
    expect(SECTIONS.map((s) => s.kind)).toEqual(['generation', 'group', 'theme', 'subtheme', 'base', 'committee'])
    expect(sectionOf('generation')?.perCarrera).toBe(false) // permanent: valid in every inducción
    for (const kind of ['theme', 'subtheme', 'base', 'committee']) expect(sectionOf(kind)?.perCarrera, kind).toBe(true)
    expect(sectionOf('team')).toBeUndefined() // the groups are represented by their insignia, never by a seal
    expect(sectionOf('committee')?.rule).toMatch(/UNA inducción/)
  })
  it('the workshop asks for the inducción before showing or creating a seal that belongs to one', () => {
    const page = read('src/pages/admin/Sellos.tsx')
    expect(page).toMatch(/section\.perCarrera && \(/)
    expect(page).toMatch(/Elige la inducción/)
    expect(page).toMatch(/event_id: event\.id, kind: e\.kind, ref: e\.ref/) // the seal is saved tied to the chosen carrera
    expect(page).toMatch(/locked/) // a finalised carrera cannot change its seals
  })
  it('the links from the sections open the workshop on that section, carrera and element', () => {
    expect(workshopLink('committee', 'e1', 'caos')).toBe('/admin/sellos?kind=committee&event=e1&ref=caos')
    expect(workshopLink('generation', null, 'barbies')).toBe('/admin/sellos?kind=generation&ref=barbies')
  })
  it('each section shows only its own seals (read only) with a link to the workshop', () => {
    const wanted: [string, string][] = [['CarreraTematica', "['theme', 'subtheme']"], ['Bases', "['base']"], ['CarreraComites', "['committee']"]]
    for (const [file, kinds] of wanted) {
      const src = read(`src/pages/admin/${file}.tsx`)
      expect(src, file).toContain(`SEAL_KINDS: SealKind[] = ${kinds}`)
      expect(src, file).toMatch(/<SectionSeals event=\{event\} kinds=\{SEAL_KINDS\}/)
      expect(src, file).not.toMatch(/saveEventSeal|SealEditor/)
    }
    expect(read('src/pages/admin/Generaciones.tsx')).toMatch(/workshopLink\('generation'/)
  })
})
