import { describe, expect, it } from 'vitest'
import { mrzLines, mrzText, stampLook, stampTime, STAMP_SHAPES } from '../../src/lib/stamp'

describe('stamps of the passport', () => {
  it('a base always gets the same shape, ink and tilt (so its stamp is recognisable everywhere)', () => {
    expect(stampLook('base-123')).toEqual(stampLook('base-123'))
  })

  it('different bases spread over the shapes and inks, and the tilt stays small', () => {
    const looks = Array.from({ length: 60 }, (_, i) => stampLook(`base-${i}`))
    expect(new Set(looks.map((l) => l.shape)).size).toBe(STAMP_SHAPES.length)
    expect(new Set(looks.map((l) => l.ink)).size).toBe(5)
    for (const l of looks) {
      expect(l.ink).toBeGreaterThanOrEqual(1)
      expect(l.ink).toBeLessThanOrEqual(5)
      expect(Math.abs(l.tilt)).toBeLessThanOrEqual(6)
    }
  })

  it('formats the time of arrival as 24 h and tolerates a missing or broken value', () => {
    expect(stampTime(null)).toBe('')
    expect(stampTime('not a date')).toBe('')
    expect(stampTime('2026-11-18T17:04:00Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('writes the machine-readable lines without accents and always 30 characters wide', () => {
    expect(mrzText('Dioses Nórdicos', 22)).toBe('DIOSES<NORDICOS<<<<<<<')
    const [a, b] = mrzLines('Guerreros Aztecas', 2, 5)
    expect(a).toHaveLength(30)
    expect(b).toHaveLength(30)
    expect(a.startsWith('P<JAV<<GUERREROS<AZTECAS')).toBe(true)
    expect(b.startsWith('SELLOS02<<RONDAS05')).toBe(true)
  })
})
