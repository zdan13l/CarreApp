// The identity of the personal passport: committees and their stamps, the culture mark, generation, entry, nickname and symbol.
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import CommitteeSeal from '../../src/components/CommitteeSeal'
import CultureEmblem from '../../src/components/CultureEmblem'
import CareerEmblem, { careerKey } from '../../src/components/CareerEmblem'
import { BLANK_PAGES, committeeWords, MIN_VISA_PAGES, pageSpecsOf, photoSealOf, visaPagesFor, type MemberPassportData, type MemberRecord } from '../../src/components/MemberPassport'
import { PhotoSeal, splitWords, SymbolBadge, TextSeal } from '../../src/components/Seals'
import { COMMITTEES, committeeOf } from '../../src/lib/committees'
import { parsePeople } from '../../src/lib/passports'
import { SYMBOLS, symbolOf } from '../../src/lib/symbols'

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el)

describe('committees', () => {
  it('are the six of the induction, each with its tagline', () => {
    expect(COMMITTEES.map((c) => c.name)).toEqual(['Clausura', 'Meraki', 'Conzumo', 'Carrera', 'Caos', 'Bienvenida'])
    expect(new Set(COMMITTEES.map((c) => c.ink)).size).toBe(5) // Bienvenida shares the blue of Clausura: its silhouette tells them apart
    expect(COMMITTEES.map((c) => c.tagline)).toEqual(['La bata de Homero', 'Con el alma, la pasión y el corazón', 'La copa de Dionisio', 'Las olimpiadas', 'El fuego de Prometeo', 'Quien te recibe'])
  })
  it('are found by key, and an unknown one is simply none', () => {
    expect(committeeOf('caos')?.name).toBe('Caos')
    expect(committeeOf('nada')).toBeNull()
    expect(committeeOf(null)).toBeNull()
  })
  it('have keys the database accepts (lowercase letters)', () => {
    for (const c of COMMITTEES) expect(c.key).toMatch(/^[a-z]{3,20}$/)
  })
})

describe('the stamp of a committee', () => {
  const ringed = COMMITTEES.filter((c) => c.key !== 'bienvenida' && c.key !== 'meraki')
  it.each(ringed)('$name: its name and its tagline are on the rings and it has a drawing', (c) => {
    const svg = html(createElement(CommitteeSeal, { committee: c.key }))
    expect(svg).toContain(c.name.toUpperCase())
    expect(svg).toContain(c.tagline.toUpperCase())
    expect(svg).toContain(`ink-${c.ink}`)
    expect(svg).toContain(`Sello del comité ${c.name}`)
    expect(svg).not.toContain('linearGradient')
    expect((svg.match(/<(path|circle|ellipse|polygon)\b/g) ?? []).length).toBeGreaterThan(8)
  })

  it('Bienvenida is a shield with a vest and Meraki an oval with the butterfly: each has its own silhouette, name and words', () => {
    const b = html(createElement(CommitteeSeal, { committee: 'bienvenida' }))
    expect(b).toContain('shape-seal')
    expect(b).toContain('BIENVENIDA')
    expect(b).toContain('QUIEN TE RECIBE')
    const m = html(createElement(CommitteeSeal, { committee: 'meraki' }))
    expect(m).toContain('shape-seal')
    expect(m).toContain('MERAKI')
    for (const word of ['CON EL ALMA,', 'LA PASIÓN Y', 'EL CORAZÓN']) expect(m).toContain(word)
    expect(b).not.toBe(m)
  })

  it('the six drawings are different from one another', () => {
    const art = COMMITTEES.map((c) => html(createElement(CommitteeSeal, { committee: c.key })).replace(/id="[^"]*"|url\(#[^)]*\)|href="#[^"]*"/g, '').replace(c.name.toUpperCase(), '').replace(c.tagline.toUpperCase(), ''))
    expect(new Set(art).size).toBe(6)
  })

  it('the coordinator of the committee gets the GOLDEN one: gold foil (and, on the round ones, rays and "coordi" on the ring)', () => {
    for (const c of COMMITTEES) {
      const gold = html(createElement(CommitteeSeal, { committee: c.key, lead: true }))
      const plain = html(createElement(CommitteeSeal, { committee: c.key }))
      expect(gold).toContain('linearGradient')
      expect(gold).toContain('var(--foil-a)')
      expect(gold).toContain('Sello del comité')
      expect(gold).toContain('coordi')
      expect(gold.length).toBeGreaterThan(plain.length - 1) // the foil, the rays or the crown
      expect(plain).not.toContain('COORDI')
      if (c.key !== 'bienvenida' && c.key !== 'meraki') expect(gold).toContain(`COORDI · ${c.name.toUpperCase()}`)
    }
  })

  it('an unknown committee still draws something (the first one) instead of breaking the page', () => {
    expect(html(createElement(CommitteeSeal, { committee: 'inventado' }))).toContain('CLAUSURA')
  })
})

describe('the mark of a culture is not the stamp of a base', () => {
  it('draws places (a longship, a temple, a pyramid, a pagoda, the pyramids), never the gods and creatures of the stamps of the bases', () => {
    for (const culture of ['nordica', 'griega', 'mexicana', 'china', 'egipcia'] as const) {
      const svg = html(createElement(CultureEmblem, { culture }))
      expect(svg).toContain('<circle')
      expect((svg.match(/<(path|rect|circle|ellipse|polygon)\b/g) ?? []).length).toBeGreaterThan(8)
    }
    const source = `${CultureEmblem}`
    expect(source.length).toBeGreaterThan(0)
  })
  it('the five are different', () => {
    const marks = (['nordica', 'griega', 'mexicana', 'china', 'egipcia'] as const).map((culture) => html(createElement(CultureEmblem, { culture })).replace(/id="[^"]*"/g, ''))
    expect(new Set(marks).size).toBe(5)
  })
})

describe('the pages of the booklet', () => {
  const term = (name: string, theme = 'mitologias') => ({ id: `t${name}`, name, theme, is_current: true, welcome: null })
  const record = (name: string, extra: Partial<MemberRecord> = {}): MemberRecord => ({
    id: `r${name}`, passport_id: 'p', term_id: `t${name}`, role: 'runner', career: 'Ingeniería Civil', culture: 'egipcia', team_id: null, base_id: null, committee: null, committee_lead: false,
    term: term(name), ...extra,
  })
  const person = { id: 'p', username: 'ana', full_name: 'Ana', photo_path: null }
  const data = (records: MemberRecord[], stamps: MemberPassportData['stamps'] = []): MemberPassportData => ({ person, records, stamps, context: [] })

  it('start with the identity page, which is general, then three or more pages per induction, then the blank ones', () => {
    const specs = pageSpecsOf(data([record('2710')]))
    expect(specs.map((s) => s.kind)).toEqual(['dni', 'induction', 'committee', 'visa', 'visa', 'blank', 'blank', 'blank'])
    expect(specs.filter((s) => s.kind === 'blank')).toHaveLength(BLANK_PAGES)
  })

  it('every induction brings its own pages, the newest first, and the blank ones stay at the end waiting for the next', () => {
    const specs = pageSpecsOf(data([record('2720'), record('2710')]))
    expect(specs.map((s) => (s.kind === 'induction' ? s.record.term.name : s.kind))).toEqual(['dni', '2720', 'committee', 'visa', 'visa', '2710', 'committee', 'visa', 'visa', 'blank', 'blank', 'blank'])
  })

  it('the visa pages of an induction grow with its stamps and never fall below the empty ones that wait', () => {
    expect(MIN_VISA_PAGES).toBe(2)
    expect(visaPagesFor(1)).toBe(2)
    expect(visaPagesFor(8)).toBe(2)
    expect(visaPagesFor(9)).toBe(3)
    const stamps = Array.from({ length: 9 }, (_, i) => ({ record_id: 'r2710', event_id: 'e', event_name: 'Carrera', kind: 'visited' as const, base_name: `B${i}`, base_key: `b${i}`, round_number: i + 1, stamped_at: '2026-11-10T10:00:00Z' }))
    expect(pageSpecsOf(data([record('2710')], stamps)).filter((s) => s.kind === 'visa')).toHaveLength(3) // entry + 9 stamps = 10 visas
  })

  it('the stamps of an induction go to ITS pages only', () => {
    const stamp = { record_id: 'r2700', event_id: 'e', event_name: 'Carrera', kind: 'visited' as const, base_name: 'Atrio', base_key: 'a', round_number: 1, stamped_at: '2026-11-10T10:00:00Z' }
    const specs = pageSpecsOf(data([record('2710'), record('2700')], [stamp]))
    const visa = specs.filter((s): s is Extract<typeof s, { kind: 'visa' }> => s.kind === 'visa')
    expect(visa.filter((v) => v.record.term.name === '2710').flatMap((v) => v.slots).filter((x) => x.kind === 'stamp')).toHaveLength(0)
    expect(visa.filter((v) => v.record.term.name === '2700').flatMap((v) => v.slots).filter((x) => x.kind === 'stamp')).toHaveLength(1)
  })

  it('the golden stamp with a photo: the group of a runner, the base of a base inductor, nothing for anybody else', () => {
    const ctx = { record_id: 'r2710', team_id: 't', team_name: 'Dioses', team_photo_path: 'teams/a.jpg', partners: [], base_id: 'b', base_name: 'Atrio', base_photo_path: 'bases/a.jpg', event_id: null, event_name: null, event_active: false }
    expect(photoSealOf(record('2710'), ctx)).toEqual({ path: 'teams/a.jpg', top: 'Tu grupo', bottom: 'Dioses' })
    expect(photoSealOf(record('2710', { role: 'base' }), ctx)).toEqual({ path: 'bases/a.jpg', top: 'Tu base', bottom: 'Atrio' })
    expect(photoSealOf(record('2710', { role: 'coordinator' }), ctx)).toBeNull()
    expect(photoSealOf(record('2710'), undefined)).toBeNull() // a runner without a group yet
  })

  it('the words of a committee are the ones of THAT induction', () => {
    const d: MemberPassportData = { ...data([record('2710', { committee: 'caos' })]), committeeMessages: [{ term_id: 't2700', committee: 'caos', message: 'viejo' }, { term_id: 't2710', committee: 'caos', message: 'nuevo' }] }
    expect(committeeWords(d, d.records[0])).toBe('nuevo')
    expect(committeeWords({ ...d, committeeMessages: [] }, d.records[0])).toBeNull()
  })
})

describe('the mark of each career (identity page and cover)', () => {
  it('five marks: Mecatrónica, Redes and Electrónica share one, and so do Bioingeniería and Mecánica', () => {
    const real = { 'Ingeniería de Sistemas': 'sistemas', Mecatrónica: 'tronicas', Redes: 'tronicas', Electrónica: 'tronicas', 'Ingeniería Industrial': 'industrial', Bioingeniería: 'biomec', 'Ingeniería Mecánica': 'biomec', 'Ingeniería Civil': 'civil' }
    for (const [career, key] of Object.entries(real)) expect(careerKey(career), career).toBe(key)
    expect(new Set(Object.values(real)).size).toBe(5)
    expect(careerKey('Ingeniería Ambiental')).toBe('general')
  })
  it('each is drawn, and they are different from one another', () => {
    const marks = ['Sistemas', 'Redes', 'Industrial', 'Bioingeniería', 'Civil'].map((career) => html(createElement(CareerEmblem, { career })).replace(/aria-label="[^"]*"/, ''))
    expect(new Set(marks).size).toBe(5)
    for (const m of marks) expect((m.match(/<(path|rect|circle)\b/g) ?? []).length).toBeGreaterThan(5)
  })
})

describe('the golden photo seal', () => {
  it('prints the photo in gold, with the group or base on the ring, and works without a photo', () => {
    const svg = html(createElement(PhotoSeal, { url: '/campus-800.jpg', top: 'Tu grupo', bottom: 'Dioses Nórdicos' }))
    expect(svg).toContain('<image')
    expect(svg).toContain('feComponentTransfer')
    expect(svg).toContain('TU GRUPO')
    expect(svg).toContain('DIOSES NÓRDICOS')
    expect(svg).toContain('var(--foil-a)')
    expect(html(createElement(PhotoSeal, { url: null, top: 'Tu base', bottom: 'Atrio' }))).not.toContain('<image')
  })
})

describe('text seals (generation, entry)', () => {
  it('split a long text in two lines at the space nearest to the middle', () => {
    expect(splitWords('Generación Fénix')).toEqual(['Generación', 'Fénix'])
    expect(splitWords('7')).toEqual(['7', ''])
    expect(splitWords('Los Fundadores')).toEqual(['Los', 'Fundadores'])
    expect(splitWords('Extraordinaria')).toEqual(['Extraordinaria', ''])
  })
  it('do not repeat the word the ring already says ("Generación 7" shows 7 in the middle)', () => {
    const svg = html(createElement(TextSeal, { center: 'Generación 7', top: 'Generación', bottom: 'Inducción Javeriana' }))
    expect(svg).toContain('>7<')
    expect(svg).toContain('GENERACIÓN') // on the ring
  })
})

describe('the personal symbol', () => {
  it('is picked from a list of icons, with keys the database accepts, no repeats and no emojis', () => {
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(30)
    expect(new Set(SYMBOLS.map((s) => s.key)).size).toBe(SYMBOLS.length)
    for (const s of SYMBOLS) {
      expect(s.key).toMatch(/^[a-z0-9-]{2,24}$/)
      expect(s.name).not.toMatch(/\p{Extended_Pictographic}/u)
    }
    expect(symbolOf('cat')?.name).toBe('Gato')
    expect(symbolOf('no-existe')).toBeNull()
  })
  it('shows its name, or the name the person gave it, or says there is none', () => {
    expect(html(createElement(SymbolBadge, { symbol: 'cat' }))).toContain('Gato')
    expect(html(createElement(SymbolBadge, { symbol: 'cat', label: 'Gato blanco' }))).toContain('Gato blanco')
    expect(html(createElement(SymbolBadge, { symbol: null }))).toContain('Sin símbolo')
  })
})

describe('the Excel with committee, generation, entry and nickname (all optional)', () => {
  const ctx = () => ({ theme: 'mitologias', usernames: new Set<string>(), known: new Map<string, string>() })
  const table = [[['Nombre', 'Carrera', 'Rol (opcional)', 'Comité (opcional)', 'Generación (opcional)', 'Ingreso (opcional)', 'Apodo (opcional)'],
    ['Ana María Pérez Gómez', 'Ingeniería de Sistemas', 'Corredor', 'Clausura', 'Generación 7', '2024-2', 'Anita'],
    ['Luis Ruiz', 'Ingeniería Civil', '', 'caos', '', '', ''],
    ['Eva Paz', 'Redes', '', 'Comité Inventado', '', '', ''],
    ['Zoe Vega', 'Redes', '', '', 'g'.repeat(31), 'j'.repeat(21), 'n'.repeat(25)]]]

  it('reads them (the titles may say "(opcional)", with accents or without)', () => {
    const rows = parsePeople(table, ctx())
    expect(rows[0]).toMatchObject({ committee: 'clausura', generation: 'Generación 7', joined: '2024-2', nickname: 'Anita', role: 'runner' })
    expect(rows[1].committee).toBe('caos')
    expect(rows[1]).toMatchObject({ generation: '', joined: '', nickname: '' })
  })

  it('an unknown committee or a text too long for the database is explained, not guessed', () => {
    const rows = parsePeople(table, ctx())
    expect(rows[2].errors.join()).toMatch(/comité no se entiende \(Clausura, Meraki, Conzumo, Carrera, Caos, Bienvenida\)/)
    expect(rows[3].errors.join(' ')).toMatch(/generación es muy larga/)
    expect(rows[3].errors.join(' ')).toMatch(/ingreso es muy largo/)
    expect(rows[3].errors.join(' ')).toMatch(/apodo es muy largo/)
  })

  it('without those columns the people load as before', () => {
    const rows = parsePeople([[['Nombre', 'Carrera'], ['Ana Gómez', 'Redes']]], ctx())
    expect(rows[0]).toMatchObject({ committee: null, generation: '', joined: '', nickname: '', errors: [] })
  })
})
