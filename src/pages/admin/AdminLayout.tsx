import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useRealtimeReload } from '../../lib/realtime'
import { supabase } from '../../lib/supabase'
import type { EventRow } from '../../types'
import { AdminContext, type AdminCtx } from './AdminContext'
import ConnectionBanner from '../../components/ConnectionBanner'
import AdminNav, { AdminTopbar } from './AdminNav'

// Adaptive shell: side menu on computers, bottom tabs on phones.
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  const askSignOut = () => {
    if (window.confirm('¿Cerrar sesión?')) void signOut()
  }

  const event = events.find((e) => e.id === selectedId) ?? events.find((e) => e.is_active) ?? events[0] ?? null

  const ctx = useMemo<AdminCtx>(
    () => ({ events, event, selectEvent: setSelectedId, reload }),
    [events, event, reload],
  )

  return (
    <div className="admin">
      <AdminNav eventName={event?.name} user={profile ?? undefined} onSignOut={askSignOut} />
      <main className="admin-main">
        <ConnectionBanner />
        <AdminTopbar onSignOut={askSignOut} />
        {loading ? <p className="loading">Cargando…</p> : (
          <AdminContext.Provider value={ctx}>
            <Outlet />
          </AdminContext.Provider>
        )}
      </main>
    </div>
  )
}
