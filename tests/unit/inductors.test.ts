// The global list of inductors: the career and entry of each person, the search and filters, the Excel of a whole induction and the profile edits.
import { describe, expect, it } from 'vitest'
import {
  careerOfPerson,
  entryOf,
  hasFilters,
  inductorsTable,
  latestCareers,
  matchCareer,
  matchesSearch,
  NO_FILTERS,
  parseInductors,
  passesFilters,
  profileChanges,
  rowProblem,
  shortCareer,
  songSearchOf,
  type InductorsContext,
} from '../../src/lib/inductors'
import { credentialsData, templateData, type PassportPerson } from '../../src/lib/passports'

const CAREERS = ['Ingeniería Civil', 'Ingeniería de Sistemas', 'Ingeniería Industrial', 'Mecatrónica', 'Bioingeniería']
const person = (over: Partial<PassportPerson> = {}): PassportPerson => ({ id: 'p', username: 'ana.ruiz', full_name: 'Ana Pardo Ruiz', photo_path: null, ...over })

describe('the entry comes from the generation', () => {
  it('is the semester of the first generation, and nothing for one without semester or without generation', () => {
    expect(entryOf('Barbies')).toBe('2630')
    expect(entryOf('Peluches / Barbies')).toBe('2610')
    expect(entryOf('Textiles')).toBeNull()
    expect(entryOf('')).toBeNull()
    expect(entryOf(null)).toBeNull()
  })
})

describe('the career of the catalog a written one means', () => {
  it('finds it with or without accents, in any case, and by a part of its name', () => {
    expect(matchCareer('ingenieria civil', CAREERS)).toBe('Ingeniería Civil')
    expect(matchCareer('Civil', CAREERS)).toBe('Ingeniería Civil')
    expect(matchCareer('Sistemas', CAREERS)).toBe('Ingeniería de Sistemas')
    expect(matchCareer('MECATRÓNICA', CAREERS)).toBe('Mecatrónica')
  })
  it('does not guess when it is not there', () => {
    expect(matchCareer('Ingeniería Ambiental', CAREERS)).toBeNull()
    expect(matchCareer('', CAREERS)).toBeNull()
  })
  it('the short name that fits in a chip drops «Ingeniería de»', () => {
    expect(shortCareer('Ingeniería de Sistemas')).toBe('Sistemas')
    expect(shortCareer('Ingeniería Civil')).toBe('Civil')
    expect(shortCareer('Mecatrónica')).toBe('Mecatrónica')
  })
  it('the career of a person is the one of their passport, or the one of their latest participation', () => {
    expect(careerOfPerson(person({ career: 'Mecatrónica' }), 'Civil')).toBe('Mecatrónica')
    expect(careerOfPerson(person(), 'Civil')).toBe('Civil')
    expect(careerOfPerson(person())).toBeNull()
    expect(latestCareers([{ passport_id: 'a', career: 'Redes' }, { passport_id: 'a', career: 'Civil' }, { passport_id: 'b', career: 'Redes' }]).get('a')).toBe('Civil')
  })
})

describe('the search of the list', () => {
  const ana = person({ nickname: 'Anita', generation: 'Barbies' })
  const mariana = person({ id: 'm', username: 'mariana.lopez', full_name: 'Mariana López' })
  it('each typed word starts a word of the person: «ana» finds Ana and not Mariana', () => {
    expect(matchesSearch(ana, 'Ingeniería de Sistemas', 'ana')).toBe(true)
    expect(matchesSearch(mariana, null, 'ana')).toBe(false)
  })
  it('finds by name, nickname, career, generation or @, without accents and in any case', () => {
    expect(matchesSearch(ana, 'Ingeniería de Sistemas', 'PARDO')).toBe(true)
    expect(matchesSearch(ana, 'Ingeniería de Sistemas', 'anita')).toBe(true)
    expect(matchesSearch(ana, 'Ingeniería de Sistemas', 'sistemas')).toBe(true)
    expect(matchesSearch(ana, 'Ingeniería de Sistemas', 'barbies')).toBe(true)
    expect(matchesSearch(ana, null, '@ana.ruiz')).toBe(true)
    expect(matchesSearch(mariana, null, 'lopez')).toBe(true)
  })
  it('several words must all match, and an empty search shows everyone', () => {
    expect(matchesSearch(ana, null, 'ana ruiz')).toBe(true)
    expect(matchesSearch(ana, null, 'ana lopez')).toBe(false)
    expect(matchesSearch(ana, null, '  ')).toBe(true)
  })
})

describe('the filters of the list', () => {
  const sistemasActive = { state: 'active' as const, career: 'Ingeniería de Sistemas', role: 'runner' }
  const sistemasAncestor = { state: 'ancestor' as const, career: 'Ingeniería de Sistemas', role: null }
  const civilAncestor = { state: 'ancestor' as const, career: 'Ingeniería Civil', role: null }
  it('without filters everyone passes', () => {
    expect(hasFilters(NO_FILTERS)).toBe(false)
    expect(passesFilters(NO_FILTERS, sistemasActive)).toBe(true)
  })
  it('inside a group they add up: Sistemas or Civil', () => {
    const f = { ...NO_FILTERS, careers: ['Ingeniería de Sistemas', 'Ingeniería Civil'] }
    expect(passesFilters(f, sistemasActive)).toBe(true)
    expect(passesFilters(f, civilAncestor)).toBe(true)
    expect(passesFilters(f, { state: 'active', career: 'Mecatrónica' })).toBe(false)
  })
  it('between groups they narrow down: the ancestors of Sistemas', () => {
    const f = { ...NO_FILTERS, careers: ['Ingeniería de Sistemas'], states: ['ancestor' as const] }
    expect(hasFilters(f)).toBe(true)
    expect(passesFilters(f, sistemasAncestor)).toBe(true)
    expect(passesFilters(f, sistemasActive)).toBe(false)
    expect(passesFilters(f, civilAncestor)).toBe(false)
  })
  it('somebody without a career never passes a career filter', () => {
    expect(passesFilters({ ...NO_FILTERS, careers: ['Ingeniería Civil'] }, { state: 'active', career: null })).toBe(false)
  })
  it('the induction they entered is a filter of its own', () => {
    const f = { ...NO_FILTERS, entries: ['2630', '2710'] }
    expect(passesFilters(f, { ...sistemasActive, entry: '2630' })).toBe(true)
    expect(passesFilters(f, { ...sistemasActive, entry: '2610' })).toBe(false)
    expect(passesFilters(f, sistemasActive)).toBe(false)
    expect(passesFilters({ ...f, states: ['ancestor' as const] }, { ...sistemasAncestor, entry: '2630' })).toBe(true)
  })
  it('inside a carrera the role filters too', () => {
    expect(passesFilters({ ...NO_FILTERS, roles: ['base'] }, sistemasActive)).toBe(false)
    expect(passesFilters({ ...NO_FILTERS, roles: ['runner', 'base'] }, sistemasActive)).toBe(true)
  })
})

describe('the Excel of a whole induction', () => {
  const ctx = (over: Partial<InductorsContext> = {}): InductorsContext => ({ careers: CAREERS, usernames: new Set<string>(), known: new Map<string, string>(), defaultGeneration: '', ...over })
  const table = (...rows: string[][]) => [[['Nombre', 'Carrera', 'Generación', 'Apodo (opcional)', '¿Qué canción sonaría cada vez que entraras a un lugar? (opcional)'], ...rows]]

  it('reads name, career, generation, nickname and song, gives each one a unique @', () => {
    const rows = parseInductors(
      table(
        ['Camila Andrea Rojas Prieto', 'Ingeniería de Sistemas', 'barbies', 'Cami', 'Mujeriego - Ryan Castro'],
        ['Diego Alonso Rivas Torres', 'Mecatrónica', 'Minichips', 'Apodo', ''],
      ),
      ctx(),
    )
    expect(rows.map((r) => [r.username, r.career, r.generation, r.nickname, r.songWritten])).toEqual([
      ['camila.rojas', 'Ingeniería de Sistemas', 'Barbies', 'Cami', 'Mujeriego - Ryan Castro'],
      ['diego.rivas', 'Mecatrónica', 'Minichips', 'Apodo', ''],
    ])
    expect(rows.every((r) => rowProblem(r) === null && !r.existing)).toBe(true)
  })

  it('the career is matched to the catalog («Civil» is Ingeniería Civil); one that is not there waits for the coordi to choose', () => {
    const rows = parseInductors(table(['Ana Gómez', 'Civil', 'Barbies', 'Apodo', ''], ['Luis Ruiz', 'Ingeniería Ambiental', 'Barbies', 'Apodo', '']), ctx())
    expect(rows[0].career).toBe('Ingeniería Civil')
    expect(rows[1].career).toBeNull()
    expect(rowProblem(rows[1])).toMatch(/carrera/i)
  })

  it('a person without generation takes the default one, and without default waits for the coordi', () => {
    const [a] = parseInductors(table(['Ana Gómez', 'Civil', '', 'Apodo', '']), ctx({ defaultGeneration: 'Minichips' }))
    expect(a.generation).toBe('Minichips')
    const [b] = parseInductors(table(['Ana Gómez', 'Civil', '', 'Apodo', '']), ctx())
    expect(b.generation).toBe('')
    expect(rowProblem(b)).toMatch(/generaci/i)
  })

  it('a generation that does not exist is explained with the ones that do', () => {
    const [r] = parseInductors(table(['Ana Gómez', 'Civil', 'Inventada', 'Apodo', '']), ctx())
    expect(r.errors.join(' ')).toMatch(/generación «Inventada» no existe \(Champiñones, Peluches, Barbies, Minichips, Textiles\)/)
  })

  it('explains what is wrong instead of guessing: repeated people, long nicknames', () => {
    const rows = parseInductors(table(['Pedro Pérez Ruiz', 'Civil', 'Barbies', 'Apodo', ''], ['pedro  pérez ruiz', 'Civil', 'Barbies', 'Apodo', ''], ['Zoe Vega', 'Civil', 'Barbies', 'n'.repeat(25), '']), ctx())
    expect(rows[0].errors).toEqual([])
    expect(rows[1].errors.join()).toMatch(/repetida/)
    expect(rows[2].errors.join()).toMatch(/apodo es muy largo/)
  })

  it('finds the table by its titles wherever it is, and skips empty lines; the form of the induction (name and song, no generation) also loads', () => {
    const rows = parseInductors([[['Ficha']], [['Apodo', ''], ['Carrera', 'Nombre'], ['Civil', 'Ana Gómez'], ['Apodo', '']], [['ID', 'Nombre', '¿Qué canción sonaría?'], ['1', 'Eva Paz', 'Comernos']]], ctx())
    expect(rows.map((r) => r.fullName)).toEqual(['Ana Gómez'])
    expect(inductorsTable([[['ID', 'Nombre', '¿Qué canción sonaría?'], ['1', 'Eva Paz', 'Comernos']]])).not.toBeNull()
    const form = parseInductors([[['ID', 'Name', 'Nombre', 'Carrera', '¿Qué canción sonaría cada vez que entraras a un lugar?'], ['1', 'cuenta@x', 'Eva Paz', 'Redes', 'Comernos - bad gyal']]], ctx({ careers: [] }))
    expect(form[0]).toMatchObject({ fullName: 'Eva Paz', career: 'Redes', songWritten: 'Comernos - bad gyal' })
  })

  it('the nickname is required for a new person, and not for one already registered', () => {
    const [a, b] = parseInductors(table(['Ana Gómez', 'Civil', 'Barbies', '', ''], ['Eva Paz', '', '', '', 'Comernos']), ctx({ known: new Map([['eva paz', 'eva.paz']]) }))
    expect(a.errors).toContain('Falta el apodo.')
    expect(rowProblem(a)).toBe('Falta el apodo.')
    expect(rowProblem(b)).toBeNull()
  })

  it('does not load a table without the columns, or without people', () => {
    expect(() => parseInductors([[['Nombre', 'Correo'], ['Ana', 'a@b.c']]], ctx())).toThrow(/Nombre.*Carrera/)
    expect(() => parseInductors([[['Nombre', 'Carrera']]], ctx())).toThrow(/no tiene personas/)
  })

  it('a person already registered keeps their @ and only needs a song; another person never takes it', () => {
    const c = ctx({ usernames: new Set(['ana.gomez']), known: new Map([['ana gomez', 'ana.gomez']]) })
    const rows = parseInductors(table(['Ana Gómez', '', '', '', 'Comernos'], ['Ana Gómez Ruiz', 'Civil', 'Barbies', 'Apodo', '']), c)
    expect(rows[0]).toMatchObject({ existing: true, username: 'ana.gomez' })
    expect(rowProblem(rows[0])).toBeNull() // no career or generation needed
    expect(rows[1].existing).toBe(false)
    expect(rows[1].username).not.toBe('ana.gomez')
  })

  it('a requested @ is checked: valid format and not taken', () => {
    const c = ctx({ usernames: new Set(['elpapa']) })
    const rows = parseInductors([[['Nombre', 'Carrera', 'Generación', 'Usuario'], ['Ana Gómez', 'Civil', 'Barbies', '@Ana_G'], ['Luis Ruiz', 'Civil', 'Barbies', 'elpapa'], ['Eva Paz', 'Civil', 'Barbies', 'x']]], c)
    expect(rows[0].username).toBe('ana_g')
    expect(rows[1].errors.join()).toMatch(/ya existe/)
    expect(rows[2].errors.join()).toMatch(/3-30/)
  })

  it('only an Apple Music link or plain text is searched; a link of another service is left to the coordi', () => {
    const [a, b, c] = parseInductors(table(['A B', 'Civil', 'Barbies', '', 'https://music.apple.com/us/song/comernos/1804988448'], ['C D', 'Civil', 'Barbies', '', 'https://open.spotify.com/track/2K9vpqu9'], ['E F', 'Civil', 'Barbies', '', 'Mujeriego']), ctx())
    expect(songSearchOf(a)).toMatch(/music\.apple\.com/)
    expect(songSearchOf(b)).toBe('')
    expect(songSearchOf(c)).toBe('Mujeriego')
  })
})

describe('the Excel that goes out and the template', () => {
  it('has the @ and the password of every person, with a header, and does not invent a password for someone who already had one', () => {
    const data = credentialsData([
      { fullName: 'Ana Gómez', career: 'Ingeniería Civil', generation: 'Barbies', username: 'ana.gomez', password: 'D3lF1nZ4p4t00482' },
      { fullName: 'Luis Ruiz', career: 'Mecatrónica', generation: 'Minichips', username: 'luis.ruiz', password: '' },
    ])
    expect(data).toHaveLength(3)
    expect(data[0].map((c) => (c as { value: string }).value)).toEqual(['Nombre', 'Carrera', 'Generación', 'Usuario (@)', 'Contraseña', 'Entrar en'])
    expect(data[1]).toEqual(['Ana Gómez', 'Ingeniería Civil', 'Barbies', '@ana.gomez', 'D3lF1nZ4p4t00482', 'carreapp.vercel.app'])
    expect(data[2][4]).toBe('(ya tenía)')
  })

  it('the template loads as it is: its examples use the careers and generations of the catalog', () => {
    const rows = templateData(CAREERS, ['Minichips', 'Barbies']).map((r) => r.map((c) => (typeof c === 'string' ? c : c.value)))
    const parsed = parseInductors([rows], { careers: CAREERS, usernames: new Set(), known: new Map(), defaultGeneration: '' })
    expect(parsed).toHaveLength(3)
    expect(parsed.every((r) => rowProblem(r) === null)).toBe(true)
    expect(parsed.map((r) => [r.username, r.nickname])).toEqual([['ana.perez', 'Anita'], ['luis.ruiz', 'Lucho'], ['camila.torres', 'Cami']])
    expect(parsed[0].songWritten).toBe('Mujeriego - Ryan Castro')
  })
})

describe('what changed in a profile', () => {
  const ana = person({ career: 'Ingeniería Civil', generation: 'Barbies', joined_term: '2630', nickname: 'Anita' })
  const same = { fullName: 'Ana Pardo Ruiz', username: 'ana.ruiz', career: 'Ingeniería Civil', generation: 'Barbies', nickname: 'Anita', song: null }
  it('nothing changed, nothing to save', () => {
    expect(profileChanges(ana, 'Ingeniería Civil', same)).toEqual({})
  })
  it('a new generation brings its entry; one without semester leaves the entry alone', () => {
    expect(profileChanges(ana, 'Ingeniería Civil', { ...same, generation: 'Peluches' })).toEqual({ generation: 'Peluches', joined_term: '2610' })
    expect(profileChanges(ana, 'Ingeniería Civil', { ...same, generation: 'Textiles' })).toEqual({ generation: 'Textiles' })
  })
  it('saves only what was touched: name (cleaned), career, nickname, song', () => {
    const song = { title: 'Mujeriego', artist: 'Ryan Castro', preview: 'https://audio-ssl.itunes.apple.com/a.m4a' }
    expect(profileChanges(ana, 'Ingeniería Civil', { ...same, fullName: '  Ana  María Pardo ', career: 'Mecatrónica', nickname: '', song })).toEqual({ full_name: 'Ana María Pardo', career: 'Mecatrónica', nickname: null, song })
  })
  it('a new @ is saved apart (the login follows it); the same one is not a change', () => {
    expect(profileChanges(ana, 'Ingeniería Civil', { ...same, username: ' @Ana.Nueva ' })).toEqual({ username: 'ana.nueva' })
    expect(profileChanges(ana, 'Ingeniería Civil', { ...same, username: 'ana.ruiz' })).toEqual({})
  })
  it('a person that had no career before 0043 gets the one the coordi picks', () => {
    expect(profileChanges(person({ generation: 'Barbies' }), null, { ...same, nickname: '' })).toEqual({ career: 'Ingeniería Civil' })
  })
})
