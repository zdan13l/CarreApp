// The design rules of docs/wiki/Diseno.md, enforced on the source so they do not erode:
// no emojis, colours only from the CSS variables, and icon-only buttons that screen readers can name.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { closing, rootPath, sourceFiles } from './helpers'

const code = sourceFiles('src', ['.ts', '.tsx'])
const css = fs.readFileSync(rootPath('src/index.css'), 'utf8')

describe('visual rules', () => {
  it('uses no emojis anywhere in the source (icons come from lucide-react, teams without a photo show initials)', () => {
    const found: string[] = []
    for (const { file, text } of [...code, { file: 'src/index.css', text: css }]) {
      text.split('\n').forEach((line, i) => {
        const m = line.match(/\p{Extended_Pictographic}/u)
        if (m) found.push(`${file}:${i + 1} ${m[0]}`)
      })
    }
    expect(found).toEqual([])
  })

  it('has no colour literals in TypeScript: colours are CSS variables (the map markers are styled in CSS)', () => {
    const found: string[] = []
    for (const { file, text } of code) {
      text.split('\n').forEach((line, i) => {
        if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*(\/\/|\*)/.test(line)) found.push(`${file}:${i + 1} ${line.trim().slice(0, 80)}`)
      })
    }
    expect(found).toEqual([])
  })

  it('keeps hex colours in the stylesheet inside :root, except a short documented list', () => {
    const rootBlock = /:root\s*\{[\s\S]*?\n\}/.exec(css)![0]
    const rest = css.replace(rootBlock, '')
    const allowed = new Set(['#fff', '#2f7bf0', '#2f80ff', '#1a1206', '#000']) // white outline and map-marker blues
    const stray = [...new Set(rest.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])].filter((c) => !allowed.has(c.toLowerCase()))
    expect(stray).toEqual([])
  })

  it('defines every CSS variable it uses', () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const used = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))]
    expect(used.filter((v) => !defined.has(v))).toEqual([])
  })
})

describe('accessibility', () => {
  /** Opening tags `<button ...>` (JSX-aware: a `>` inside `{...}` does not end the tag). */
  function buttonTags(text: string): { tag: string; line: number }[] {
    const out: { tag: string; line: number }[] = []
    const re = /<button\b/g
    for (let m = re.exec(text); m; m = re.exec(text)) {
      let depth = 0
      let i = m.index
      for (; i < text.length; i++) {
        const ch = text[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0 && text[i - 1] !== '=') break
      }
      out.push({ tag: text.slice(m.index, i + 1), line: text.slice(0, m.index).split('\n').length })
    }
    return out
  }

  it('gives an accessible name to every icon-only button (.icon-btn must have aria-label)', () => {
    const missing: string[] = []
    for (const { file, text } of code.filter((s) => s.file.endsWith('.tsx'))) {
      for (const { tag, line } of buttonTags(text)) {
        if (/icon-btn/.test(tag) && !/aria-label=/.test(tag)) missing.push(`${file}:${line}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('declares an alt attribute on every <img> (empty for decorative images)', () => {
    const missing: string[] = []
    for (const { file, text } of code.filter((s) => s.file.endsWith('.tsx'))) {
      for (const m of text.matchAll(/<img\b/g)) {
        const end = closing(text, text.indexOf('{', m.index) < 0 ? m.index : m.index) // not used for ranges
        void end
        const tag = text.slice(m.index, text.indexOf('/>', m.index) + 2)
        if (!/\balt=/.test(tag)) missing.push(`${file}:${text.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('sets the page language and the viewport for phones', () => {
    const html = fs.readFileSync(rootPath('index.html'), 'utf8')
    expect(html).toContain('lang="es"')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('apple-mobile-web-app-capable')
  })
})

describe('hygiene', () => {
  it('leaves no console.log or debugger in the app', () => {
    const found = code.flatMap(({ file, text }) => text.split('\n').map((l, i) => ({ file, l, i })).filter(({ l }) => /\bconsole\.log\(|\bdebugger\b/.test(l)).map(({ file, i }) => `${file}:${i + 1}`))
    expect(found).toEqual([])
  })

  it('keeps the development-only preview page out of production routing', () => {
    const app = code.find((s) => s.file === 'src/App.tsx')!.text
    expect(app).toMatch(/import\.meta\.env\.DEV \? lazy\(/)
  })
})
