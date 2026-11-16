import { afterEach, describe, expect, it, vi } from 'vitest'
import { distanceMeters, isLocationFresh, LOCATION_HIDE_AFTER_MS, timeAgo } from '../../src/lib/geo'
import { formatDistance, formatDuration } from '../../src/lib/mapbox'
import { generatePassword } from '../../src/lib/password'
import { legKey } from '../../src/lib/travel'
import { normalizeUsername, suggestUsername, USERNAME_PATTERN, usernameToEmail } from '../../src/lib/username'
import { ITEM_LABEL, ROLE_LABEL, SCORE_ITEMS, STATUS_LABEL, infoOf } from '../../src/types'

describe('usernames', () => {
  it('turn a username into the internal email and accept the full email when typing', () => {
    expect(usernameToEmail('  Daniel ')).toBe('daniel@carreapp.test')
    expect(normalizeUsername('Admin@CarreApp.test')).toBe('admin')
    expect(normalizeUsername('otro@gmail.com')).toBe('otro@gmail.com') // only the internal domain is stripped
  })

  it('follow the same pattern as the database check', () => {
    for (const ok of ['abc', 'a.b-c_9', 'x'.repeat(30)]) expect(USERNAME_PATTERN.test(ok)).toBe(true)
    for (const bad of ['ab', 'A', 'con espacio', 'ñ', 'x'.repeat(31)]) expect(USERNAME_PATTERN.test(bad)).toBe(false)
  })

  it('are suggested from the name without accents', () => {
    expect(suggestUsername('María José Pérez')).toBe('maria.perez')
    expect(suggestUsername('Nicolás')).toBe('nicolas')
    expect(suggestUsername('   ')).toBe('')
  })
})

describe('generated passwords', () => {
  it('are readable (no look-alike characters), 8 long by default and different each time', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const p = generatePassword()
      expect(p).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]{8}$/)
      seen.add(p)
    }
    expect(seen.size).toBeGreaterThan(195)
    expect(generatePassword(12)).toHaveLength(12)
  })
})

describe('geography helpers', () => {
  it('measure distances between map points', () => {
    expect(distanceMeters([-74.0647, 4.6286], [-74.0647, 4.6286])).toBe(0)
    // one thousandth of a degree of latitude is about 111 m
    expect(distanceMeters([-74.0647, 4.6286], [-74.0647, 4.6296])).toBeGreaterThan(105)
    expect(distanceMeters([-74.0647, 4.6286], [-74.0647, 4.6296])).toBeLessThan(118)
  })

  it('format distances, durations and "x ago"', () => {
    expect(formatDistance(45)).toBe('50 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDuration(30)).toBe('1 min')
    expect(formatDuration(660)).toBe('11 min')
    vi.useFakeTimers() // a real clock can tick between building the date and formatting it
    vi.setSystemTime(new Date('2027-01-20T10:00:00Z'))
    const ago = (s: number) => timeAgo(new Date(Date.now() - s * 1000).toISOString())
    expect(ago(20)).toBe('hace 20 s')
    expect(ago(180)).toBe('hace 3 min')
    expect(ago(7200)).toBe('hace 2 h')
  })

  afterEach(() => vi.useRealTimers())

  it('hides a team position that has not been updated for an hour', () => {
    const now = Date.parse('2027-01-20T15:00:00Z')
    const ago = (ms: number) => new Date(now - ms).toISOString()
    expect(isLocationFresh(ago(5 * 60_000), now)).toBe(true)
    expect(isLocationFresh(ago(LOCATION_HIDE_AFTER_MS - 1000), now)).toBe(true)
    expect(isLocationFresh(ago(LOCATION_HIDE_AFTER_MS), now)).toBe(false)
    expect(isLocationFresh(ago(5 * 3600_000), now)).toBe(false)
  })

  it('build the key of a leg of the route', () => expect(legKey('a', 'b')).toBe('a>b'))
})

describe('shared types and labels', () => {
  it('label every score item, role and match status in Spanish', () => {
    expect(SCORE_ITEMS.map((i) => ITEM_LABEL[i])).toEqual(['Barra', 'Pregunta', 'Minijuego'])
    expect(Object.values(ROLE_LABEL)).toEqual(['Coordinador', 'Inductor de base', 'Corredor'])
    expect(Object.values(STATUS_LABEL)).toEqual(['Pendiente', 'En juego', 'Terminado'])
  })

  it('read the one-to-one embed whether it arrives as an object or as an array', () => {
    expect(infoOf({ info: 'x' })).toBe('x')
    expect(infoOf([{ info: 'y' }])).toBe('y')
    expect(infoOf([])).toBeNull()
    expect(infoOf(null)).toBeNull()
    expect(infoOf(undefined)).toBeNull()
  })
})
