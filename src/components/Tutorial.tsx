import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface TutorialStep {
  title: string
  body: string
  tab?: string // the tab to open for this step (the screen switches by itself)
  target?: string // CSS selector of what to point at; without it (or when it is not on screen) the card is centred
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

// A guided tour of a screen: one card per step, with the pointed element lit up and the rest dimmed. It only explains: nothing under it
// can be tapped while it is open. Used by the bases and the runners while the Carrera is Habilitada (buttons off).
export default function Tutorial({ steps, onTab, onClose }: { steps: TutorialStep[]; onTab?: (tab: string) => void; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = steps[i]
  const last = i === steps.length - 1
  const tabRef = useRef(onTab)
  useEffect(() => {
    tabRef.current = onTab
  })

  // light up the target of the step (and follow it if the page moves or resizes)
  const measure = useCallback(() => {
    const el = step?.target ? document.querySelector(step.target) : null
    if (!el) return setBox(null)
    const r = el.getBoundingClientRect()
    setBox(r.width === 0 && r.height === 0 ? null : { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 })
  }, [step])

  useEffect(() => {
    if (step?.tab) tabRef.current?.(step.tab)
    // wait a moment for the tab to paint, then bring the target into view
    const t = window.setTimeout(() => {
      const el = step?.target ? document.querySelector(step.target) : null
      el?.scrollIntoView({ block: 'center', behavior: 'auto' })
      measure()
    }, 120)
    return () => window.clearTimeout(t)
  }, [step, measure])

  useLayoutEffect(() => {
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!step) return null
  // the card sits on the opposite side of the lit element, so it never covers it
  const cardOnTop = box !== null && box.top + box.height / 2 > window.innerHeight * 0.5
  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tutorial">
      {box ? <div className="tour-hole" style={box} aria-hidden="true" /> : <div className="tour-dim" aria-hidden="true" />}
      <section className={`tour-card${cardOnTop ? ' on-top' : ''}${box ? '' : ' centred'}`}>
        <button type="button" className="ghost icon-btn sheet-x" onClick={onClose} aria-label="Cerrar tutorial" title="Cerrar tutorial">
          <X size={18} />
        </button>
        <p className="tour-count mono">Paso {i + 1} de {steps.length}</p>
        <h2>{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, n) => (
            <span key={n} className={n === i ? 'on' : n < i ? 'seen' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          <button type="button" className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
          <button type="button" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Terminar' : 'Siguiente'}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
