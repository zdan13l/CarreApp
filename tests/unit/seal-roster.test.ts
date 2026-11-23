// The seals of the bases: no repeats, one ink per mythology, and the ink of a seal never changes.
import { describe, expect, it } from 'vitest'
import { CULTURE_INK, MYTH_SEALS, registerSealRoster, sealForSeed } from '../../src/lib/seals'
import { stampLook } from '../../src/lib/stamp'

const ids = Array.from({ length: 15 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)

describe('seals and inks', () => {
  it('each mythology has three seals and its own ink; no ink is shared between mythologies', () => {
    const cultures = new Set(MYTH_SEALS.map((s) => s.culture))
    expect(cultures.size).toBe(5)
    for (const c of cultures) expect(MYTH_SEALS.filter((s) => s.culture === c)).toHaveLength(3)
    expect(new Set(Object.values(CULTURE_INK)).size).toBe(5)
  })

  it('15 bases get 15 different seals', () => {
    registerSealRoster(ids)
    expect(new Set(ids.map((id) => sealForSeed(id).key)).size).toBe(15)
  })

  it('the ink follows the seal: the same seal is always the same colour, and the three seals of a mythology share it', () => {
    registerSealRoster(ids)
    const inkOfSeal = new Map<string, number>()
    for (const id of ids) {
      const seal = sealForSeed(id)
      const ink = stampLook(id).ink
      expect(ink).toBe(CULTURE_INK[seal.culture])
      expect(inkOfSeal.get(seal.key) ?? ink).toBe(ink)
      inkOfSeal.set(seal.key, ink)
    }
  })
})
