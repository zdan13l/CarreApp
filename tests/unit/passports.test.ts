// The personal passport: usernames, the Excel that comes in and goes out, cultures per career, the stamps that are merged.
import { describe, expect, it } from 'vitest'
import {
  personNumber,
  passportUsername,
  type PassportStampRow,
} from '../../src/lib/passports'
import { cultureOf, themeOf, THEMES } from '../../src/lib/themes'
import { mergeStamps } from '../../src/pages/MemberHome'
import { USERNAME_PATTERN } from '../../src/lib/username'

describe('passportUsername', () => {
  const name = (n: string, taken: string[] = []) => passportUsername(n, new Set(taken))

  it('first name and first surname, without accents or capitals', () => {
    expect(name('Camila Andrea Rojas Prieto')).toBe('camila.rojas')
    expect(name('Luis Felipe Vásquez Mora')).toBe('luis.vasquez')
    expect(name('Marcela Andrea Díaz Rey')).toBe('marcela.diaz')
  })

  it('with three words the last one is the surname; with two, the second', () => {
    expect(name('Ana Pardo Ruiz')).toBe('ana.ruiz')
    expect(name('Jorge Esteban Lozano')).toBe('jorge.lozano')
    expect(name('Marta Herrera')).toBe('marta.herrera')
  })

  it('a single word still gives a valid @', () => {
    expect(USERNAME_PATTERN.test(name('Madonna'))).toBe(true)
  })

  it('never repeats an @: it adds the initial of the second name, then a number', () => {
    const taken = new Set<string>()
    const a = passportUsername('Camilo José Mora Ibáñez', taken)
    const b = passportUsername('Felipe Andrés Cano Duarte', taken) // different surname
    const c = passportUsername('Camilo José Mora Ibáñez', taken) // the same person typed twice
    const d = passportUsername('Carlos Mario Mora Pérez', taken)
    const e = passportUsername('Camilo José Mora Ibáñez', taken)
    expect(new Set([a, b, c, d, e]).size).toBe(5)
    expect(a).toBe('camilo.mora')
    expect(c).toBe('camilo.mora.j')
    for (const u of [a, b, c, d, e]) expect(USERNAME_PATTERN.test(u)).toBe(true)
  })

  it('respects the @ that already exist (also the ones of other users)', () => {
    expect(name('Ana Pardo Ruiz', ['ana.ruiz'])).not.toBe('ana.ruiz')
  })

  it('stays inside the 30 characters of an @, even for very long names', () => {
    const u = name('Maximiliano Alessandro Montoya-Rodriguez Hernandez de la Torre y Quintero')
    expect(u.length).toBeLessThanOrEqual(30)
    expect(USERNAME_PATTERN.test(u)).toBe(true)
  })
})

describe('the culture of each career in the theme "Mitologías"', () => {
  const theme = THEMES.mitologias
  // The eight careers of the real list of inductors of the first semester
  it.each([
    ['Ingeniería de Sistemas', 'nordica'],
    ['Mecatrónica', 'griega'],
    ['Redes', 'griega'],
    ['Electrónica', 'griega'],
    ['Ingeniería Industrial', 'mexicana'],
    ['Bioingeniería', 'china'],
    ['Ingeniería Mecánica', 'china'],
    ['Ingeniería Civil', 'egipcia'],
  ])('%s -> %s', (career, culture) => {
    expect(theme.cultureOf(career)).toBe(culture)
  })

  it('does not mix Mecatrónica (griega) with Mecánica (china)', () => {
    expect(theme.cultureOf('INGENIERÍA MECATRÓNICA')).toBe('griega')
    expect(theme.cultureOf('ingenieria mecanica')).toBe('china')
  })

  it('has no rule for an unknown career: the coordinator chooses', () => {
    expect(theme.cultureOf('Ingeniería Ambiental')).toBeNull()
  })

  it('five cultures with their own colour, border and emblem', () => {
    expect(theme.cultures.map((c) => c.key).sort()).toEqual(['china', 'egipcia', 'griega', 'mexicana', 'nordica'])
    expect(new Set(theme.cultures.map((c) => c.ink)).size).toBe(5)
    expect(new Set(theme.cultures.map((c) => c.ornament)).size).toBe(5)
  })

  it('the theme belongs to one induction: an unknown one (the next induction) gets a neutral page with its own name, never mythology', () => {
    expect(themeOf('casas-de-harry-potter').name).toBe('Casas de harry potter')
    expect(themeOf('casas-de-harry-potter').cultures.map((c) => c.key)).toEqual(['general'])
    expect(themeOf('casas-de-harry-potter').cultureOf('Ingeniería Civil')).toBe('general')
    expect(cultureOf('casas-de-harry-potter', 'nordica').key).toBe('general')
    expect(cultureOf('mitologias', 'china').name).toBe('China')
  })
})

describe('the stamps of the passport', () => {
  const s = (kind: PassportStampRow['kind'], round: number, at = '2026-11-10T10:00:00Z', event = 'e1'): PassportStampRow => ({
    record_id: 'r1', event_id: event, event_name: 'Carrera', kind, base_name: 'Atrio', base_key: 'b1', round_number: round, stamped_at: at,
  })

  it('keeps the old ones and adds the live ones without repeating any', () => {
    const merged = mergeStamps([s('visited', 1), s('visited', 2)], [s('visited', 2, '2026-11-11T09:00:00Z'), s('visited', 3)])
    expect(merged.map((x) => x.round_number).sort()).toEqual([1, 2, 3])
    expect(merged.find((x) => x.round_number === 2)?.stamped_at).toBe('2026-11-11T09:00:00Z') // what happens now wins
  })

  it('the same round of another Carrera or kind is another stamp', () => {
    expect(mergeStamps([s('visited', 1)], [s('visited', 1, undefined, 'e2'), s('hosted', 1)])).toHaveLength(3)
  })
})

describe('personNumber', () => {
  it('is one number for the whole life of the person (no semester in it), the same every time, and different for another person', () => {
    expect(personNumber('abc')).toBe(personNumber('abc'))
    expect(personNumber('abc')).not.toBe(personNumber('abd'))
    expect(personNumber('abc')).toMatch(/^PUJ-\d{6}$/)
  })
})
