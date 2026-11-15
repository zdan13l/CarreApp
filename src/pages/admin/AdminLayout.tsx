import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { EventRow } from '../../types'
import { AdminContext, type AdminCtx } from './AdminContext'

const TABS = [
  { to: '/admin', label: 'Resumen', icon: '📋', end: true },
  { to: '/admin/grupos', label: 'Grupos', icon: '👥', end: false },
  { to: '/admin/bases', label: 'Bases', icon: '📍', end: false },
  { to: '/admin/cruces', label: 'Cruces', icon: '⚔️', end: false },
  { to: '/admin/puntajes', label: 'Puntajes', icon: '🏆', end: false },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '🔑', end: false },
]

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
      .select('id, name, is_active')
      .order('created_at', { ascending: false })
    setEvents(data ?? [])
  }, [])

  useEffect(() => {
    void reload().finally(() => setLoading(false))
  }, [reload])

  const event = events.find((e) => e.id === selectedId) ?? events.find((e) => e.is_active) ?? events[0] ?? null

  const ctx = useMemo<AdminCtx>(
    () => ({ events, event, selectEvent: setSelectedId, reload }),
    [events, event, reload],
  )

  return (
    <div className="admin">
      <aside className="admin-nav">
        <div className="admin-brand">
          <img src="/logo.png" alt="Logo de CarrerApp" className="logo-sm" />
          <div>
            <strong>CarrerApp</strong>
            <p className="muted">{event ? event.name : 'Sin Carrera'}</p>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className="tab">
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-user">
          <p className="muted">@{profile?.username}</p>
          <button className="ghost" onClick={signOut}>Salir</button>
        </div>
      </aside>
      <main className="admin-main">
        {loading ? <p className="muted">Cargando…</p> : (
          <AdminContext.Provider value={ctx}>
            <Outlet />
          </AdminContext.Provider>
        )}
      </main>
    </div>
  )
}
