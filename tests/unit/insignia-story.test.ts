// The insignia opened in the passport: the medal at a big size and what it says about the career, about engineering and about the Cruz San Pedro Claver.
import fs from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import InsigniaStory from '../../src/components/InsigniaStory'
import { CAREER_TEXT, CLAVER_TEXT, ENGINEER_TEXT, insigniaText } from '../../src/lib/insigniaTexts'
import { rootPath } from '../static/helpers'

describe('insignia story', () => {
  it('has a text for every career, written without gender (it speaks of «tu ingeniería»)', () => {
    expect(Object.keys(CAREER_TEXT).sort()).toEqual(['biomec', 'civil', 'general', 'industrial', 'sistemas', 'tronicas'])
    for (const [key, text] of Object.entries(CAREER_TEXT)) {
      expect(text, key).toMatch(/^Tu ingeniería /)
      expect(text.length, key).toBeGreaterThan(60)
    }
    expect(new Set(Object.values(CAREER_TEXT)).size).toBe(6) // each one says something different
  })
  it('picks the text of the career by its name, and the general one for a career the app does not know', () => {
    expect(insigniaText('Ingeniería de Sistemas').career).toBe(CAREER_TEXT.sistemas)
    expect(insigniaText('Bioingeniería').career).toBe(CAREER_TEXT.biomec)
    expect(insigniaText('Ingeniería Civil').career).toBe(CAREER_TEXT.civil)
    expect(insigniaText('Arquitectura').career).toBe(CAREER_TEXT.general)
  })
  it('talks about engineering and about the Cruz San Pedro Claver and its value for the Javeriana community', () => {
    expect(ENGINEER_TEXT).toMatch(/ingeniería/i)
    expect(CLAVER_TEXT).toMatch(/Cruz San Pedro Claver/)
    expect(CLAVER_TEXT).toMatch(/servicio/)
    expect(CLAVER_TEXT).toMatch(/comunidad javeriana/)
  })
  it('shows the big medal with its ribbon, the name of the career and the three paragraphs', () => {
    const html = renderToStaticMarkup(createElement(InsigniaStory, { career: 'Ingeniería Civil' }))
    expect(html).toContain('Tu insignia')
    expect(html).toContain('viewBox="0 0 200 272"') // with the ribbon
    expect(html).toContain('Ingeniería Civil')
    for (const text of Object.values(insigniaText('Ingeniería Civil'))) expect(html).toContain(text)
  })
  it('opens from the career slot of the identity page of the passport, in the same zoom as the stamps', () => {
    const src = fs.readFileSync(rootPath('src/components/MemberPassport.tsx'), 'utf8')
    expect(src).toMatch(/aria-label="Ver tu insignia de la carrera" onClick=\{\(\) => setZoom\(<InsigniaStory career=\{career\} \/>\)\}/)
    expect(src).toMatch(/className="moment zoom member-zoom"/)
  })
})
