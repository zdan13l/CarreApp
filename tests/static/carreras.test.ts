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
