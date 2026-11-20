// The personal passport: usernames, the Excel that comes in and goes out, cultures per career, the stamps that are merged.
import { describe, expect, it } from 'vitest'
import { documentNumber } from '../../src/components/MemberPassport'
import {
  credentialsData,
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
    expect(name('Gabriel Alejandro Peñuela Niño')).toBe('gabriel.penuela')
    expect(name('Juan Daniel Ortíz Quecán')).toBe('juan.ortiz')
    expect(name('María Fernanda Cruz Niño')).toBe('maria.cruz')
  })

  it('with three words the last one is the surname; with two, the second', () => {
    expect(name('Sara Castro Ramirez')).toBe('sara.ramirez')
    expect(name('Juan Antonio Hernández')).toBe('juan.hernandez')
    expect(name('Mariana Hernandez')).toBe('mariana.hernandez')
  })

  it('a single word still gives a valid @', () => {
    expect(USERNAME_PATTERN.test(name('Madonna'))).toBe(true)
  })

  it('never repeats an @: it adds the initial of the second name, then a number', () => {
    const taken = new Set<string>()
    const a = passportUsername('Juan Camilo Galán Sánchez', taken)
    const b = passportUsername('Juan Sebastian Castilla Sanchez', taken) // different surname
    const c = passportUsername('Juan Camilo Galán Sánchez', taken) // the same person typed twice
    const d = passportUsername('Juan Carlos Galán Sánchez', taken)
    const e = passportUsername('Juan Camilo Galán Sánchez', taken)
    expect(new Set([a, b, c, d, e]).size).toBe(5)
    expect(a).toBe('juan.galan')
    expect(c).toBe('juan.galan.c')
    for (const u of [a, b, c, d, e]) expect(USERNAME_PATTERN.test(u)).toBe(true)
  })

  it('respects the @ that already exist (also the ones of other users)', () => {
    expect(name('Sara Castro Ramirez', ['sara.ramirez'])).not.toBe('sara.ramirez')
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

  it('an unknown theme (written by a newer version) falls back instead of breaking the passport', () => {
    expect(themeOf('vikingos').key).toBe('mitologias')
    expect(cultureOf('vikingos', 'no-existe').key).toBe('nordica')
    expect(cultureOf('mitologias', 'china').name).toBe('China')
  })
})

describe('parsePeople (the Excel the coordinator uploads)', () => {
  const ctx = () => ({ theme: 'mitologias', usernames: new Set<string>(), known: new Map<string, string>() })
  const table = (...rows: string[][]) => [[['Nombre', 'Carrera', 'Rol'], ...rows]]

  it('reads names and careers, gives each one a culture and a unique @', () => {
    const rows = parsePeople(
      table(
        ['Gabriel Alejandro Peñuela Niño', 'Ingeniería de Sistemas'],
        ['Juan Diego Santamaría Pinzón', 'Ingeniería Mecánica'],
        ['Jose Miguel Giraldo Gomez', 'Ingeniería Civil'],
      ),
      ctx(),
    )
    expect(rows.map((r) => [r.username, r.culture, r.role])).toEqual([
      ['gabriel.penuela', 'nordica', 'runner'],
      ['juan.santamaria', 'china', 'runner'],
      ['jose.giraldo', 'egipcia', 'runner'],
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
    expect(data[0].map((c) => (c as { value: string }).value)).toEqual(['Nombre', 'Carrera', 'Temática', 'Cultura', 'Rol', 'Usuario (@)', 'Contraseña', 'Entrar en'])
    expect(data[1]).toEqual(['Ana Gómez', 'Ingeniería Civil', 'Mitologías', 'Egipcia', PASSPORT_ROLE_LABEL.runner, '@ana.gomez', 'D3lF1nZ4p4t00482', 'carreapp.vercel.app'])
  })

  it('does not invent a password for someone who already had a passport', () => {
    expect(data[2][6]).toBe('(ya tenía)')
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

describe('documentNumber', () => {
  it('is the same every time for the same person and semester, and different for another', () => {
    expect(documentNumber('abc', '2026-2')).toBe(documentNumber('abc', '2026-2'))
    expect(documentNumber('abc', '2026-2')).not.toBe(documentNumber('abd', '2026-2'))
    expect(documentNumber('abc', '2026-2')).toMatch(/^PUJ-20262-\d{4}$/)
  })
})
