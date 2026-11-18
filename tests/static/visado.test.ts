// The "Visado" identity: the app is a passport. These tests keep its promises from eroding.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')
const css = read('src/index.css')

describe('the passport', () => {
  const run = read('src/pages/RunnerHome.tsx')
  it('has Visado, Pasaporte and Top as the runner tabs', () => {
    expect(run).toMatch(/label: 'Visado'/)
    expect(run).toMatch(/label: 'Pasaporte'/)
    expect(run).toMatch(/label: 'Top'/)
  })

  it('a stamp is earned when the match is finished (the base scored the three stages) and shows only what the runner already reads: no points, no rivals', () => {
    const passport = read('src/components/Passport.tsx')
    expect(passport).toMatch(/m\.status === 'finished' \? 'done'/)
    expect(passport).toMatch(/finished_at/)
    expect(passport).not.toMatch(/points|standings|winner_team_id/)
  })

  it('the three stages are derived from the scores the base has registered, never stored separately', () => {
    expect(read('src/lib/flight.ts')).toMatch(/export function stageStates/)
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/stageStates\(match\.match_scores/)
  })

  it('plays a moment when the base scores the third stage, but not for the stamps that were already there when the screen opened', () => {
    expect(run).toMatch(/m\.status === 'finished' && !seen\.current/)
    expect(run).toMatch(/seen\.current === null/)
    expect(run).toMatch(/<StampMoment/)
    expect(read('src/components/StampMoment.tsx')).toMatch(/navigator\.vibrate/)
  })

  it('shows each base with the same stamp everywhere: runner, base and coordinator all draw it from the id of the base', () => {
    for (const file of ['src/pages/RunnerHome.tsx', 'src/pages/BaseHome.tsx', 'src/pages/admin/Bases.tsx']) {
      expect(read(file), file).toMatch(/<Stamp\b/)
    }
    expect(read('src/lib/stamp.ts')).toMatch(/export function stampLook/)
  })
})

describe('the cover', () => {
  it('uses the photo of the campus (two sizes) and the official logo on the login, and ships them with the app', () => {
    const login = read('src/pages/Login.tsx')
    expect(login).toMatch(/srcSet="\/campus-800\.jpg 800w, \/campus\.jpg 1600w"/)
    expect(login).toMatch(/src="\/javeriana-logo-white\.png"/)
    for (const f of ['campus.jpg', 'campus-800.jpg', 'javeriana-logo.png', 'javeriana-logo-white.png']) expect(fs.existsSync(rootPath(`public/${f}`)), f).toBe(true)
  })

  it('the app starts in light mode (the paper) and keeps "dark" as the passport by night', () => {
    expect(read('index.html')).toMatch(/dark \? 'dark' : 'light'/)
  })
})

describe('motion', () => {
  it('turns pages with the View Transitions API only when the browser has it and motion is not reduced', () => {
    const motion = read('src/lib/motion.ts')
    expect(motion).toMatch(/startViewTransition/)
    expect(motion).toMatch(/prefers-reduced-motion/)
    expect(read('src/components/BottomNav.tsx')).toMatch(/withPageTurn/)
    expect(read('src/pages/admin/AdminNav.tsx')).toMatch(/viewTransition/)
  })

  it('keeps the global switch that turns every animation off with "reduce motion"', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation: none !important/)
  })

  it('the keyframes only describe where an animation starts, so with motion off every element sits in its final state', () => {
    for (const name of ['rise', 'fade', 'moment-in', 'photo-settle', 'pill-in', 'stamp-in']) {
      const m = new RegExp(`@keyframes ${name} \{([^@]*?)\}\s*(?=@|\n)`).exec(css)
      expect(m, name).not.toBeNull()
      expect(m![1], name).toMatch(/from|55%/)
    }
  })
})
