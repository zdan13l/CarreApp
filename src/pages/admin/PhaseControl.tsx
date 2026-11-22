import { Check } from 'lucide-react'
import { useState } from 'react'
import { confirmDialog } from '../../lib/dialog'
import { PHASE_HINT, PHASE_LABEL, PHASE_ORDER } from '../../lib/phase'
import { exportResults } from '../../lib/results'
import { supabase } from '../../lib/supabase'
import type { EventPhase, EventRow } from '../../types'

type Action = 'enable' | 'start' | 'finish' | 'disable' | 'reset'

// The coordinator's control of the Carrera: Deshabilitada -> Habilitada -> Iniciada -> Terminada. Every move goes through the
// `event_action` function of the database, which knows which moves are allowed (see migration 0032).
export default function PhaseControl({
  event,
  canEnable = true,
  onChanged,
}: {
  event: EventRow
  canEnable?: boolean // false while the checklist still has pending items (the database checks it too)
  onChanged: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phase: EventPhase = event.phase

  async function run(action: Action) {
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('event_action', { p_event: event.id, p_action: action })
    if (err) setError(err.message || 'No se pudo cambiar el estado de la Carrera.')
    await onChanged()
    setBusy(false)
  }

  async function ask(action: Action) {
    const name = `"${event.name}"`
    if (action === 'enable') {
      if (!(await confirmDialog({ title: `¿Habilitar ${name}?`, message: 'Los corredores y las bases la verán de inmediato, con los botones desactivados, y podrán recorrer el tutorial. El tiempo no corre hasta que la inicies.', confirmLabel: 'Habilitar Carrera', icon: 'check' }))) return
    } else if (action === 'start') {
      if (!(await confirmDialog({ title: `¿Iniciar ${name}?`, message: 'Empieza a correr el tiempo y se activan los botones de las bases.', confirmLabel: 'Iniciar Carrera', icon: 'check' }))) return
    } else if (action === 'finish') {
      if (!(await confirmDialog({ title: `¿Terminar ${name}?`, message: 'Los botones de las bases se bloquean otra vez. Podrás validar los puntajes, el top y todo, y corregir lo que haga falta.', confirmLabel: 'Terminar Carrera', tone: 'danger', icon: 'warning' }))) return
    } else if (action === 'reset') {
      if (!(await confirmDialog({ title: `¿Reiniciar ${name}?`, message: 'Se borran puntajes, llegadas, avisos, ubicaciones, rotaciones y registro de cambios, SIN pasar al Historial. La Carrera queda Habilitada, a la espera de que la inicies. Úsalo para las pruebas.', confirmLabel: 'Reiniciar', tone: 'danger', icon: 'warning' }))) return
    } else if (phase === 'finished') {
      // disabling a finished Carrera saves it in the Historial and erases its progress: keep a copy of the results first
      if (!(await confirmDialog({ title: `¿Deshabilitar ${name}?`, message: 'Pasa al Historial y se REINICIA todo su avance: puntajes, llegadas, avisos, ubicaciones y registro de cambios. Se conservan grupos, bases, usuarios y el cronograma. Los teléfonos dejan de verla. Antes se descargan los resultados.', confirmLabel: 'Descargar y deshabilitar', tone: 'danger', icon: 'warning' }))) return
      const saved = await exportResults(event.id, event.name)
      if (!saved && !(await confirmDialog({ title: 'No se pudieron descargar los resultados', message: 'Si sigues, el avance se borra sin la copia en archivo (el Historial sí la guarda). ¿Continuar de todos modos?', confirmLabel: 'Continuar sin copia', tone: 'danger', icon: 'warning' }))) return
    } else if (!(await confirmDialog({ title: `¿Deshabilitar ${name}?`, message: 'Los teléfonos dejan de verla. Se conservan grupos, bases, usuarios y el cronograma.', confirmLabel: 'Deshabilitar', tone: 'danger', icon: 'warning' }))) return
    await run(action)
  }

  const at = PHASE_ORDER.indexOf(phase)
  return (
    <section className="card phase-control" aria-label="Estado de la Carrera">
      <p className="eyebrow">Estado de la Carrera</p>
      <ol className="phase-steps">
        {PHASE_ORDER.map((p, i) => (
          <li key={p} className={i < at ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}>
            <span className="phase-dot" aria-hidden="true">{i < at ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ol>
      <p className="muted">{PHASE_HINT[phase]}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        {phase === 'disabled' && <button disabled={busy || !canEnable} onClick={() => void ask('enable')}>Habilitar Carrera</button>}
        {phase === 'enabled' && <button disabled={busy} onClick={() => void ask('start')}>Iniciar Carrera</button>}
        {phase === 'started' && <button className="ghost danger" disabled={busy} onClick={() => void ask('finish')}>Terminar Carrera</button>}
        {phase === 'finished' && <button className="ghost" disabled={busy} onClick={() => void ask('reset')}>Reiniciar</button>}
        {(phase === 'enabled' || phase === 'finished') && <button className="ghost danger" disabled={busy} onClick={() => void ask('disable')}>Deshabilitar</button>}
      </div>
      {phase === 'finished' && <p className="muted">Reiniciar la deja Habilitada para otra prueba. Deshabilitar la pasa al Historial.</p>}
    </section>
  )
}
