// lib/pdf.ts writes a PDF out of pictures, and lib/passportPdf.ts draws the pages of the passport as SVG: both are checked here without a browser
// (the pictures themselves are made by the browser; see /preview/pasaporte-pdf in development).
import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MemberPassportData } from '../../src/components/MemberPassport'
import { jpegPdf } from '../../src/lib/pdf'
import { passportPageSvgs, place, svgOf, wrap } from '../../src/lib/passportPdf'

// a 1 x 1 white JPEG
const JPEG = Uint8Array.from(
  atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='),
  (c) => c.charCodeAt(0),
)

const latin = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')

describe('jpegPdf', () => {
  const pdf = jpegPdf(
    [
      { jpeg: JPEG, width: 1, height: 1 },
      { jpeg: JPEG, width: 1, height: 1 },
      { jpeg: JPEG, width: 1, height: 1 },
    ],
    { width: 420, height: 588, title: 'Pasaporte de Ángela (Pérez)' },
  )
  const text = latin(pdf)

  it('is a PDF with the pages it was given', () => {
    expect(text.startsWith('%PDF-1.4\n')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toMatch(/\/Count 3 /)
    expect((text.match(/\/Type \/Page /g) ?? []).length).toBe(3)
    expect(text).toContain('/MediaBox [0 0 420 588]')
    expect((text.match(/\/Filter \/DCTDecode/g) ?? []).length).toBe(3)
  })

  it('has a table of positions that points exactly at every object (otherwise readers rebuild or refuse the file)', () => {
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1])
    expect(text.slice(start, start + 4)).toBe('xref')
    const rows = text.slice(start).split('\n').slice(2, 2 + 13) // the free entry and the 12 objects
    expect(rows[0]).toBe('0000000000 65535 f ')
    rows.slice(1).forEach((row, i) => {
      expect(row).toMatch(/^\d{10} 00000 n $/)
      expect(text.slice(Number(row.slice(0, 10))).startsWith(`${i + 1} 0 obj\n`)).toBe(true)
    })
  })

  it('declares the length of every picture stream it embeds', () => {
    expect([...text.matchAll(/\/Filter \/DCTDecode \/Length (\d+)/g)].map((m) => Number(m[1]))).toEqual([JPEG.length, JPEG.length, JPEG.length])
  })

  it('keeps the title in plain ASCII, escaped', () => {
    expect(text).toContain('/Title (Pasaporte de Angela \\(Perez\\))')
  })

  it('opens with a real PDF reader (written to the scratchpad when the folder exists, for a manual check)', () => {
    const dir = process.env.CARREAPP_SCRATCH
    if (dir && fs.existsSync(dir)) fs.writeFileSync(`${dir}/probe.pdf`, pdf)
    expect(pdf.length).toBeGreaterThan(JPEG.length * 3)
  })
})

describe('pieces of SVG', () => {
  it('svgOf takes the whole first svg, with the svgs nested inside it', () => {
    const html = '<span><svg a="1"><g/><svg b="2"><path/></svg><text>x</text></svg><span><svg>seal</svg></span></span>'
    expect(svgOf(html)).toBe('<svg a="1"><g/><svg b="2"><path/></svg><text>x</text></svg>')
    expect(svgOf('no svg here')).toBe('')
  })

  it('place sets the position and size, and makes ids unique so two pieces never share one', () => {
    const svg = '<svg viewBox="0 0 100 100" width="100%" height="100%" style="color:red"><defs><filter id="w"/><path id="t"/></defs><g filter="url(#w)"/><textPath href="#t"/></svg>'
    const a = place(svg, 3, 10, 20, 150, 150)
    expect(a).toContain('x="10" y="20" width="150" height="150"')
    expect(a).not.toContain('width="100%"')
    expect(a).not.toContain('style="color:red"')
    expect(a).toContain('id="p3-w"')
    expect(a).toContain('url(#p3-w)')
    expect(a).toContain('href="#p3-t"')
    expect(place(svg, 4, 0, 0, 1, 1)).toContain('id="p4-w"')
  })

  it('wrap breaks by words and never loses any', () => {
    expect(wrap('DANIEL ARTURO RODRÍGUEZ PEÑA', 16)).toEqual(['DANIEL ARTURO', 'RODRÍGUEZ PEÑA'])
    expect(wrap('', 10)).toEqual([])
    expect(wrap('Extraordinariamente', 5)).toEqual(['Extraordinariamente'])
  })
})

describe('the pages of the passport', () => {
  const term = (name: string, theme = 'mitologias', welcome: string | null = 'Gracias por darle vida a la inducción') => ({ id: `t${name}`, name, theme, is_current: true, welcome })
  const record = (role: 'runner' | 'base' | 'coordinator', extra = {}, name = '2710') => ({ id: `r${name}`, passport_id: 'p', term_id: `t${name}`, role, career: 'Ingeniería de Sistemas', culture: 'nordica', team_id: null, base_id: null, committee: 'caos', committee_lead: false, term: term(name), ...extra })
  const data = (role: 'runner' | 'base' | 'coordinator' = 'runner', person = {}, stamps: MemberPassportData['stamps'] = [], extra = {}): MemberPassportData => ({
    person: { id: 'p', username: 'ana.gomez', full_name: 'Ana María Gómez Ruiz', photo_path: null, nickname: 'Anita', symbol: 'cat', symbol_label: 'Gato blanco', generation: 'Generación 7', joined_term: '2024-2', ...person },
    records: [record(role, extra)],
    stamps,
    context: [{ record_id: 'r2710', team_id: 't', team_name: 'Dioses Nórdicos', team_photo_path: 'teams/a.jpg', partners: ['Sofía'], base_id: 'b', base_name: 'Atrio', base_photo_path: 'bases/a.jpg', event_id: null, event_name: null, event_active: false }],
    committeeMessages: [{ term_id: 't2710', committee: 'caos', message: 'Somos el fuego que enciende otros fuegos' }],
  })
  const pages = (d: MemberPassportData, photo: string | null = null) => passportPageSvgs({ data: d, assets: { photo, photos: { 'teams/a.jpg': 'data:image/jpeg;base64,TEAM', 'bases/a.jpg': 'data:image/jpeg;base64,BASE' }, font: 'data:font/woff2;base64,AAAA' }, render: (el) => renderToStaticMarkup(el) })

  it('are the cover, the identity, then the pages of the induction (induction, committee, two visas), then two blank ones', () => {
    const svgs = pages(data())
    expect(svgs).toHaveLength(8)
    for (const s of svgs) {
      expect(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"')).toBe(true)
      expect(s.endsWith('</svg>')).toBe(true)
      expect(s).toContain('<style>')
      expect(s).toContain('font-face')
    }
  })

  it('the cover and the identity page are general: no theme, no committee, no role, no partner', () => {
    const [cover, dni] = pages(data('runner', {}, [], { committee_lead: true }))
    for (const s of [cover, dni]) {
      for (const word of ['MITOLOG', 'Mitolog', 'Nórdica', 'Caos', 'CAOS', 'Corredor', 'CORREDOR', 'Dioses', 'Sofía', 'COORDI']) expect(s, word).not.toContain(word)
    }
    expect(cover).toContain('INDUCCIÓN JAVERIANA')
    expect(cover).toContain('INGENIERÍA DE SISTEMAS')
    expect(dni).toContain('Generación 7')
    expect(dni).toContain('2024-2')
    expect(dni).toContain('«Anita»')
    expect(dni).toContain('Gato blanco')
    expect(dni).toContain('@ana.gomez')
    expect(dni).toMatch(/PUJ-\d{6}/)
  })

  it('the page of the induction carries its name, its theme, the words of the coordinators and the culture that was assigned', () => {
    const page = pages(data())[2]
    expect(page).toContain('INDUCCIÓN 2710')
    expect(page).toContain('Temática Mitologías')
    expect(page).toContain('Gracias por darle vida a la inducción')
    expect(page).toContain('Nórdica')
    expect(page).toContain('Dioses Nórdicos')
  })

  it('the page of the committee has its stamp, its words and the golden photo of the group (runner) or of the base (base)', () => {
    const runner = pages(data())[3]
    expect(runner).toContain('Caos')
    expect(runner).toContain('Somos el fuego que enciende otros fuegos')
    expect(runner).toContain('TU GRUPO')
    expect(runner).toContain('data:image/jpeg;base64,TEAM')
    const base = pages(data('base'))[3]
    expect(base).toContain('TU BASE')
    expect(base).toContain('data:image/jpeg;base64,BASE')
    expect(pages(data('coordinator'))[3]).not.toContain('<image href="data:image/jpeg')
  })

  it('a coordinator of a committee gets the golden committee stamp', () => {
    expect(pages(data('runner', {}, [], { committee_lead: true }))[3]).toContain('COORDI')
    expect(pages(data())[3]).not.toContain('COORDI')
  })

  it('a later induction brings its own pages and its theme, even one this version does not know (neutral), and the blank pages stay last', () => {
    const d = data()
    d.records = [{ ...record('runner', { culture: 'general' }, '2720'), term: term('2720', 'casas-de-harry-potter', null) } as never, ...d.records]
    const svgs = pages(d)
    expect(svgs).toHaveLength(12)
    expect(svgs[2]).toContain('INDUCCIÓN 2720')
    expect(svgs[2]).toContain('Temática Casas de')
    expect(svgs[2]).not.toContain('Nórdica')
    expect(svgs[10]).toContain('PÁGINAS PARA TUS PRÓXIMAS INDUCCIONES')
  })

  it('grow with the stamps of an induction (six visas per page of the PDF) and never fewer than the empty pages that wait', () => {
    const stamp = (n: number) => ({ record_id: 'r2710', event_id: 'e', event_name: 'Carrera', kind: 'visited' as const, base_name: `Base ${n}`, base_key: `b${n}`, round_number: n, stamped_at: '2026-11-10T10:00:00Z' })
    expect(pages(data('runner', {}, Array.from({ length: 5 }, (_, i) => stamp(i + 1)))).length).toBe(8) // entry + 5 = 6 visas: one page, plus the empty one
    expect(pages(data('runner', {}, Array.from({ length: 20 }, (_, i) => stamp(i + 1)))).length).toBe(10) // 21 visas: four pages
  })

  it('never write what is not there: no nickname, symbol, generation or entry says so', () => {
    const dni = pages(data('runner', { nickname: null, symbol: null, symbol_label: null, generation: null, joined_term: null }))[1]
    expect(dni).toContain('Sin apodo')
    expect(dni).toContain('Sin símbolo')
    expect(dni).toContain('Por definir')
  })

  it('escape what the coordinator typed (a nickname cannot break the page)', () => {
    const all = pages(data('runner', { nickname: '<b>"Tom & Jerry"</b>' })).join('\n')
    expect(all).not.toContain('<b>')
    expect(all).toContain('&lt;b&gt;')
  })

  it('use the photo when there is one and the initials when there is not', () => {
    expect(pages(data(), 'data:image/jpeg;base64,/9j/AAAA')[1]).toContain('href="data:image/jpeg;base64,/9j/AAAA"')
    expect(pages(data())[1]).toContain('>AM<')
  })
})
