import { createContext, useContext } from 'react'
import type { EventRow } from '../../types'

export type AdminMode = 'setup' | 'live'

export interface AdminCtx {
  mode: AdminMode // Preparación (creating the Carrera) or En carrera (watching it run)
  running: boolean // some Carrera is active
  setMode: (mode: AdminMode) => void
  events: EventRow[]
  event: EventRow | null // Carrera currently being edited
  selectEvent: (id: string) => void
  reload: () => Promise<void>
}

export const AdminContext = createContext<AdminCtx | null>(null)

export function useAdmin(): AdminCtx {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside AdminLayout')
  return ctx
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error inesperado.'
}
