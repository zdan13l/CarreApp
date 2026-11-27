// The birthday of a person: code of the passport, age and the dates that are accepted.
import { describe, expect, it } from 'vitest'
import { ageOf, birthdayCode, birthdayProblem, isRealDate, parseBirthday } from '../../src/lib/birthday'
import { personNumber } from '../../src/lib/passports'

describe('birthday', () => {
  it('the code of the passport is PUJ + day, month and year', () => {
    expect(birthdayCode('2005-03-15')).toBe('PUJ-15032005')
    expect(birthdayCode('1999-12-01')).toBe('PUJ-01121999')
    expect(birthdayCode(null)).toBeNull()
    expect(birthdayCode('2005-02-30')).toBeNull()
  })

  it('the passport number is the code of the birthday, and the old number without one', () => {
    expect(personNumber('abc', '2005-03-15')).toBe('PUJ-15032005')
    expect(personNumber('abc', null)).toMatch(/^PUJ-\d{6}$/)
    expect(personNumber('abc')).toBe(personNumber('abc', null))
  })

  it('the age counts whole years and rolls over on the birthday', () => {
    const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)
    expect(ageOf('2005-03-15', day(2026, 3, 14))).toBe(20)
    expect(ageOf('2005-03-15', day(2026, 3, 15))).toBe(21)
    expect(ageOf('2005-03-15', day(2026, 12, 31))).toBe(21)
    expect(ageOf(null)).toBeNull()
  })

  it('real dates only', () => {
    expect(isRealDate('2004-02-29')).toBe(true)
    expect(isRealDate('2005-02-29')).toBe(false)
    expect(isRealDate('2005-13-01')).toBe(false)
  })

  it('it reads the ways an Excel or a person writes a date', () => {
    expect(parseBirthday('2005-03-15')).toBe('2005-03-15')
    expect(parseBirthday('15/03/2005')).toBe('2005-03-15')
    expect(parseBirthday('5-3-2005')).toBe('2005-03-05')
    expect(parseBirthday('15.03.2005')).toBe('2005-03-15')
    expect(parseBirthday('')).toBe('')
    expect(parseBirthday('  ')).toBe('')
    expect(parseBirthday('mañana')).toBeNull()
    expect(parseBirthday('31/02/2005')).toBeNull()
  })

  it('an unreasonable age is refused', () => {
    const now = new Date(2026, 10, 26)
    expect(birthdayProblem('2005-03-15', now)).toBeNull()
    expect(birthdayProblem(null, now)).toBeNull()
    expect(birthdayProblem('2020-01-01', now)).toMatch(/año/)
    expect(birthdayProblem('1900-01-01', now)).toMatch(/año/)
    expect(birthdayProblem('2005-02-30', now)).toMatch(/no existe/)
  })
})
