import fs from 'node:fs'
import * as hb from 'harfbuzzjs'

export async function shapeText(fontFile, text) {
  const data = fs.readFileSync(fontFile)
  const blob = new hb.Blob(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
  const face = new hb.Face(blob)
  const font = new hb.Font(face)
  const buffer = new hb.Buffer()
  buffer.addText(text)
  buffer.guessSegmentProperties()
  hb.shape(font, buffer)
  const infos = buffer.getGlyphInfos()
  const positions = buffer.getGlyphPositions()
  const upem = face.upem
  // the pen advances in visual order (harfbuzz already put right-to-left text in reading order on screen)
  let x = 0
  const parts = []
  infos.forEach((info, i) => {
    const pos = positions[i]
    const d = font.glyphToPath(info.codepoint)
    if (d) parts.push({ d, x: x + (pos.xOffset ?? 0), y: pos.yOffset ?? 0 })
    x += pos.xAdvance
  })
  return { parts, advance: x, upem }
}

// Moves a path (absolute M L Q C Z in font units, y up) to its place in the word and flips y (SVG is y down).
export function placePath(d, dx, dy) {
  const out = []
  const re = /([MLQCZ])([^MLQCZ]*)/gi
  let m
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase()
    if (cmd === 'Z') { out.push('Z'); continue }
    const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const pts = []
    for (let i = 0; i < n.length; i += 2) pts.push(`${+(n[i] + dx).toFixed(1)} ${+(-(n[i + 1] + dy)).toFixed(1)}`)
    out.push(cmd + pts.join(' '))
  }
  return out.join('')
}
