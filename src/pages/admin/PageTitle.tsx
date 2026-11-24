import type { ReactNode } from 'react'
import { CARRERA_TABS } from './AdminNav'

const STEPS = CARRERA_TABS.filter((t) => t.group === 'prep').length

// The tag of a Preparación step, like the gate tag of the base's counter: «PASO 3 de 8». It is the same number the side menu shows.
export function StepTag({ n }: { n: number }) {
  return (
    <span className="step-tag" role="note" aria-label={`Paso ${n} de ${STEPS} de la preparación`}>
      <small>Paso</small>
      <b>{n}</b>
      <span>de {STEPS}</span>
    </span>
  )
}

// The title of a screen that has no page header of its own: the heading, the step tag (Preparación only) and a line of gold foil under both.
export default function PageTitle({ children, step }: { children: ReactNode; step?: number }) {
  return (
    <div className="title-row">
      <h1>{children}</h1>
      {step ? <StepTag n={step} /> : null}
    </div>
  )
}
