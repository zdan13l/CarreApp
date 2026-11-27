// The framing of a profile photo: which part of the picture is saved and how far it can be dragged.
import { describe, expect, it } from 'vitest'
import { clampView, cropRect, MAX_ZOOM } from '../../src/lib/image'

const landscape = { width: 4000, height: 2000 }
const SQUARE = 300

describe('framing a photo', () => {
  it('at the start the centre of the picture is saved, as a square as tall as the picture', () => {
    const r = cropRect(landscape, SQUARE, { zoom: 1, x: 0, y: 0 })
    expect(r.side).toBeCloseTo(2000)
    expect(r.sx).toBeCloseTo(1000)
    expect(r.sy).toBeCloseTo(0)
  })

  it('zooming in saves a smaller part of the picture, around the same centre', () => {
    const r = cropRect(landscape, SQUARE, { zoom: 2, x: 0, y: 0 })
    expect(r.side).toBeCloseTo(1000)
    expect(r.sx + r.side / 2).toBeCloseTo(2000)
    expect(r.sy + r.side / 2).toBeCloseTo(1000)
  })

  it('dragging the picture to the right moves the saved part to the left of it', () => {
    const r = cropRect(landscape, SQUARE, { zoom: 1, x: 90, y: 0 })
    expect(r.sx).toBeLessThan(1000)
  })

  it('it can only be dragged while the picture still covers the square', () => {
    // a 2:1 picture at zoom 1 is 600 x 300 on screen: it can slide 150 px to each side and not at all up or down
    const right = clampView(landscape, SQUARE, { zoom: 1, x: 500, y: 500 })
    expect([right.x, Math.abs(right.y)]).toEqual([150, 0])
    const left = clampView(landscape, SQUARE, { zoom: 1, x: -500, y: -500 })
    expect([left.x, Math.abs(left.y)]).toEqual([-150, 0])
    // zoomed in it can also slide up and down
    const v = clampView(landscape, SQUARE, { zoom: 2, x: 0, y: 999 })
    expect(v.y).toBe(150)
  })

  it('the zoom stays between «just covers» and the limit', () => {
    expect(clampView(landscape, SQUARE, { zoom: 0.2, x: 0, y: 0 }).zoom).toBe(1)
    expect(clampView(landscape, SQUARE, { zoom: 99, x: 0, y: 0 }).zoom).toBe(MAX_ZOOM)
  })

  it('the saved square is always inside the picture, wherever it is dragged', () => {
    for (const zoom of [1, 1.5, 3, MAX_ZOOM]) {
      for (const [x, y] of [[999, 999], [-999, -999], [999, -999], [0, 0]]) {
        const r = cropRect(landscape, SQUARE, clampView(landscape, SQUARE, { zoom, x, y }))
        expect(r.sx).toBeGreaterThanOrEqual(-0.001)
        expect(r.sy).toBeGreaterThanOrEqual(-0.001)
        expect(r.sx + r.side).toBeLessThanOrEqual(landscape.width + 0.001)
        expect(r.sy + r.side).toBeLessThanOrEqual(landscape.height + 0.001)
      }
    }
  })
})
