// The insignia of each group of careers: the final medal, in the colours of the flag of the Javeriana, drawn for each career and wired into the app.
import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import Insignia, { INSIGNIA_KEYS, MedallaBadge } from '../../src/components/Insignia'
import { EMBLEM } from '../../src/components/InsigniaEmblems'
import { rootPath } from '../static/helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')
const medal = (career: (typeof INSIGNIA_KEYS)[number], ribbon = true) => renderToStaticMarkup(createElement(MedallaBadge, { career, size: 120, ribbon }))

describe('insignia: the final medal', () => {
  it('draws the five careers, each with its name engraved and its OWN drawing in the blue of the flag', () => {
    expect(INSIGNIA_KEYS).toEqual(['sistemas', 'tronicas', 'biomec', 'civil', 'industrial'])
    const drawings = new Set<string>()
    for (const career of INSIGNIA_KEYS) {
      const svg = medal(career)
      expect(svg, career).toMatch(/role="img"/)
      expect(svg, career).toContain('var(--puj-blue)')
      expect(svg, career).toContain('INGENIERÍA · JAVERIANA')
      drawings.add(renderToStaticMarkup(createElement('svg', null, EMBLEM[career]())))
    }
    expect(drawings.size).toBe(5) // five different drawings
  })
  it('the five drawings share one style: white outline, filled dark-blue parts, light-blue lines and yellow touches', () => {
    for (const career of INSIGNIA_KEYS) {
      const svg = renderToStaticMarkup(createElement('svg', null, EMBLEM[career]()))
      expect(svg, career).toContain('stroke="white"') // the white outline
      expect(svg, career).toContain('black)') // the dark-blue fill (a mix of the blue of the flag with black)
      expect(svg, career).toContain('var(--puj-yellow)') // the yellow touches
      expect(svg, career).toContain('white)') // the light-blue lines (a mix of the blue with white)
      expect(svg, career).toMatch(/stroke-width="1[1-5]"/) // a bold outline, the same weight family in all of them
    }
  })
  it('has a big version with the clasp and the ribbon of the flag (yellow, white, blue) and a plain medal for lists', () => {
    const big = medal('civil')
    const plain = medal('civil', false)
    for (const v of ['--puj-yellow', '--puj-white', '--puj-blue']) expect(big).toContain(v)
    expect(plain).not.toContain('--puj-white') // no ribbon
    expect(big).toMatch(/viewBox="0 0 200 272"/)
    expect(plain).toMatch(/viewBox="2 64 196 196"/)
    expect(big.match(/rotate\(\d+\)/g)?.length).toBe(8) // the eight arms
  })
  it('a career the app does not know keeps the old plate instead of breaking', () => {
    expect(renderToStaticMarkup(createElement(Insignia, { career: 'Arquitectura', size: 80 }))).not.toContain('INGENIERÍA · JAVERIANA')
    expect(renderToStaticMarkup(createElement(Insignia, { career: 'Ingeniería de Sistemas', size: 80 }))).toContain('INGENIERÍA · JAVERIANA')
  })
  it('uses the flag and foil variables of the design system, never colour literals, the same in both modes', () => {
    for (const f of ['src/components/Insignia.tsx', 'src/components/InsigniaEmblems.tsx']) expect(read(f), f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    const css = read('src/index.css')
    const blocks = [/\n:root \{[\s\S]*?\n\}/.exec(css)![0], /\n:root\[data-theme='light'\] \{[\s\S]*?\n\}/.exec(css)![0]]
    const values: Record<string, string> = { '--puj-yellow': '#f6cd00', '--puj-blue': '#2d5799', '--puj-white': '#ffffff' }
    for (const [token, value] of Object.entries(values)) {
      for (const b of blocks) expect(new RegExp(`${token}:\\s*${value};`).exec(b), token).toBeTruthy()
    }
  })
  it('is the insignia of the Insignias page, of the identity page of the passport and of its PDF', () => {
    expect(read('src/pages/admin/Insignias.tsx')).toMatch(/<Insignia career=\{BUILT_IN\[b\.key\]\}/)
    expect(read('src/components/MemberPassport.tsx')).toMatch(/<Insignia career=\{m\.career\}/)
    const pdf = read('src/lib/passportPdf.ts')
    expect(pdf).toMatch(/createElement\(Insignia, \{ career/)
    expect(pdf).toMatch(/--puj-yellow:#f6cd00;--puj-blue:#2d5799/) // the isolated SVG of the PDF defines the colours of the flag
  })
})
