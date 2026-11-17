// Users per Carrera (0014) and Carrera switching, checked in the client code the way a reviewer would:
// every screen that lists, picks or creates users has to stay inside the Carrera being worked on.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('users are scoped to the Carrera on every screen', () => {
  it('Grupos and Bases only offer the runners / inductors of the selected Carrera', () => {
    expect(read('src/pages/admin/Grupos.tsx')).toMatch(/from\('profiles'\)[^\n]*\.eq\('role', 'runner'\)\.eq\('event_id', eventId\)/)
    expect(read('src/pages/admin/Bases.tsx')).toMatch(/from\('profiles'\)[^\n]*\.eq\('role', 'base'\)\.eq\('event_id', eventId\)/)
  })

  it('Usuarios lists the Carrera users (plus admins), keeps the people without Carrera apart and creates with the Carrera', () => {
    const text = read('src/pages/admin/Usuarios.tsx')
    expect(text).toMatch(/u\.role === 'admin' \|\| u\.event_id === eventId/)
    expect(text).toMatch(/orphans = users\.filter\(\(u\) => u\.role !== 'admin' && !u\.event_id\)/)
    expect(text).toMatch(/event_id: role === 'admin' \? null : eventId/)
  })

  it('BulkImport creates every person inside the Carrera being loaded', () => {
    expect(read('src/pages/admin/BulkImport.tsx')).toMatch(/createUser\(\{[^}]*event_id: eventId/)
  })

  it('the users API only stores a Carrera for runners and inductors, never for the coordinator', () => {
    expect(read('api/users.ts')).toMatch(/role === 'admin' \|\| !body\.event_id \? null/)
  })
})

describe('switching or deactivating a Carrera reaches the phones', () => {
  it.each(['src/pages/RunnerHome.tsx', 'src/pages/BaseHome.tsx'])('%s reloads on events and asks only for the ACTIVE Carrera', (file) => {
    const text = read(file)
    expect(text).toMatch(/useRealtimeReload\(\[[^\]]*'events'[^\]]*\]/)
    expect(text).toMatch(/\.eq\('events\.is_active', true\)/)
  })
})

describe('the score log belongs to the selected Carrera', () => {
  it('Puntajes asks the server for the audit rows of the selected Carrera only', () => {
    const text = read('src/pages/admin/Puntajes.tsx')
    expect(text).toMatch(/from\('score_audit'\)\.select\('\*'\)\.eq\('event_id', eventId\)/)
    expect(text).toMatch(/from\('matches'\)[\s\S]*?\.eq\('event_id', eventId\)/)
  })
})

describe('Carrera switching reaches every screen without a reload', () => {
  it('the coordinator layout listens to events', () => {
    expect(read('src/pages/admin/AdminLayout.tsx')).toMatch(/useRealtimeReload\(\['events'\], reload\)/)
  })
  it('runner and base keep what is on screen when the request fails (a network error is not "no active Carrera")', () => {
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/if \(teamErr\) return/)
    expect(read('src/pages/BaseHome.tsx')).toMatch(/if \(baseErr\) return/)
  })
  it('a taken username explains that usernames are shared by all Carreras', () => {
    expect(read('api/users.ts')).toMatch(/únicos en todas las Carreras/)
    expect(read('src/lib/bulk.ts')).toMatch(/únicos en todas las Carreras/)
  })
})

describe('resilience of the screens (third QA run)', () => {
  it('the delay alerts use the server clock, not the phone clock', () => {
    expect(read('src/lib/alerts.ts')).toMatch(/serverNow\(\)/)
    expect(read('src/pages/admin/Mapa.tsx')).toMatch(/serverNow\(\)/)
    expect(read('src/lib/clock.ts')).toMatch(/rpc\('server_now'\)/)
  })
  it('GPS positions reload on their own, without reloading the whole coordinator screen', () => {
    for (const f of ['src/pages/admin/EnVivo.tsx', 'src/pages/admin/Mapa.tsx']) {
      const t = read(f)
      expect(t).toMatch(/useRealtimeReload\(\['team_locations'\], loadPositions\)/)
      expect(t).not.toMatch(/useRealtimeReload\(\[[^\]]*'team_locations'[^\]]*,[^\]]*\], load\)/)
    }
  })
  it('phones spread their reloads (jitter), and every shell shows the offline banner', () => {
    expect(read('src/pages/RunnerHome.tsx')).toMatch(/load, 1500\)/)
    expect(read('src/pages/BaseHome.tsx')).toMatch(/load, 1500\)/)
    expect(read('src/components/AppShell.tsx')).toMatch(/<ConnectionBanner/)
    expect(read('src/pages/admin/AdminLayout.tsx')).toMatch(/<ConnectionBanner/)
  })
  it('signing out asks first and removes the push subscription of the phone', () => {
    expect(read('src/components/AppShell.tsx')).toMatch(/confirmDialog\(\{ title: '¿Cerrar sesión\?'/)
    expect(read('src/pages/admin/AdminLayout.tsx')).toMatch(/confirmDialog\(\{ title: '¿Cerrar sesión\?'/)
    expect(read('src/lib/auth.tsx')).toMatch(/disablePush\(\)/)
  })
  it('changing or deleting a score asks first; the push secret is compared in constant time', () => {
    expect(read('src/pages/admin/Puntajes.tsx')).toMatch(/confirmDialog\(\{ title: `\$\{ITEM_LABEL\[item\]\}/)
    expect(read('api/push.ts')).toMatch(/timingSafeEqual/)
  })
  it('the text is never smaller than 12px', () => {
    const css = read('src/index.css')
    for (const m of css.matchAll(/font-size:\s*([0-9.]+)(rem|px)/g)) {
      const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1])
      expect(px, `font-size ${m[0]}`).toBeGreaterThanOrEqual(12)
    }
  })
})

describe('deleting a Carrera', () => {
  it('only a deactivated Carrera can be deleted, after typing its name; users are listed before the cascade', () => {
    const t = read('src/pages/admin/Carrera.tsx')
    expect(t).toMatch(/function DeleteEvent/)
    expect(t).toMatch(/if \(!supabase \|\| !matches \|\| active\) return/)
    expect(t.indexOf("from('profiles').select('id').eq('event_id', eventId)")).toBeLessThan(t.indexOf("from('events').delete()"))
  })
})
