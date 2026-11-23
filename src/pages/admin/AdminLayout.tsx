import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useRealtimeReload } from '../../lib/realtime'
import { supabase } from '../../lib/supabase'
import type { EventRow } from '../../types'
import { AdminContext, type AdminCtx } from './AdminContext'
import ConnectionBanner from '../../components/ConnectionBanner'
import AdminNav, { AdminTopbar } from './AdminNav'
import { confirmDialog } from '../../lib/dialog'

// Adaptive shell: side menu on computers, bottom tabs on phones. The carrera that is open comes from the address (/admin/carreras/<id>/…),
// so a link always says which edition it is about; outside a carrera the context falls back to the one that is running.
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const inCarrera = useMatch('/admin/carreras/:eventId/*')
  const openId = inCarrera?.params.eventId ?? null

  const reload = useCallback(async () => {
    if (!supabase) return
    let { data, error } = await supabase
      .from('events')
      .select('id, name, code, is_test, term_id, coordinator_id, is_active, phase, started_at, max_travel_minutes')
      .order('created_at', { ascending: false })
    if (error) {
      // migration 0037 (term_id / coordinator_id) is not applied yet: the panel keeps working without them
      ;({ data, error } = (await supabase
        .from('events')
        .select('id, name, code, is_test, is_active, phase, started_at, max_travel_minutes')
        .order('created_at', { ascending: false })) as unknown as typeof supabase extends never ? never : { data: typeof data; error: typeof error })
    }
    setEvents((data ?? []) as unknown as EventRow[])
  }, [])

  useEffect(() => {
    void reload().finally(() => setLoading(false))
  }, [reload])

  // another coordinator session (or a restored connection) can change the state of a carrera
  useRealtimeReload(['events'], reload)

  const askSignOut = async () => {
    if (await confirmDialog({ title: '¿Cerrar sesión?', confirmLabel: 'Cerrar sesión', icon: 'logout' })) void signOut()
  }

  const running = events.some((e) => e.is_active)
  const opened = openId ? (events.find((e) => e.id === openId) ?? null) : null
  const event = opened ?? events.find((e) => e.is_active) ?? events[0] ?? null

  const ctx = useMemo<AdminCtx>(
    () => ({
      events,
      event,
      mode: running ? 'live' : 'setup',
      running,
      setMode: (m) => event && navigate(m === 'live' ? `/admin/carreras/${event.id}` : `/admin/carreras/${event.id}/configuracion`),
      selectEvent: (id) => navigate(`/admin/carreras/${id}`),
      reload,
    }),
    [events, event, running, navigate, reload],
  )

  return (
    <div className="admin tower">
      <AdminNav event={opened} user={profile ?? undefined} onSignOut={askSignOut} />
      <main className="admin-main">
        <ConnectionBanner />
        <AdminTopbar user={profile ?? undefined} onSignOut={askSignOut} />
        {loading ? (
          <p className="loading">Cargando…</p>
        ) : (
          <AdminContext.Provider value={ctx}>
            <Outlet />
          </AdminContext.Provider>
        )}
      </main>
    </div>
  )
}
