// What the maintainer asked for on the phone and coordinator screens (design review of 2026-11-16), kept from regressing.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('login', () => {
  const login = read('src/pages/Login.tsx')
  it('uses the agreed copy', () => {
    expect(login).toContain('placeholder="Dado por el coordi"')
    expect(login).toContain('Gestión en vivo de Carrera')
    expect(login).toMatch(/<p className="login-foot">Semana de inducción<\/p>/)
    // the name of the University appears only in the official logo (its alt text), never as copy
    expect(login.replace(/alt="Pontificia Universidad Javeriana"/g, '')).not.toMatch(/Pontificia|Javeriana/)
  })
  it('keeps the logo readable on the blue panel in light mode (dark-mode logo colours inside it)', () => {
    expect(read('src/index.css')).toMatch(/\.login-hero \{ --gold: var\(--on-hero-gold\); --sky: var\(--on-hero-sky\); \}/)
  })
})

describe('top bars show the name and @user beside the picture', () => {
  const menu = read('src/components/AccountMenu.tsx')
  it('the account button holds the avatar, the name and the @user', () => {
    expect(menu).toMatch(/className="account-btn"[\s\S]*<Avatar[\s\S]*account-text[\s\S]*@\{user\?\.username\}/)
  })
  it('the icon buttons keep their icon size (the ghost padding used to squeeze the bell to 6px)', () => {
    expect(read('src/index.css')).toMatch(/button\.icon-btn \{ padding: 0; \}/)
  })
})

describe('the base screen', () => {
  const base = read('src/pages/BaseHome.tsx')
  it('keeps the guide and the questions in "Mi base", not in "Ronda"', () => {
    const ronda = base.slice(base.indexOf("{tab === 'ronda' && ("), base.indexOf("{tab === 'resultados' && ("))
    expect(ronda).not.toContain('<BaseGuide')
    expect(base).toMatch(/function MyBaseTab[\s\S]*<BaseGuide[\s\S]*<BaseWhere/)
  })
  it('opens the map only to change the location (or when none is saved yet)', () => {
    expect(base).toMatch(/hasLocation && !editing \?[\s\S]*Cambiar ubicación/)
  })
})

describe('the runner screen', () => {
  it('"Después" shows the base photo and the rival crest, like the base screen', () => {
    const run = read('src/pages/RunnerHome.tsx')
    expect(run).toMatch(/export function AfterCard[\s\S]*nt-photo[\s\S]*<Crest/)
    expect(run).toMatch(/<AfterCard match=\{after\}/)
  })
})

describe('user photos (0018)', () => {
  it('Usuarios lets the coordinator add a photo and the account button shows it', () => {
    const us = read('src/pages/admin/Usuarios.tsx')
    expect(us).toMatch(/uploadPhoto\('users', file\)/)
    expect(us).toMatch(/update\(\{ photo_path: path \}\)/)
    expect(read('src/components/Avatar.tsx')).toMatch(/PhotoImg path={photoPath}/) // the small copy, with the big photo as a fallback
  })
  it('signing in keeps working while the SQL is pending (the profile is read without the photo if the column is missing)', () => {
    expect(read('src/lib/auth.tsx')).toMatch(/42703/)
  })
})
