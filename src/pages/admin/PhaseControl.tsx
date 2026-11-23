import { Check } from 'lucide-react'
import { useState } from 'react'
import { confirmDialog } from '../../lib/dialog'
import { PHASE_HINT, PHASE_LABEL, PHASE_ORDER } from '../../lib/phase'
import { exportResults } from '../../lib/results'
import { supabase } from '../../lib/supabase'
import type { EventPhase, EventRow } from '../../types'

type Action = 'enable' | 'start' | 'finish' | 'archive' | 'reopen' | 'disable' | 'reset'

// What the coordi can do in each state (shown above the buttons, so it is always clear what is allowed now).
export const ALLOWED: Record<EventPhase, string> = {
  disabled: 'Configuración abierta: grupos, bases, cruces y variables se pueden cambiar.',
  enabled: 'Los usuarios entran pero no pueden actuar; la configuración sigue abierta con cuidado.',
  started: 'La carrera corre: las bases actúan. La configuración está protegida.',
  finished: 'Las bases están bloqueadas; solo el coordi corrige puntajes.',
  archived: 'Solo lectura: está en el historial.',
}

// The coordi's control of a Carrera: Deshabilitada -> Habilitada -> Iniciada -> Terminada -> Finalizada. Every move goes through the
// `event_action` function of the database, which knows which moves are allowed (migrations 0032 and 0036).
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
    if (err) setError(err.message || 'No se pudo cambiar el estado de la carrera.')
    await onChanged()
    setBusy(false)
  }

  async function ask(action: Action) {
    const name = `"${event.name}"`
    if (action === 'enable') {
      if (!(await confirmDialog({ title: `¿Habilitar ${name}?`, message: 'Los corredores y las bases la verán de inmediato, con los botones desactivados, y podrán recorrer el tutorial. El tiempo no corre hasta que la inicies.', confirmLabel: 'Habilitar carrera', icon: 'check' }))) return
    } else if (action === 'start') {
      if (!(await confirmDialog({ title: `¿Iniciar ${name}?`, message: 'Empieza a correr el tiempo y se activan los botones de las bases.', confirmLabel: 'Iniciar carrera', icon: 'check' }))) return
    } else if (action === 'finish') {
      if (!(await confirmDialog({ title: `¿Terminar ${name}?`, message: 'Los botones de las bases se bloquean otra vez. Podrás validar los puntajes, el top y todo, y corregir lo que haga falta.', confirmLabel: 'Terminar carrera', tone: 'danger', icon: 'warning' }))) return
    } else if (action === 'archive') {
      if (!(await confirmDialog({ title: `¿Finalizar ${name}?`, message: 'Se cierra y pasa al historial CON TODOS SUS DATOS (puntajes, cruces, llegadas). Deja de aparecer como carrera activa. Podrás consultarla y, si hace falta, reabrirla.', confirmLabel: 'Finalizar carrera', tone: 'danger', icon: 'warning' }))) return
    } else if (action === 'reopen') {
      if (!(await confirmDialog({ title: `¿Reabrir ${name}?`, message: 'Vuelve a Terminada, con todos sus datos.', confirmLabel: 'Reabrir', icon: 'question' }))) return
    } else if (action === 'reset') {
      if (!(await confirmDialog({ title: `¿Reiniciar ${name}?`, message: 'Se borra el AVANCE: puntajes, llegadas, avisos, ubicaciones, rotaciones y registro de cambios, sin pasar al historial. Se conservan grupos, bases, usuarios y cruces. La carrera queda Habilitada, a la espera de que la inicies.', confirmLabel: 'Reiniciar', tone: 'danger', icon: 'warning' }))) return
    } else if (phase === 'finished') {
      // going back to configuration saves a copy in the history and erases the progress: keep a file with the results first
      if (!(await confirmDialog({ title: `¿Deshabilitar ${name}?`, message: 'Vuelve a la configuración y se REINICIA su avance (queda una copia en el historial). Se conservan grupos, bases, usuarios y cruces. Los teléfonos dejan de verla. Antes se descargan los resultados.', confirmLabel: 'Descargar y deshabilitar', tone: 'danger', icon: 'warning' }))) return
      const saved = await exportResults(event.id, event.name)
      if (!saved && !(await confirmDialog({ title: 'No se pudieron descargar los resultados', message: 'Si sigues, el avance se borra sin la copia en archivo (el historial sí la guarda). ¿Continuar de todos modos?', confirmLabel: 'Continuar sin copia', tone: 'danger', icon: 'warning' }))) return
    } else if (!(await confirmDialog({ title: `¿Deshabilitar ${name}?`, message: 'Vuelve a la configuración: los teléfonos dejan de verla. Se conservan grupos, bases, usuarios y cruces.', confirmLabel: 'Deshabilitar', tone: 'danger', icon: 'warning' }))) return
    await run(action)
  }

  const at = PHASE_ORDER.indexOf(phase)
  const canRestart = event.is_test && (phase === 'enabled' || phase === 'started')
  return (
    <section className="card phase-control" aria-label="Estado de la carrera">
      <p className="eyebrow">Estado de la carrera</p>
      <ol className="phase-steps">
        {PHASE_ORDER.map((p, i) => (
          <li key={p} className={i < at ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}>
            <span className="phase-dot" aria-hidden="true">{i < at ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
            {PHASE_LABEL[p]}
          </li>
        ))}
      </ol>
      <p className="muted">{PHASE_HINT[phase]}</p>
      <p className="allowed"><strong>Ahora se puede:</strong> {ALLOWED[phase]}</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        {phase === 'disabled' && <button disabled={busy || !canEnable} onClick={() => void ask('enable')}>Habilitar carrera</button>}
        {phase === 'enabled' && <button disabled={busy} onClick={() => void ask('start')}>Iniciar carrera</button>}
        {phase === 'started' && <button className="ghost danger" disabled={busy} onClick={() => void ask('finish')}>Terminar carrera</button>}
        {(phase === 'finished' || canRestart) && <button className="ghost" disabled={busy} onClick={() => void ask('reset')}>Reiniciar</button>}
        {phase === 'finished' && <button disabled={busy} onClick={() => void ask('archive')}>Finalizar carrera</button>}
        {phase === 'archived' && <button disabled={busy} onClick={() => void ask('reopen')}>Reabrir</button>}
        {(phase === 'enabled' || phase === 'finished') && <button className="ghost danger" disabled={busy} onClick={() => void ask('disable')}>Deshabilitar</button>}
      </div>
      {phase === 'finished' && <p className="muted">Reiniciar la deja Habilitada para otra prueba. Finalizar la manda al historial con todos sus datos. Deshabilitar vuelve a la configuración.</p>}
    </section>
  )
}
