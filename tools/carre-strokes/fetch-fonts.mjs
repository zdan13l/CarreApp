import fs from 'node:fs'
import wawoff2 from 'wawoff2'
import { SPECS } from './spec.mjs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' // a browser: Google answers with woff2
fs.mkdirSync('fonts', { recursive: true })
for (const s of SPECS) {
  const url = `https://fonts.googleapis.com/css2?family=${s.css}&text=${encodeURIComponent(s.text)}`
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  const m = css.match(/src:\s*url\(([^)]+)\)/)
  if (!m) throw new Error(`${s.id}: no font in\n${css.slice(0, 300)}`)
  const woff2 = new Uint8Array(await (await fetch(m[1])).arrayBuffer())
  const ttf = await wawoff2.decompress(woff2)
  fs.writeFileSync(`fonts/${s.id}.ttf`, ttf)
  console.log(s.id, woff2.length, '->', ttf.length)
}
