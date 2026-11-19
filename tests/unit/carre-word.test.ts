import { describe, expect, it } from 'vitest'
import { LOGO_WRITE_MS, START_MS, STEP_MS, WORDS, WRITE_MS, schedule } from '../../src/components/CarreWord'
import { carreStrokes } from '../../src/lib/carreStrokes'

describe('the name of the app written with a pen', () => {
  it('has eight spellings, each with its own typeface, in Latin and non-Latin scripts', () => {
    expect(WORDS).toHaveLength(8)
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length)
    expect(WORDS.filter((w) => w.lang === 'es')).toHaveLength(3) // calligraphy, capitals and serif italic
    for (const lang of ['ja', 'ar', 'hi', 'ko', 'zh']) expect(WORDS.some((w) => w.lang === lang), lang).toBe(true)
  })

  it('writes the Arabic one from the right, and no other', () => {
    expect(WORDS.filter((w) => w.rtl).map((w) => w.lang)).toEqual(['ar'])
  })

  it('every word carries its outline and at least one pen stroke made of real coordinates', () => {
    for (const w of WORDS) {
      expect(w.outline.startsWith('M'), w.id).toBe(true)
      expect(w.strokes.length, w.id).toBeGreaterThan(0)
      expect(w.viewBox.split(' ')).toHaveLength(4)
      for (const s of w.strokes) {
        expect(s.d).toMatch(/^M-?\d/)
        expect(s.w).toBeGreaterThan(0)
        expect(s.len).toBeGreaterThan(0)
        expect(s.d).not.toMatch(/NaN|undefined/)
      }
    }
    expect(carreStrokes.final.strokes.length).toBeGreaterThan(0)
    expect(carreStrokes.final.viewBox).toBe('0 0 1278 260') // the viewBox of /wordmark.svg, whose shape clips the pen
  })

  it('the Arabic word starts on its right-hand side and the others on their left', () => {
    const firstX = (d: string) => Number(d.match(/^M(-?[\d.]+)/)![1])
    for (const w of WORDS) {
      const xs = w.strokes.map((s) => firstX(s.d))
      if (w.rtl) expect(xs[0]).toBeGreaterThanOrEqual(Math.max(...xs) - 1)
      else expect(xs[0]).toBeLessThanOrEqual(Math.min(...xs) + 1)
    }
  })

  it('shares the writing time among the strokes by their length, in order, each starting before the previous one ends', () => {
    const strokes = [{ d: 'M0 0', w: 1, len: 300 }, { d: 'M0 0', w: 1, len: 100 }, { d: 'M0 0', w: 1, len: 100 }]
    const t = schedule(strokes, 1000)
    expect(t[0].delay).toBe(0)
    expect(t[1].delay).toBeGreaterThan(0)
    expect(t[1].delay).toBeLessThan(t[0].delay + t[0].dur) // overlap: the pen does not stop between strokes
    expect(t[2].delay).toBeGreaterThan(t[1].delay)
    expect(t[0].dur).toBeGreaterThan(t[1].dur) // the longest stroke takes the longest
  })

  it('takes about eight seconds and writes each word before it leaves, so nobody waits for it (the form is usable the whole time)', () => {
    expect(WRITE_MS).toBeLessThan(STEP_MS)
    for (const w of WORDS) {
      const t = schedule(w.strokes, WRITE_MS)
      expect(Math.max(...t.map((x) => x.delay + x.dur)), w.id).toBeLessThanOrEqual(WRITE_MS + 2) // never longer than the time given to the word
    }
    const total = START_MS + WORDS.length * STEP_MS + LOGO_WRITE_MS
    expect(total).toBeGreaterThan(6000)
    expect(total).toBeLessThan(10000)
  })
})
