// The medals of a person: the one of their career and, in a double program, the one of the other career (generic when it is not an engineering).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Insignia from '../../src/components/Insignia'
import InsigniaStory from '../../src/components/InsigniaStory'
import { medalsOf } from '../../src/lib/careers'
import { CLAVER_TEXT, ENGINEER_TEXT, OTHER_CAREER_TEXT, insigniaText } from '../../src/lib/insigniaTexts'

describe('the medals of a person', () => {
  it('one career, one medal; no career, none', () => {
    expect(medalsOf('Ingeniería de Sistemas')).toEqual([{ career: 'Ingeniería de Sistemas', other: false }])
    expect(medalsOf('Ingeniería de Sistemas', '')).toHaveLength(1)
    expect(medalsOf('', null)).toEqual([])
  })
  it('another engineering brings its own medal', () => {
    expect(medalsOf('Ingeniería de Sistemas', 'Ingeniería Industrial')).toEqual([
      { career: 'Ingeniería de Sistemas', other: false },
      { career: 'Ingeniería Industrial', other: true },
    ])
  })
  it('two careers of the same group of careers share a medal, which is shown once', () => {
    expect(medalsOf('Mecatrónica', 'Ingeniería Electrónica')).toEqual([{ career: 'Mecatrónica', other: false }])
  })
  it('a career that is not an engineering is the other medal, the generic one', () => {
    expect(medalsOf('Ingeniería Civil', 'Derecho')).toEqual([
      { career: 'Ingeniería Civil', other: false },
      { career: 'Derecho', other: true },
    ])
  })
})

describe('the generic medal', () => {
  it('has the name of the career engraved and says Pontificia in the ring, not Ingeniería', () => {
    const html = renderToStaticMarkup(createElement(Insignia, { career: 'Derecho', other: true, size: 120 }))
    expect(html).toContain('Insignia de DERECHO')
    expect(html).toContain('PONTIFICIA · JAVERIANA')
    expect(html).not.toContain('INGENIERÍA · JAVERIANA')
  })
  it('an engineering keeps its medal also as the other career', () => {
    const html = renderToStaticMarkup(createElement(Insignia, { career: 'Ingeniería Industrial', other: true, size: 120 }))
    expect(html).toContain('INDUSTRIAL')
    expect(html).toContain('INGENIERÍA · JAVERIANA')
  })
  it('a long name shrinks to fit the ring and a very long one is cut', () => {
    const long = renderToStaticMarkup(createElement(Insignia, { career: 'Administración de Empresas y Negocios Internacionales', other: true }))
    expect(long).toContain('…')
    expect(long).toMatch(/font-size="7\.4"/)
  })
  it('without «other» an unknown career keeps the plate of the identity page', () => {
    const html = renderToStaticMarkup(createElement(Insignia, { career: 'Derecho', size: 120 }))
    expect(html).not.toContain('PONTIFICIA')
  })
})

describe('the story of the other medal', () => {
  it('does not tell a lawyer about engineering, but keeps the Cruz San Pedro Claver', () => {
    const t = insigniaText('Derecho', true)
    expect(t.career).toBe(OTHER_CAREER_TEXT)
    expect(t.engineer).toBeNull()
    expect(t.claver).toBe(CLAVER_TEXT)
    const html = renderToStaticMarkup(createElement(InsigniaStory, { career: 'Derecho', other: true }))
    expect(html).toContain('Tu otra insignia')
    expect(html).not.toContain(ENGINEER_TEXT)
  })
  it('another engineering as the other career tells its own story', () => {
    expect(insigniaText('Ingeniería Civil', true).engineer).toBe(ENGINEER_TEXT)
  })
})
