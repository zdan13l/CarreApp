import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useRealtimeReload } from '../../lib/realtime'
import { supabase } from '../../lib/supabase'
import type { EventRow } from '../../types'
import { AdminContext, type AdminCtx, type AdminMode } from './AdminContext'
import ConnectionBanner from '../../components/ConnectionBanner'
import AdminNav, { AdminTopbar } from './AdminNav'
import { confirmDialog } from '../../lib/dialog'

// Adaptive shell: side menu on computers, bottom tabs on phones.
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [chosen, setChosen] = useState<AdminMode | null>(null) // what the coordinator picked; null = follow the Carrera
  const navigate = useNavigate()

  const reload = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('events')
      .select('id, name, is_active, max_travel_minutes')
      .order('created_at', { ascending: false })
    setEvents(data ?? [])
  }, [])

  useEffect(() => {
    void reload().finally(() => setLoading(false))
  }, [reload])

  // another coordinator session (or a restored connection) can activate / deactivate a Carrera
  useRealtimeReload(['events'], reload)

  const askSignOut = async () => {
    if (await confirmDialog({ title: '¿Cerrar sesión?', confirmLabel: 'Cerrar sesión', icon: 'logout' })) void signOut()
  }

  // Panel mode: while a Carrera is running the panel shows what is happening (En carrera); otherwise it is where the
  // Carrera is created (Preparación). Starting or ending a Carrera moves the panel to the right mode by itself.
  const running = events.some((e) => e.is_active)
  const mode: AdminMode = chosen ?? (running ? 'live' : 'setup')
  const lastRunning = useRef<boolean | null>(null)
  useEffect(() => {
    if (loading) return
    if (lastRunning.current !== null && lastRunning.current !== running) {
      setChosen(null)
      navigate(running ? '/admin' : '/admin/carrera')
    }
    lastRunning.current = running
  }, [running, loading, navigate])
  const setMode = useCallback(
    (m: AdminMode) => {
      setChosen(m)
      navigate(m === 'live' ? '/admin' : '/admin/carrera')
    },
    [navigate],
  )

  const event = events.find((e) => e.id === selectedId) ?? events.find((e) => e.is_active) ?? events[0] ?? null

  const ctx = useMemo<AdminCtx>(
    () => ({ events, event, mode, running, setMode, selectEvent: setSelectedId, reload }),
    [events, event, mode, running, setMode, reload],
  )

  return (
    <div className="admin tower">
      <AdminNav eventName={event?.name} eventActive={event?.is_active} mode={mode} running={running} onMode={setMode} user={profile ?? undefined} onSignOut={askSignOut} />
      <main className="admin-main">
        <ConnectionBanner />
        <AdminTopbar user={profile ?? undefined} onSignOut={askSignOut} />
        {loading ? <p className="loading">Cargando…</p> : (
          <AdminContext.Provider value={ctx}>
            {mode === 'setup' && running && (
              <div className="warn running-note">
                <strong>La Carrera está en curso.</strong> Los cambios de Preparación se ven al instante en los teléfonos.{' '}
                <button className="ghost" onClick={() => setMode('live')}>Volver a En carrera</button>
              </div>
            )}
            <Outlet />
          </AdminContext.Provider>
        )}
      </main>
    </div>
  )
}
