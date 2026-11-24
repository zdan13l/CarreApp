// The generations are chosen, never typed, and their seals are edited in ONE place (Administración global → Generaciones).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('generations', () => {
  it('have their own global page, in the menu and the routes', () => {
    expect(read('src/App.tsx')).toMatch(/path="generaciones" element=\{<Generaciones \/>\}/)
    expect(read('src/pages/admin/AdminNav.tsx')).toContain("'/admin/generaciones'")
    const page = read('src/pages/admin/Generaciones.tsx')
    expect(page).toMatch(/from\('generations'\)/)
    expect(page).toMatch(/Volver al de siempre/) // the seal of always can be restored
    expect(page).toMatch(/loadCatalog\(\)/) // the passports read the new seal at once
  })
  it('are never typed: the person forms use the selector of the catalog (and the Excel is validated against it)', () => {
    const ind = read('src/pages/admin/Inductores.tsx')
    expect(ind).toMatch(/<GenerationPicker /)
    expect(ind).not.toMatch(/name="generation" maxLength/)
    expect(ind).not.toMatch(/placeholder="Generación"/)
    expect(read('src/lib/passports.ts')).toMatch(/La generación no existe/)
  })
  it('the catalog is read at sign-in and the passport and the PDF draw the edited seal', () => {
    expect(read('src/lib/catalog.ts')).toMatch(/from\('generations'\)/)
    expect(read('src/components/MemberPassport.tsx')).toMatch(/sealedGenerationsOf/)
    expect(read('src/lib/passportPdf.ts')).toMatch(/generationPicture/) // the PDF embeds the picture the coordi uploaded
  })
  it('the generations are created and edited only on their page (no seal of a generation is made anywhere else)', () => {
    for (const f of ['Inductores', 'Sellos', 'CarreraSellos', 'CarreraInductores']) expect(read(`src/pages/admin/${f}.tsx`)).not.toMatch(/from\('generations'\)/)
  })
})
