// The personal passport: usernames, the Excel that comes in and goes out, cultures per career, the stamps that are merged.
import { describe, expect, it } from 'vitest'
import {
  credentialsData,
  personNumber,
  parsePeople,
  passportUsername,
  PASSPORT_ROLE_LABEL,
  TEMPLATE_DATA,
  type CredentialRow,
  type PassportStampRow,
} from '../../src/lib/passports'
import { cultureOf, themeOf, THEMES } from '../../src/lib/themes'
import { mergeStamps } from '../../src/pages/MemberHome'
import { USERNAME_PATTERN } from '../../src/lib/username'

describe('passportUsername', () => {
  const name = (n: string, taken: string[] = []) => passportUsername(n, new Set(taken))

  it('first name and first surname, without accents or capitals', () => {
    expect(name('Persona Anónima 2')).toBe('persona1')
    expect(name('Persona Anónima 15')).toBe('persona21')
    expect(name('Persona Anónima 16')).toBe('persona22')
  })

  it('with three words the last one is the surname; with two, the second', () => {
    expect(name('Persona Anónima 3')).toBe('persona4')
    expect(name('Persona Anónima 17')).toBe('persona23')
    expect(name('Persona Anónima 18')).toBe('persona24')
  })

  it('a single word still gives a valid @', () => {
    expect(USERNAME_PATTERN.test(name('Madonna'))).toBe(true)
  })

  it('never repeats an @: it adds the initial of the second name, then a number', () => {
    const taken = new Set<string>()
    const a = passportUsername('Persona Anónima 7', taken)
    const b = passportUsername('Persona Anónima 19', taken) // different surname
    const c = passportUsername('Persona Anónima 7', taken) // the same person typed twice
    const d = passportUsername('Juan Carlos Galán Sánchez', taken)
    const e = passportUsername('Persona Anónima 7', taken)
    expect(new Set([a, b, c, d, e]).size).toBe(5)
    expect(a).toBe('persona25')
    expect(c).toBe('persona25.c')
    for (const u of [a, b, c, d, e]) expect(USERNAME_PATTERN.test(u)).toBe(true)
  })

  it('respects the @ that already exist (also the ones of other users)', () => {
    expect(name('Persona Anónima 3', ['persona4'])).not.toBe('persona4')
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

describe('parsePeople (the Excel the coordinator uploads)', () => {
  const ctx = () => ({ theme: 'mitologias', usernames: new Set<string>(), known: new Map<string, string>() })
  const table = (...rows: string[][]) => [[['Nombre', 'Carrera', 'Rol'], ...rows]]

  it('reads names and careers, gives each one a culture and a unique @', () => {
    const rows = parsePeople(
      table(
        ['Persona Anónima 2', 'Ingeniería de Sistemas'],
        ['Persona Anónima 20', 'Ingeniería Mecánica'],
        ['Persona Anónima 8', 'Ingeniería Civil'],
      ),
      ctx(),
    )
    expect(rows.map((r) => [r.username, r.culture, r.role])).toEqual([
      ['persona1', 'nordica', 'runner'],
      ['persona26', 'china', 'runner'],
      ['persona27', 'egipcia', 'runner'],
    ])
    expect(rows.every((r) => r.errors.length === 0 && !r.existing)).toBe(true)
  })

  it('finds the table by its titles, wherever it is and in any order, and skips empty lines', () => {
    const rows = parsePeople([[['Ficha de inductores']], [['', ''], ['Carrera', 'Nombre', 'Rol'], ['Ingeniería Civil', 'Ana Gómez', 'base'], ['', '', ''], ['Redes', 'Luis Ruiz', 'Coordinador']]], ctx())
    expect(rows.map((r) => [r.fullName, r.career, r.role])).toEqual([['Ana Gómez', 'Ingeniería Civil', 'base'], ['Luis Ruiz', 'Redes', 'coordinator']])
  })

  it('explains what is wrong instead of guessing', () => {
    const rows = parsePeople(
      table(['', 'Ingeniería Civil'], ['Ana Gómez', ''], ['Pedro Pérez Ruiz', 'Ingeniería Civil'], ['pedro  pérez ruiz', 'Ingeniería Civil'], ['Zoe Vega', 'Ingeniería Civil', 'jefe']),
      ctx(),
    )
    expect(rows[0].errors).toContain('Falta el nombre.')
    expect(rows[1].errors).toContain('Falta la carrera.')
    expect(rows[2].errors).toEqual([])
    expect(rows[3].errors.join()).toMatch(/repetida/)
    expect(rows[4].errors.join()).toMatch(/rol/)
  })

  it('does not load a table without the two columns', () => {
    expect(() => parsePeople([[['Nombre', 'Correo'], ['Ana', 'a@b.c']]], ctx())).toThrow(/Nombre.*Carrera/)
    expect(() => parsePeople([[['Nombre', 'Carrera']]], ctx())).toThrow(/no tiene personas/)
  })

  it('a career without rule leaves the culture empty (the coordinator picks it)', () => {
    const [r] = parsePeople(table(['Ana Gómez', 'Ingeniería Ambiental']), ctx())
    expect(r.culture).toBeNull()
  })

  it('a person that already has a passport keeps their @ (and is not created again)', () => {
    const c = ctx()
    c.usernames.add('ana.gomez')
    c.known.set('ana gomez', 'ana.gomez')
    const rows = parsePeople(table(['Ana Gómez', 'Ingeniería Civil'], ['Ana Gómez Ruiz', 'Ingeniería Civil']), c)
    expect(rows[0]).toMatchObject({ existing: true, username: 'ana.gomez' })
    expect(rows[1].existing).toBe(false)
    expect(rows[1].username).not.toBe('ana.gomez') // another person never takes it
  })

  it('a requested @ is checked: valid format and not taken', () => {
    const c = ctx()
    c.usernames.add('elpapa')
    const rows = parsePeople([[['Nombre', 'Carrera', 'Usuario'], ['Ana Gómez', 'Redes', '@Ana_G'], ['Luis Ruiz', 'Redes', 'elpapa'], ['Eva Paz', 'Redes', 'x']]], c)
    expect(rows[0].username).toBe('ana_g')
    expect(rows[1].errors.join()).toMatch(/ya existe/)
    expect(rows[2].errors.join()).toMatch(/3-30/)
  })

  it('understands the names of the roles', () => {
    const rows = parsePeople([[['Nombre', 'Carrera', 'Rol'], ['A B', 'Redes', 'Corredor'], ['C D', 'Redes', 'Inductor de base'], ['E F', 'Redes', 'Coordinadora']]], ctx())
    expect(rows.map((r) => r.role)).toEqual(['runner', 'base', 'coordinator'])
  })
})

describe('the Excel that goes out', () => {
  const rows: CredentialRow[] = [
    { fullName: 'Ana Gómez', career: 'Ingeniería Civil', role: 'runner', culture: 'Egipcia', username: 'ana.gomez', password: 'D3lF1nZ4p4t00482' },
    { fullName: 'Luis Ruiz', career: 'Redes', role: 'base', culture: 'Griega', username: 'luis.ruiz', password: '' },
  ]
  const data = credentialsData(rows, 'mitologias')

  it('has the @ and the password of every person, with a header', () => {
    expect(data).toHaveLength(3)
    expect(data[0].map((c) => (c as { value: string }).value)).toEqual(['Nombre', 'Carrera', 'Temática', 'Cultura', 'Comité', 'Rol', 'Usuario (@)', 'Contraseña', 'Entrar en'])
    expect(data[1]).toEqual(['Ana Gómez', 'Ingeniería Civil', 'Mitologías', 'Egipcia', '', PASSPORT_ROLE_LABEL.runner, '@ana.gomez', 'D3lF1nZ4p4t00482', 'carreapp.vercel.app'])
  })

  it('does not invent a password for someone who already had a passport', () => {
    expect(data[2][7]).toBe('(ya tenía)')
  })

  it('the template has the same columns the upload asks for', () => {
    expect(TEMPLATE_DATA[0].map((c) => (c as { value: string }).value).slice(0, 2)).toEqual(['Nombre', 'Carrera'])
    const parsed = parsePeople([TEMPLATE_DATA.map((r) => r.map((c) => (typeof c === 'string' ? c : c.value)))], { theme: 'mitologias', usernames: new Set(), known: new Map() })
    expect(parsed.length).toBe(3)
    expect(parsed.every((r) => r.errors.length === 0 && r.culture)).toBe(true)
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
