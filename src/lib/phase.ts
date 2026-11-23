import type { EventPhase } from '../types'

// The four states of a Carrera, as the coordinator names them.
export const PHASE_LABEL: Record<EventPhase, string> = {
  disabled: 'Deshabilitada',
  enabled: 'Habilitada',
  started: 'Iniciada',
  finished: 'Terminada',
  archived: 'Finalizada',
}

export const PHASE_ORDER: EventPhase[] = ['disabled', 'enabled', 'started', 'finished', 'archived']

// What each state means, in one line.
export const PHASE_HINT: Record<EventPhase, string> = {
  disabled: 'Nadie la ve. Es la etapa de configuración: aquí se cambian grupos, bases, cruces y variables.',
  enabled: 'Lista pero sin actividad: las bases y los corredores ven las pantallas y el tutorial, con los botones desactivados.',
  started: 'Corre el tiempo y las bases pueden registrar llegadas, puntajes y avisos.',
  finished: 'Las bases quedan bloqueadas. Valida los puntajes y el top; luego finalízala (pasa al historial con todos sus datos) o reiníciala para otra prueba.',
  archived: 'Cerrada: está en el historial con todos sus datos. Puedes consultarla o reabrirla.',
}

// Bases only act while the Carrera is Iniciada (the database enforces it with `staff_can_act`).
export const canAct = (phase: EventPhase) => phase === 'started'
