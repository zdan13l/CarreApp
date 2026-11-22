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
    expect(base).toMatch(/'¿Apurar a este grupo\?' : '¿Apurar a los grupos\?'/)
    expect(base).toMatch(/const HURRY_MESSAGE = /)
    expect(base).not.toMatch(/promptDialog/)
    expect(base).not.toMatch(/les suena el teléfono|Les llega como notificación/i)
  })

  it('does not explain the arrival button with a paragraph', () => {
    expect(base).not.toMatch(/Cuando estén los dos grupos en tu base/)
  })

  it('every pop-up of the screen is a confirmDialog with a question title and a confirm label', () => {
    const dialogs = [...base.matchAll(/confirmDialog\(\{ title: ('[^']*'|`[^`]*`)[^}]*confirmLabel: '[^']+'/g)]
    expect(dialogs.length).toBeGreaterThanOrEqual(3) // arrival, results, rotation (the hurry one carries a warning, so it is written over several lines)
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

  it('the rotation card only appears once the three stages of the last match are scored', () => {
    expect(base).toMatch(/lastFinished\.match_scores\.length >= SCORE_ITEMS\.length/)
  })

  it('the location block: the saved note sits under "Cambiar ubicación" and the two helper texts are gone', () => {
    expect(base.indexOf('Cambiar ubicación</button>')).toBeLessThan(base.indexOf('Ubicación guardada en el mapa.'))
    expect(base).not.toMatch(/¿La base se movió/)
    const editor = read('src/components/BaseLocationEditor.tsx')
    expect(editor).not.toMatch(/Toca el mapa para mover el punto/)
    expect(editor).toMatch(/location-actions/) // the three buttons share one layout
    expect(base).toMatch(/onCancel=\{hasLocation/) // Cancelar lives with the other two
  })

  it('the name of the seal opens the big seal too', () => {
    const card = read('src/components/BaseSealCard.tsx')
    expect(card).toMatch(/className="seal-name-tap"[\s\S]*onClick=\{\(\) => setOpen\(true\)\}/)
  })

  it('a team row in Resultados never lights up gold while scrolling (no sticky hover on touch)', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/button\.team-row:hover:not\(:disabled\), button\.team-row:active:not\(:disabled\) \{ background: transparent/)
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{ button\.team-row:hover/)
  })

  it('hurrying: a clock per walking group with its origin, one button per group and one for both (0031)', () => {
    expect(base).toMatch(/<WalkingGroups/)
    expect(base).toMatch(/legInfo\(eventMatches, m\.id, m\.team_a/)
    expect(base).toMatch(/Viene de \$\{from \?\? 'otra base'\} · máximo \$\{info\.allowedMin\} min/)
    expect(base).toMatch(/Todavía les queda tiempo de traslado/) // hurrying before the time is up warns first
    expect(read('src/components/DelaysPanel.tsx')).toMatch(/team_id: teamId/)
    expect(read('src/lib/alerts.ts')).toMatch(/a\.team_id === teamId/) // the runner of the other group does not get it
  })

  it('Ronda is one thing at a time: clocks, then scoring, then only the rotation button, then the clocks again', () => {
    // 1) groups on their way: clock rows + hurry + arrival confirmation (no steps, no versus board)
    expect(base).toMatch(/\{!arrived \? \(\s*<>\s*<WalkingGroups/)
    // 2) arrived: only the stages to score
    expect(base).toMatch(/<DeskFlow arrived=\{arrived\}/)
    // 3) all scored: the rotation card is the whole tab (no match card, no next round); 4) once the groups are let go the next match shows its clock
    expect(base).toMatch(/rotationPending && lastFinished \? \(\s*<RotationCard/)
    expect(base).toMatch(/const rotationPending = showRotation && !\(rotation && rotated\.has\(rotation\.id\)\)/)
    expect(base).not.toMatch(/<NextRound/)
  })

  it('"Cancelar" of the location editor is red', () => {
    expect(read('src/components/BaseLocationEditor.tsx')).toMatch(/className="btn-danger"[^>]*onClick=\{onCancel\}/)
  })

  it('the yellow light of a team row follows a press, not a scroll', () => {
    const names = read('src/components/TeamNames.tsx')
    expect(names).toMatch(/onPointerCancel=\{release\}/) // the browser took the touch to scroll
    expect(names).toMatch(/onPointerMove/) // the finger moved
    expect(names).toMatch(/PRESS_DELAY_MS/)
    expect(read('src/index.css')).toMatch(/button\.team-row\[data-pressed='true'\] \{ background: color-mix\(in srgb, var\(--gold\)/)
  })
})
