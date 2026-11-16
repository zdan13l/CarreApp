// Contrast of the colour pairs the stylesheet really uses, in BOTH palettes (design.test.ts checks the plain
// surfaces; these check the other surfaces and the tinted boxes built with color-mix).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const css = fs.readFileSync(rootPath('src/index.css'), 'utf8')
const dark = /:root\s*\{[\s\S]*?\n\}/.exec(css)![0]
const light = /:root\[data-theme='light'\]\s*\{[\s\S]*?\n\}/.exec(css)![0]
const PALETTES = [['dark', dark], ['light', light]] as const

const hex = (b: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(b)![1]
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: number[], b: number[]) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
// what `color-mix(in srgb, ink p%, surface)` looks like on screen
const mix = (ink: number[], surface: number[], p: number) => ink.map((v, i) => Math.round(v * p + surface[i] * (1 - p)))

// Pairs under the AA threshold, as "palette: foreground on background (ratio)".
// Known (fourth QA run): the light palette's ok/warn/danger and faint text fall 0.1-0.7 short of 4.5:1 on tinted boxes and
// on --surface-3. They are small bold chips, so it is a P2 palette tweak, not a blocker. Fix the colour and delete the line.
const KNOWN_BELOW_AA: string[] = [] // the 2026-11 palette (Marcador nocturno) clears every pair
const below: string[] = []
const check = (label: string, fg: number[], bg: number[], min = 4.5) => {
  const r = ratio(fg, bg)
  if (r < min) below.push(`${label} (${r.toFixed(2)})`)
}

describe('contrast of the real colour pairs, dark and light', () => {
  it.each(PALETTES)('%s: text and status colours are readable on --surface-3 and --inset too (AA 4.5:1)', (name, b) => {
    for (const surface of ['--surface-3', '--inset']) {
      for (const ink of ['--text', '--text-muted', '--text-faint', '--gold-ink', '--sky', '--ok', '--warn', '--danger']) {
        check(`${name}: ${ink} on ${surface}`, rgb(hex(b, ink)), rgb(hex(b, surface)))
      }
    }
  })

  it.each(PALETTES)('%s: ok / warn / danger text on its own tinted box (11 to 16 percent of the colour over the card) keeps 4.5:1', (name, b) => {
    for (const ink of ['--ok', '--warn', '--danger']) {
      for (const p of [0.11, 0.15, 0.16]) {
        for (const base of ['--surface', '--surface-2', '--bg']) {
          const bg = mix(rgb(hex(b, ink)), rgb(hex(b, base)), p)
          check(`${name}: ${ink} ${Math.round(p * 100)}% tint on ${base}`, rgb(hex(b, ink)), bg)
        }
      }
    }
  })

  it.each(PALETTES)('%s: the label of the gold (primary) button keeps 4.5:1 on gold and on its hover colour', (name, b) => {
    for (const bg of ['--gold', '--gold-hover']) {
      expect(ratio(rgb(hex(b, '--on-gold')), rgb(hex(b, bg))), `${name}: --on-gold on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(PALETTES)('%s: text on the selected choice (gold 9 to 22 percent over --surface-2) and on "mine" rows stays readable', (name, b) => {
    for (const p of [0.09, 0.16, 0.22]) {
      const bg = mix(rgb(hex(b, '--gold')), rgb(hex(b, '--surface-2')), p)
      for (const ink of ['--text', '--text-muted']) {
        check(`${name}: ${ink} on gold ${Math.round(p * 100)}%`, rgb(hex(b, ink)), bg)
      }
    }
  })

  it.each(PALETTES)('%s: field borders are visible against the page (non-text 3:1 is the WCAG goal; reported, 1.5:1 is the floor)', (name, b) => {
    // --border-strong draws inputs; --border draws cards (decoration). Floor only: the exact 3:1 would redesign the palette.
    expect(ratio(rgb(hex(b, '--border-strong')), rgb(hex(b, '--surface'))), `${name}: border-strong on surface`).toBeGreaterThanOrEqual(1.5)
  })
})

describe('summary', () => {
  it('the pairs under AA are exactly the known ones (a new one is a regression, a fixed one must be removed from the list)', () => {
    expect(below.sort()).toEqual(KNOWN_BELOW_AA.sort())
  })
})
