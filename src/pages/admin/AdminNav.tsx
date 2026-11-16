import { Activity, Flag, KeyRound, LogOut, Map, MapPin, SlidersHorizontal, Swords, Trophy, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import ThemeToggle from '../../components/ThemeToggle'
import Logo from '../../components/Logo'

const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

// What the coordinator watches and acts on while the Carrera is running…
export const LIVE_TABS: NavItem[] = [
  { to: '/admin', label: 'En vivo', icon: <Activity {...ICON} />, end: true },
  { to: '/admin/puntajes', label: 'Puntajes', icon: <Trophy {...ICON} /> },
  { to: '/admin/mapa', label: 'Mapa', icon: <Map {...ICON} /> },
]
// …and what is set up beforehand (and corrected now and then).
export const SETUP_TABS: NavItem[] = [
  { to: '/admin/carrera', label: 'Carrera', icon: <Flag {...ICON} /> },
  { to: '/admin/grupos', label: 'Grupos', icon: <Users {...ICON} /> },
  { to: '/admin/bases', label: 'Bases', icon: <MapPin {...ICON} /> },
  { to: '/admin/cruces', label: 'Cruces', icon: <Swords {...ICON} /> },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <KeyRound {...ICON} /> },
]

// Brand and sign-out for phones (the side menu has them on computers).
export function AdminTopbar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="topbar admin-topbar">
      <Logo size={30} />
      <ThemeToggle />
      <button className="ghost icon-btn" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut size={20} />
      </button>
    </header>
  )
}

// Side menu in two groups on computers; on phones a bottom bar with the live screens and a
// "Preparar" button that opens the setup screens (seven tabs do not fit on a phone).
export default function AdminNav({
  eventName,
  user,
  onSignOut,
}: {
  eventName?: string
  user?: { full_name: string; username: string }
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const inSetup = SETUP_TABS.some((t) => pathname.startsWith(t.to))

  const link = (t: NavItem, onClick?: () => void) => (
    <NavLink key={t.to} to={t.to} end={t.end} className="tab" onClick={onClick}>
      {t.icon}
      <span>{t.label}</span>
    </NavLink>
  )

  return (
    <aside className="admin-nav">
      <div className="admin-brand">
        <Logo size={34} />
        <p className="event">
          <Flag size={15} aria-hidden="true" />
          <strong>{eventName ?? 'Sin Carrera'}</strong>
        </p>
      </div>

      <nav className="nav-desktop" aria-label="Secciones del panel">
        <p className="nav-label">Durante la Carrera</p>
        {LIVE_TABS.map((t) => link(t))}
        <p className="nav-label">Preparación</p>
        {SETUP_TABS.map((t) => link(t))}
      </nav>

      <nav className="nav-mobile" aria-label="Secciones del panel">
        {LIVE_TABS.map((t) => link(t, () => setOpen(false)))}
        <button
          type="button"
          className={`tab more${inSetup || open ? ' active' : ''}`}
          aria-expanded={open}
          aria-controls="setup-sheet"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal {...ICON} />
          <span>Preparar</span>
        </button>
      </nav>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="setup-sheet" id="setup-sheet">
            <p className="nav-label">Preparación de la Carrera</p>
            {SETUP_TABS.map((t) => link(t, () => setOpen(false)))}
          </div>
        </>
      )}

      <div className="admin-user">
        <div>
          <strong>{user?.full_name}</strong>
          <small className="muted">@{user?.username}</small>
        </div>
        <ThemeToggle />
        <button className="ghost icon-btn" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </div>
    </aside>
  )
}
