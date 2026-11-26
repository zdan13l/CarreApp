// The generations are chosen, never typed, and their seals are edited in ONE place (Administración global → Generaciones).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { rootPath } from './helpers'

const read = (p: string) => fs.readFileSync(rootPath(p), 'utf8')

describe('generations', () => {
  it('have their own global page, in the menu and the routes; their seals are made in the workshop', () => {
    expect(read('src/App.tsx')).toMatch(/path="generaciones" element=\{<Generaciones \/>\}/)
    expect(read('src/pages/admin/AdminNav.tsx')).toContain("'/admin/generaciones'")
    const page = read('src/pages/admin/Generaciones.tsx')
    expect(page).toMatch(/from\('generations'\)/)
    expect(page).toMatch(/workshopLink\('generation'/) // the seal is changed in the workshop, not here
    expect(page).not.toMatch(/saveGenerationSeal|pictureToInk|type="file"/)
    const workshop = read('src/pages/admin/Sellos.tsx')
    expect(workshop).toMatch(/Volver al de siempre/) // the seal of always can be restored
    expect(workshop).toMatch(/loadCatalog\(\)/) // the passports read the new seal at once
  })
  it('are never typed: the person forms use the selector of the catalog (and the Excel is validated against it)', () => {
    for (const f of ['src/components/NewInductorForm.tsx', 'src/components/PersonEditor.tsx', 'src/components/InductorsBulk.tsx']) {
      const src = read(f)
      expect(src).toMatch(/<GenerationPicker /)
      expect(src).not.toMatch(/name="generation" maxLength/)
      expect(src).not.toMatch(/placeholder="Generación"/)
    }
    expect(read('src/pages/admin/Inductores.tsx')).not.toMatch(/placeholder="Generación"/)
    expect(read('src/lib/inductors.ts')).toMatch(/generación «\$\{generation\}» no existe/)
  })
  it('the catalog is read at sign-in and the passport and the PDF draw the edited seal', () => {
    expect(read('src/lib/catalog.ts')).toMatch(/from\('generations'\)/)
    expect(read('src/components/MemberPassport.tsx')).toMatch(/sealedGenerationsOf/)
    expect(read('src/lib/passportPdf.ts')).toMatch(/generationPicture/) // the PDF embeds the picture the coordi uploaded
  })
  it('the seal of a generation is saved only by the workshop; the person forms never touch the catalog', () => {
    for (const f of ['Inductores', 'CarreraInductores', 'Generaciones']) expect(read(`src/pages/admin/${f}.tsx`)).not.toMatch(/saveGenerationSeal/)
    for (const f of ['Inductores', 'CarreraInductores', 'Sellos']) expect(read(`src/pages/admin/${f}.tsx`)).not.toMatch(/from\('generations'\)/)
  })
})
