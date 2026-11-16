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
    // the palettes live in the :root blocks (dark by default, :root[data-theme='light'] for light mode)
    const rest = css.replace(/:root[^{]*\{[\s\S]*?\n\}/g, '')
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

  describe('light and dark mode', () => {
    const block = (re: RegExp) => re.exec(css)![0]
    const vars = (b: string) => new Set([...b.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const dark = block(/:root\s*\{[\s\S]*?\n\}/)
    const light = block(/:root\[data-theme='light'\]\s*\{[\s\S]*?\n\}/)

    it('the light palette defines every colour variable of the dark one', () => {
      const colour = (n: string) => !['--radius', '--radius-sm', '--nav-h'].includes(n)
      const missing = [...vars(dark)].filter((v) => colour(v) && !vars(light).has(v))
      expect(missing).toEqual([])
    })

    it('gold used as text goes through --gold-ink (darker on a light background)', () => {
      expect(css).not.toMatch(/(?<![-\w])color:\s*var\(--gold\)/)
    })

    it('the choice is applied before the first paint and kept on the device', () => {
      const html = fs.readFileSync(rootPath('index.html'), 'utf8')
      expect(html).toMatch(/localStorage\.getItem\('carreapp\.theme'\)/)
      const theme = fs.readFileSync(rootPath('src/lib/theme.ts'), 'utf8')
      expect(theme).toMatch(/localStorage\.setItem\(KEY/)
      expect(theme).toMatch(/catch/) // storage can be blocked
    })

    it('every top bar has the toggle (runner and inductor shell, coordinator, login)', () => {
      for (const f of ['src/components/AppShell.tsx', 'src/pages/admin/AdminNav.tsx', 'src/pages/Login.tsx']) {
        expect(fs.readFileSync(rootPath(f), 'utf8'), f).toMatch(/<ThemeToggle/)
      }
    })

    it('text colours keep a readable contrast on the surfaces of both themes (AA, 4.5:1)', () => {
      const hex = (b: string, name: string) => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(b)![1]
      const lum = (h: string) => {
        const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
      for (const [name, b] of [['dark', dark], ['light', light]] as const) {
        for (const surface of ['--bg', '--surface', '--surface-2']) {
          for (const ink of ['--text', '--text-muted', '--text-faint', '--gold-ink', '--sky', '--ok', '--warn', '--danger']) {
            expect(ratio(hex(b, ink), hex(b, surface)), `${name}: ${ink} on ${surface}`).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    })
  })
})
