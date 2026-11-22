import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCORE_ITEMS } from '../../src/types'

const read = (p: string) => readFileSync(p, 'utf-8')
const base = read('src/pages/BaseHome.tsx')

describe('the base screen', () => {
  it('stages are played and scored minijuego, then pregunta, then barra', () => {
    expect(SCORE_ITEMS).toEqual(['minijuego', 'pregunta', 'barra'])
  })

  it('hurrying the groups only asks to confirm: a fixed message, no text box and no explanation of the phone ringing', () => {
    expect(base).toMatch(/title: '¿Apurar a los grupos\?'/)
    expect(base).toMatch(/const HURRY_MESSAGE = /)
    expect(base).not.toMatch(/promptDialog/)
    expect(base).not.toMatch(/les suena el teléfono|Les llega como notificación/i)
  })

  it('does not explain the arrival button with a paragraph', () => {
    expect(base).not.toMatch(/Cuando estén los dos grupos en tu base/)
  })

  it('every pop-up of the screen is a confirmDialog with a question title and a confirm label', () => {
    const dialogs = [...base.matchAll(/confirmDialog\(\{ title: ('[^']*'|`[^`]*`)[^}]*confirmLabel: '[^']+'/g)]
    expect(dialogs.length).toBeGreaterThanOrEqual(4) // hurry, arrival, results, rotation
    for (const d of dialogs) expect(d[1]).toMatch(/^.[¿]/)
  })

  it('after scoring a match the base sees the rotation card and confirms it let the groups go (migration 0029)', () => {
    expect(base).toMatch(/<RotationCard/)
    expect(base).toMatch(/from\('rotation_acks'\)\.insert/)
    expect(base).toMatch(/Ya los dejé ir/)
    expect(read('src/components/RotationPanel.tsx')).toMatch(/from\('round_rotations'\)\.insert/)
    expect(read('src/pages/admin/EnVivo.tsx')).toMatch(/<RotationPanel/)
  })

  it('Resultados opens the photo of a team big, and Mi base has the seal of the base with its story', () => {
    expect(base).toMatch(/onSelect=\{setViewTeam\}/)
    expect(base).toMatch(/<TeamDialog/)
    expect(base).toMatch(/<BaseSealCard/)
    expect(read('src/components/BaseSealCard.tsx')).toMatch(/seal\.story/)
  })

  it('keeps the golden circle around the photo of the person', () => {
    expect(read('src/index.css')).toMatch(/\.account-photo \{ background: var\(--foil\);/)
})

  it('the seal box has no explanatory sentences', () => {
    const card = read('src/components/BaseSealCard.tsx')
    expect(card).not.toMatch(/Toca el sello/)
    expect(card).not.toMatch(/recibe cada grupo en su pasaporte/)
  })

  it('shows the answer under each possible question, and the coordinator edits at least 5 with their answer (0030)', () => {
    expect(base).toMatch(/q\.answer\?\.trim\(\)/)
    expect(base).toMatch(/base_questions\(position, question, answer\)/)
    const bases = read('src/pages/admin/Bases.tsx')
    expect(bases).toMatch(/MIN_QUESTIONS/)
    expect(bases).toMatch(/aria-label=\{`Respuesta a la pregunta \$\{i \+ 1\}`\}/)
    expect(read('src/types.ts')).toMatch(/export const MIN_QUESTIONS = 5/)
  })
})
