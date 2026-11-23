// The seals of the bases: no repeats, one ink per mythology, and the ink of a seal never changes.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { MYTH_SEALS, registerSealRoster, sealForSeed, sealInkVar } from '../../src/lib/seals'

const ids = Array.from({ length: 15 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)

describe('seals and inks', () => {
  it('each mythology has three seals', () => {
    const cultures = new Set(MYTH_SEALS.map((s) => s.culture))
    expect(cultures.size).toBe(5)
    for (const c of cultures) expect(MYTH_SEALS.filter((s) => s.culture === c)).toHaveLength(3)
  })

  it('the fifteen seals have fifteen different colours, within a mythology and between mythologies', () => {
    const css = fs.readFileSync('src/index.css', 'utf8')
    const light = /:root\[data-theme='light'\] \{([^}]*--seal-horus[^}]*)\}/.exec(css)![1]
    const colours = MYTH_SEALS.map((x) => new RegExp(`--seal-${x.key}:\\s*(#[0-9a-f]{6})`, 'i').exec(light)![1].toLowerCase())
    expect(new Set(colours).size).toBe(15)
  })

  it('every seal has its colour in both themes of the stylesheet', () => {
    const css = fs.readFileSync('src/index.css', 'utf8')
    for (const s of MYTH_SEALS) expect(css.match(new RegExp(`--seal-${s.key}:`, 'g'))?.length, s.key).toBeGreaterThanOrEqual(3) // dark, light and the tower
  })

  it('15 bases get 15 different seals, and the colour is the seal own', () => {
    registerSealRoster(ids)
    expect(new Set(ids.map((id) => sealForSeed(id).key)).size).toBe(15)
    for (const id of ids) expect(sealInkVar(id)).toBe(`var(--seal-${sealForSeed(id).key})`)
  })
})
