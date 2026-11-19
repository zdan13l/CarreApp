// Turns each spelling of the name (and the real logotype) into the pen strokes that write it:
//   1. the word is shaped with HarfBuzz (Arabic joins, Devanagari conjuncts) and drawn as an outline,
//   2. the outline is rasterised and thinned to its centre line (Zhang-Suen),
//   3. the centre line is walked as one pen path per connected piece, from the side the script starts on, and simplified.
// In the browser each path is drawn with a thick round pen and clipped by the outline, so the letters are written along their own shape.
import fs from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { shapeText, placePath } from './shape.mjs'
import { SPECS } from './spec.mjs'

const H = 220 // height in pixels of the raster the centre line is taken from
const WORDMARK = process.argv[2] // path to public/wordmark.svg
const OUT = process.argv[3]

function bboxOf(d) {
  const n = d.match(/-?\d+(\.\d+)?/g).map(Number)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < n.length; i += 2) {
    x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1])
  }
  return { x0, y0, x1, y1 }
}

function raster(svg, width) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render()
  const w = r.width, h = r.height, px = r.pixels
  const img = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) img[i] = px[i * 4 + 3] > 127 ? 1 : 0
  return { img, w, h }
}

// Zhang-Suen thinning
function thin(img, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x])
  let changed = true
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      const kill = []
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!img[y * w + x]) continue
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1), p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1)
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
          if (b < 2 || b > 6) continue
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
          let a = 0
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) a++
          if (a !== 1) continue
          if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue }
          else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue
          kill.push(y * w + x)
        }
      }
      if (kill.length) { changed = true; for (const k of kill) img[k] = 0 }
    }
  }
  return img
}

// distance to the background (chamfer 3-4), to know how thick the pen has to be
function distance(src, w, h) {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = src[i] ? INF : 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (!d[i]) continue
    let v = d[i]
    if (x > 0) v = Math.min(v, d[i - 1] + 3)
    if (y > 0) { v = Math.min(v, d[i - w] + 3); if (x > 0) v = Math.min(v, d[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4) }
    d[i] = v
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x
    if (!d[i]) continue
    let v = d[i]
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3)
    if (y < h - 1) { v = Math.min(v, d[i + w] + 3); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4); if (x > 0) v = Math.min(v, d[i + w - 1] + 4) }
    d[i] = v
  }
  return d.map((v) => v / 3)
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
function neighbours(sk, w, h, i) {
  const x = i % w, y = (i / w) | 0, out = []
  for (const [dx, dy] of NB) {
    const nx = x + dx, ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && sk[ny * w + nx]) out.push(ny * w + nx)
  }
  return out
}

// removes short spurs (the little hairs thinning leaves at corners)
function prune(sk, w, h, minLen) {
  for (let round = 0; round < 3; round++) {
    const ends = []
    for (let i = 0; i < w * h; i++) if (sk[i] && neighbours(sk, w, h, i).length === 1) ends.push(i)
    for (const e of ends) {
      const walk = [e]
      let prev = -1, cur = e, junction = false
      while (walk.length <= minLen) {
        const nxt = neighbours(sk, w, h, cur).filter((n) => n !== prev && !walk.includes(n))
        if (nxt.length === 0) break
        if (nxt.length > 1) { junction = true; break }
        prev = cur; cur = nxt[0]
        if (neighbours(sk, w, h, cur).length > 2) { junction = true; break }
        walk.push(cur)
      }
      if (junction && walk.length < minLen) for (const p of walk) sk[p] = 0
    }
  }
}

function components(sk, w, h) {
  const seen = new Uint8Array(w * h), comps = []
  for (let i = 0; i < w * h; i++) {
    if (!sk[i] || seen[i]) continue
    const comp = [], queue = [i]
    seen[i] = 1
    while (queue.length) {
      const c = queue.pop()
      comp.push(c)
      for (const n of neighbours(sk, w, h, c)) if (!seen[n]) { seen[n] = 1; queue.push(n) }
    }
    comps.push(comp)
  }
  return comps
}

// one continuous pen path through a piece of centre line (backtracking over branches), starting at the end on the side the script starts
function walk(comp, sk, w, h, rtl) {
  const set = new Set(comp)
  const xs = (i) => i % w
  const ends = comp.filter((i) => neighbours(sk, w, h, i).length === 1)
  const pool = ends.length ? ends : comp
  const start = pool.reduce((a, b) => (rtl ? xs(b) > xs(a) : xs(b) < xs(a)) ? b : a)
  const path = [start], visited = new Set([start]), stack = [start]
  let lastNew = 0, dir = [rtl ? -1 : 1, 0]
  while (stack.length) {
    const cur = stack[stack.length - 1]
    const cand = neighbours(sk, w, h, cur).filter((n) => set.has(n) && !visited.has(n))
    if (cand.length) {
      // keep going the way the pen was going
      cand.sort((a, b) => {
        const score = (n) => { const vx = (n % w) - (cur % w), vy = ((n / w) | 0) - ((cur / w) | 0); return (vx * dir[0] + vy * dir[1]) / Math.hypot(vx, vy) }
        return score(b) - score(a)
      })
      const next = cand[0]
      dir = [(next % w) - (cur % w), ((next / w) | 0) - ((cur / w) | 0)]
      visited.add(next); stack.push(next); path.push(next); lastNew = path.length - 1
    } else {
      stack.pop()
      if (stack.length) path.push(stack[stack.length - 1])
    }
  }
  return path.slice(0, lastNew + 1)
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]
  const len = Math.hypot(bx - ax, by - ay)
  let idx = -1, max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]
    const dist = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
    if (dist > max) { max = dist; idx = i }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)]
}

// svg source + the box of its content -> the pen strokes in the units of that box
function strokesOf(svgFor, box, rtl) {
  const scale = H / box.h
  const wpx = Math.max(60, Math.round(box.w * scale))
  const { img, w, h } = raster(svgFor(box, wpx, H), wpx)
  const dist = distance(img, w, h)
  const glyph = Uint8Array.from(img)
  const sk = thin(Uint8Array.from(img), w, h)
  prune(sk, w, h, Math.round(H * 0.05))
  const comps = components(sk, w, h).sort((a, b) => {
    const mx = (c) => c.reduce((s, i) => s + (i % w), 0) / c.length
    return rtl ? mx(b) - mx(a) : mx(a) - mx(b)
  })
  const px2u = (v) => v / scale
  const strokes = []
  let covered = new Uint8Array(w * h)
  for (const comp of comps) {
    const path = walk(comp, sk, w, h, rtl)
    const pts = simplify(path.map((i) => [(i % w) + 0.5, ((i / w) | 0) + 0.5]), 1)
    const maxR = comp.reduce((m, i) => Math.max(m, dist[i]), 1)
    const pen = Math.max(3, maxR * 2 * 1.3 + 2) // px
    const d = pts.length === 1 ? `M${pts[0][0]} ${pts[0][1]}h.1` : 'M' + pts.map(([x, y]) => `${+(box.x0 + px2u(x)).toFixed(1)} ${+(box.y0 + px2u(y)).toFixed(1)}`).join('L')
    const dd = pts.length === 1 ? `M${+(box.x0 + px2u(pts[0][0])).toFixed(1)} ${+(box.y0 + px2u(pts[0][1])).toFixed(1)}h.1` : d
    let len = 0
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    strokes.push({ d: dd, w: +px2u(pen).toFixed(1), len: Math.max(+px2u(len).toFixed(1), 1) })
    // coverage check
    const r = Math.ceil(pen / 2)
    for (const i of path) {
      const cx = i % w, cy = (i / w) | 0
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const x = cx + dx, y = cy + dy
        if (x >= 0 && y >= 0 && x < w && y < h) covered[y * w + x] = 1
      }
    }
  }
  let total = 0, miss = 0
  for (let i = 0; i < w * h; i++) if (glyph[i]) { total++; if (!covered[i]) miss++ }
  return { strokes, coverage: 1 - miss / total, pieces: comps.length }
}

const result = { words: [], final: null }

for (const s of SPECS) {
  const { parts, upem } = await shapeText(`fonts/${s.id}.ttf`, s.text)
  const outline = parts.map((p) => placePath(p.d, p.x, p.y)).join('')
  const b = bboxOf(outline)
  const pad = upem * 0.03
  const box = { x0: b.x0 - pad, y0: b.y0 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad }
  const svgFor = (bx, wpx, hpx) => `<svg xmlns="http://www.w3.org/2000/svg" width="${wpx}" height="${hpx}" viewBox="${bx.x0} ${bx.y0} ${bx.w} ${bx.h}" preserveAspectRatio="none"><path d="${outline}" fill="#000"/></svg>`
  const { strokes, coverage, pieces } = strokesOf(svgFor, box, s.rtl)
  const r = (v) => +v.toFixed(1)
  result.words.push({ id: s.id, lang: s.lang, rtl: Boolean(s.rtl), gold: Boolean(s.gold), viewBox: `${r(box.x0)} ${r(box.y0)} ${r(box.w)} ${r(box.h)}`, outline, strokes })
  console.log(s.id.padEnd(10), 'pieces', String(pieces).padStart(2), 'coverage', (coverage * 100).toFixed(1) + '%', 'outline', outline.length, 'strokes', JSON.stringify(strokes).length)
}

// the real logotype
const wm = fs.readFileSync(WORDMARK, 'utf8')
const vb = wm.match(/viewBox="([\d.\s-]+)"/)[1].split(/\s+/).map(Number)
const wbox = { x0: vb[0], y0: vb[1], w: vb[2], h: vb[3] }
const svgFor = (bx, wpx, hpx) => wm.replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${wpx}" height="${hpx}" viewBox="${bx.x0} ${bx.y0} ${bx.w} ${bx.h}" preserveAspectRatio="none">`)
const f = strokesOf(svgFor, wbox, false)
result.final = { viewBox: vb.join(' '), strokes: f.strokes }
console.log('logotype'.padEnd(10), 'pieces', String(f.pieces).padStart(2), 'coverage', (f.coverage * 100).toFixed(1) + '%', 'strokes', JSON.stringify(f.strokes).length)

const header = `// GENERATED by tools/carre-strokes (npm run build there): do not edit by hand.
// The pen strokes that write the name CarreApp on the login, in eight scripts and typefaces, and the real logotype.
// Typefaces (all SIL Open Font License, drawn as outlines): Great Vibes, Noto Serif JP, Archivo, Noto Naskh Arabic,
// Playfair Display, Noto Sans Devanagari, Noto Sans KR, Ma Shan Zheng.
export interface PenStroke {
  d: string // the pen path, in the units of the viewBox
  w: number // how thick the round pen is, in the same units
  len: number // length of the path, to share the time between strokes
}
export interface WordStrokes {
  id: string
  lang: string
  rtl: boolean
  gold: boolean
  viewBox: string
  outline: string // the letters; the pen is clipped by it
  strokes: PenStroke[]
}
export interface CarreStrokes {
  words: WordStrokes[]
  final: { viewBox: string; strokes: PenStroke[] } // the logotype: the pen is clipped by /wordmark.svg
}
`
fs.writeFileSync(OUT, OUT.endsWith('.ts') ? header + 'export const carreStrokes: CarreStrokes = ' + JSON.stringify(result) + '\n' : JSON.stringify(result))
console.log('written', OUT, fs.statSync(OUT).size, 'bytes')
