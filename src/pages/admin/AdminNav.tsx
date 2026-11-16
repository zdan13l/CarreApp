import { Flag, KeyRound, LayoutDashboard, LogOut, Map, MapPin, Swords, Trophy, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from '../../components/Logo'

const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const

const TABS: { to: string; label: string; icon: ReactNode; end: boolean }[] = [
  { to: '/admin', label: 'Resumen', icon: <LayoutDashboard {...ICON} />, end: true },
  { to: '/admin/grupos', label: 'Grupos', icon: <Users {...ICON} />, end: false },
  { to: '/admin/bases', label: 'Bases', icon: <MapPin {...ICON} />, end: false },
  { to: '/admin/cruces', label: 'Cruces', icon: <Swords {...ICON} />, end: false },
  { to: '/admin/puntajes', label: 'Puntajes', icon: <Trophy {...ICON} />, end: false },
  { to: '/admin/mapa', label: 'Mapa', icon: <Map {...ICON} />, end: false },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <KeyRound {...ICON} />, end: false },
]

// Brand and sign-out for phones (the side menu has them on computers).
export function AdminTopbar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="topbar admin-topbar">
      <Logo size={30} />
      <button className="ghost icon-btn" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut size={20} />
      </button>
    </header>
  )
}

// Side menu on computers, bottom tab bar on phones (the CSS decides).
export default function AdminNav({
  eventName,
  user,
  onSignOut,
}: {
  eventName?: string
  user?: { full_name: string; username: string }
  onSignOut: () => void
}) {
  return (
    <aside className="admin-nav">
      <div className="admin-brand">
        <Logo size={34} />
        <p className="event">
          <Flag size={15} aria-hidden="true" />
          <strong>{eventName ?? 'Sin Carrera'}</strong>
        </p>
      </div>
      <nav aria-label="Secciones del panel">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            {t.icon}
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="admin-user">
        <div>
          <strong>{user?.full_name}</strong>
          <small className="muted">@{user?.username}</small>
        </div>
        <button className="ghost icon-btn" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  )
}
