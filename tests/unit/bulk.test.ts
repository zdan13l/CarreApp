import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  classifyTable, completeRows, countErrors, isEmpty, nameKey, parseRole, parseTables, readTablesFromFile,
  tableFromCsv, tablesFromHtml, validateFile, type ExistingData,
} from '../../src/lib/bulk'

const NONE: ExistingData = { usernames: new Set(), teams: new Set(), bases: new Set(), matches: [] }
const load = async (name: string) => readTablesFromFile(new File([fs.readFileSync(`public/plantillas/${name}`)], name))
const parse = (tables: string[][][], existing: ExistingData = NONE) => validateFile(parseTables(tables), existing)

describe('the downloadable templates', () => {
  it.each(['plantilla-carrera.docx', 'plantilla-carrera.xlsx'])('%s loads the whole Carrera with no errors', async (name) => {
    const file = parse(await load(name))
    expect(file.carrera).toMatchObject({ name: 'Carrera 2027-1', maxMinutes: 10, errors: [] })
    expect(file.grupos).toHaveLength(4)
    expect(file.bases).toHaveLength(2)
    expect(file.personas).toHaveLength(5)
    expect(file.cruces).toHaveLength(4)
    expect(file.tiempos).toHaveLength(2)
    expect(file.notes).toEqual([]) // the instructions sheet / paragraphs are not mistaken for data
    expect(countErrors(file)).toBe(0)
  })

  it('the Word and Excel templates contain exactly the same data', async () => {
    const word = parse(await load('plantilla-carrera.docx'))
    const excel = parse(await load('plantilla-carrera.xlsx'))
    const strip = (f: typeof word) => JSON.stringify({ ...f, personas: f.personas.map((p) => ({ ...p, password: '' })) })
    expect(strip(excel)).toBe(strip(word))
  })

  it('the people-only CSV loads too (semicolon separated, with a BOM)', async () => {
    const file = parse(await load('plantilla-personas.csv'))
    expect(file.personas).toHaveLength(5)
    expect(countErrors(file)).toBe(0)
    expect(file.personas.filter((p) => p.gps).map((p) => p.fullName)).toEqual(['Daniel Rodríguez', 'Nicolás Pérez'])
  })

  it('reads a base with its information, 3 questions and map location', async () => {
    const atrio = parse(await load('plantilla-carrera.docx')).bases[0]
    expect(atrio).toMatchObject({ name: 'Atrio', lat: 4.6286, lng: -74.0647 })
    expect(atrio.questions).toHaveLength(3)
    expect(atrio.info).toContain('historia')
  })
})

describe('recognising tables by their column titles', () => {
  it.each([
    [['Dato', 'Valor'], 'carrera'],
    [['Nombre del grupo'], 'grupos'],
    [['Grupo'], 'grupos'],
    [['Nombre de la base', 'Información', 'Pregunta 1', 'Pregunta 2', 'Pregunta 3', 'Latitud', 'Longitud'], 'bases'],
    [['Nombre completo', 'Rol', 'Grupo o base', 'Usuario (opcional)', 'GPS (opcional)', 'Contraseña (opcional)'], 'personas'],
    [['Ronda', 'Base', 'Grupo A', 'Grupo B'], 'cruces'],
    [['Desde', 'Hasta', 'Minutos'], 'tiempos'],
    [['NOMBRE   COMPLETO', 'ROL', 'GRUPO O BASE'], 'personas'], // capitals and spaces do not matter
    [['Cosa', 'Otra'], null],
  ])('%j -> %s', (header, kind) => expect(classifyTable(header)).toBe(kind))

  it('ignores an unknown table with a note, and an empty file is detected', () => {
    const file = parse([[['Cosa', 'Otra'], ['1', '2']]])
    expect(file.notes[0]).toContain('no se reconoce')
    expect(isEmpty(file)).toBe(true)
  })

  it('takes every table of a Word document in the HTML that mammoth produces', () => {
    const html =
      '<h1>x</h1><table><tr><td><p>Nombre del grupo</p></td></tr><tr><td><p>A &amp; B</p></td></tr></table><p>texto</p>' +
      '<table><tr><td>Dato</td><td>Valor</td></tr></table>'
    expect(tablesFromHtml(html)).toEqual([[['Nombre del grupo'], ['A & B']], [['Dato', 'Valor']]])
  })
})

describe('people', () => {
  const people = (rows: string[][]) =>
    parse([[['Nombre completo', 'Rol', 'Grupo o base', 'Usuario', 'GPS', 'Contraseña'], ...rows]]).personas

  it('generates usernames from the name (no accents), avoiding repeats, and passwords', () => {
    const rows = people([
      ['Juan Pérez', 'Corredor', 'G1', '', '', ''],
      ['Juan Pablo Pérez', 'Corredor', 'G1', '', '', ''],
      ['María', 'Base', 'Atrio', '', '', ''],
    ])
    expect(rows.map((r) => r.username)).toEqual(['juan.perez', 'juan.perez2', 'maria'])
    expect(rows.every((r) => r.password.length === 8 && r.errors.length === 0)).toBe(true)
  })

  it('keeps explicit usernames and passwords, and accepts the full internal email', () => {
    const [p] = people([['Ana Ruiz', 'Corredor', 'G1', 'ANA.RUIZ@carreapp.test', '', 'clave-larga']])
    expect(p).toMatchObject({ username: 'ana.ruiz', password: 'clave-larga', errors: [] })
  })

  it.each([
    [['Ana Ruiz', 'Capitán', 'G1', '', '', ''], 'Rol no válido'],
    [['', 'Corredor', 'G1', '', '', ''], 'Falta el nombre'],
    [['Ana Ruiz', 'Corredor', '', '', '', ''], 'Falta el grupo'],
    [['Ana Ruiz', 'Base', '', '', '', ''], 'Falta la base'],
    [['Ana Ruiz', 'Corredor', 'G1', 'a b', '', ''], 'Usuario no válido'],
    [['Ana Ruiz', 'Corredor', 'G1', '', '', '123'], 'al menos 6 caracteres'],
    [['Ana Ruiz', 'Base', 'Atrio', '', 'Sí', ''], 'GPS solo aplica a corredores'],
  ])('flags %j', (row, message) => {
    expect(people([row])[0].errors.join(' ')).toContain(message)
  })

  it('flags repeated people and usernames (inside the file and against existing users)', () => {
    const rows = people([
      ['Ana Ruiz', 'Corredor', 'G1', 'ana', '', ''],
      ['Ana Ruiz', 'Corredor', 'G2', 'ana2', '', ''],
      ['Luis Paz', 'Corredor', 'G1', 'ana', '', ''],
    ])
    expect(rows[0].errors.join()).toContain('más de una vez')
    expect(rows[2].errors.join()).toContain('repetido en el archivo')
    const existing = completeRows(rows.slice(2), new Set(['ana']))
    expect(existing[0].errors.join()).toContain('ya existe')
  })

  it('understands role synonyms and the GPS flag', () => {
    expect(['Corredor', 'corredora', 'RUNNER'].map(parseRole)).toEqual(['runner', 'runner', 'runner'])
    expect(['Base', 'Inductor', 'inductor de base'].map(parseRole)).toEqual(['base', 'base', 'base'])
    const rows = people([
      ['A Uno', 'Corredor', 'G', '', 'sí', ''],
      ['B Dos', 'Corredor', 'G', '', 'x', ''],
      ['C Tres', 'Corredor', 'G', '', 'no', ''],
    ])
    expect(rows.map((r) => r.gps)).toEqual([true, true, false])
  })
})

describe('bases, matchups and travel times', () => {
  const T = (header: string[], ...rows: string[][]) => [header, ...rows]
  const groups = T(['Grupo'], ['A'], ['B'], ['C'], ['D'])
  const bases = T(['Nombre de la base', 'Información'], ['B1', 'x'], ['B2', 'y'])

  it('reads coordinates with a decimal comma and requires latitude and longitude together', () => {
    const file = parse([T(['Nombre de la base', 'Latitud', 'Longitud'], ['B1', '4,6286', '-74,0647'], ['B2', '4.6', ''], ['B3', '95', '-74'])])
    expect(file.bases[0]).toMatchObject({ lat: 4.6286, lng: -74.0647, errors: [] })
    expect(file.bases[1].errors.join()).toContain('juntas')
    expect(file.bases[2].errors.join()).toContain('latitud')
  })

  it('detects the schedule mistakes the database would reject', () => {
    const file = parse([
      groups,
      bases,
      T(
        ['Ronda', 'Base', 'Grupo A', 'Grupo B'],
        ['1', 'B1', 'A', 'B'], // ok
        ['2', 'B2', 'B', 'A'], // same pair again (reversed)
        ['1', 'B1', 'C', 'D'], // base B1 already hosts a match in round 1
        ['1', 'B2', 'C', 'A'], // A already plays in round 1
        ['1', 'B9', 'C', 'Z'], // unknown base and group
        ['x', 'B2', 'A', 'A'], // bad round, group against itself
      ),
    ])
    const errors = file.cruces.map((r) => r.errors.join(' '))
    expect(errors[0]).toBe('')
    expect(errors[1]).toContain('ya se enfrentan')
    expect(errors[2]).toContain('ya tiene un cruce en la ronda 1')
    expect(errors[3]).toContain('ya juega en la ronda 1')
    expect(errors[4]).toContain('"B9" no existe')
    expect(errors[4]).toContain('"Z" no existe')
    expect(errors[5]).toContain('número entero')
    expect(errors[5]).toContain('a sí mismo')
  })

  it('also checks the matchups against what already exists in the Carrera', () => {
    const existing: ExistingData = {
      usernames: new Set(),
      teams: new Set(['a', 'b']),
      bases: new Set(['b1']),
      matches: [{ round: 1, base: 'b1', a: 'b', b: 'a' }],
    }
    const file = parse([T(['Ronda', 'Base', 'Grupo A', 'Grupo B'], ['2', 'B1', 'A', 'B'])], existing)
    expect(file.cruces[0].errors.join()).toContain('ya se enfrentan')
  })

  it('accepts groups and bases that are only named in People (they will be created)', () => {
    const file = parse([
      T(['Nombre completo', 'Rol', 'Grupo o base'], ['Ana Ruiz', 'Corredor', 'Samuráis'], ['Luis Paz', 'Base', 'Cancha']),
      T(['Ronda', 'Base', 'Grupo A', 'Grupo B'], ['1', 'Cancha', 'Samuráis', 'Samuráis']),
    ])
    expect(file.cruces[0].errors.join()).not.toContain('no existe')
  })

  it('validates travel times (known bases, different bases, 1-180 minutes, no repeats)', () => {
    const file = parse([
      bases,
      T(['Desde', 'Hasta', 'Minutos'], ['B1', 'B2', '5'], ['B1', 'B2', '6'], ['B1', 'B9', '5'], ['B1', 'B1', '5'], ['B2', 'B1', '0']),
    ])
    const errors = file.tiempos.map((r) => r.errors.join(' '))
    expect(errors[0]).toBe('')
    expect(errors[1]).toContain('repetido')
    expect(errors[2]).toContain('"B9" no existe')
    expect(errors[3]).toContain('dos bases distintas')
    expect(errors[4]).toContain('entre 1 y 180')
  })

  it('validates the Carrera section (name required, minutes 1-120)', () => {
    const file = parse([T(['Dato', 'Valor'], ['Nombre de la Carrera', ''], ['Tiempo máximo de traslado (min)', '500'])])
    expect(file.carrera!.errors.join(' ')).toContain('Falta el nombre')
    expect(file.carrera!.errors.join(' ')).toContain('entre 1 y 120')
  })

  it('reports duplicated groups and bases inside the file', () => {
    const file = parse([T(['Grupo'], ['Dioses  Griegos'], ['dioses griegos'])])
    expect(file.grupos[1].errors.join()).toContain('repetido')
  })
})

describe('CSV reader and name matching', () => {
  it('handles semicolons, commas, quotes with separators inside and a BOM', () => {
    expect(tableFromCsv('﻿a;b\r\n"x;y";"say ""hi"""\r\n')).toEqual([['a', 'b'], ['x;y', 'say "hi"']])
    expect(tableFromCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('compares names without accents, capitals or extra spaces', () => {
    expect(nameKey('  Dioses   Nórdicos ')).toBe(nameKey('dioses nordicos'))
  })

  it('refuses a file format it cannot read', async () => {
    await expect(readTablesFromFile(new File(['x'], 'datos.pdf'))).rejects.toThrow(/Formato no admitido/)
  })
})
