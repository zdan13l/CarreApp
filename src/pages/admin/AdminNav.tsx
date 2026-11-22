import { Contact, Flag, History, KeyRound, MapPin, Radar, ShieldCheck, SlidersHorizontal, Swords, TowerControl, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import AccountMenu from '../../components/AccountMenu'
import Logo from '../../components/Logo'
import TowerClock from '../../components/TowerClock'
import type { AdminMode } from './AdminContext'

const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

// What the coordinator watches and acts on while the Carrera is running…
export const LIVE_TABS: NavItem[] = [
  { to: '/admin', label: 'Control', icon: <TowerControl {...ICON} />, end: true },
  { to: '/admin/puntajes', label: 'Pasaportes', icon: <ShieldCheck {...ICON} /> },
  { to: '/admin/mapa', label: 'Radar', icon: <Radar {...ICON} /> },
]
// …and what is set up beforehand (and corrected now and then).
export const SETUP_TABS: NavItem[] = [
  { to: '/admin/carrera', label: 'Carrera', icon: <Flag {...ICON} /> },
  { to: '/admin/grupos', label: 'Grupos', icon: <Users {...ICON} /> },
  { to: '/admin/bases', label: 'Bases', icon: <MapPin {...ICON} /> },
  { to: '/admin/cruces', label: 'Cruces', icon: <Swords {...ICON} /> },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <KeyRound {...ICON} /> },
  { to: '/admin/inductores', label: 'Inductores', icon: <Contact {...ICON} /> },
  { to: '/admin/historial', label: 'Historial', icon: <History {...ICON} /> },
]

// Brand and sign-out for phones (the side menu has them on computers).
export function AdminTopbar({ user, onSignOut }: { user?: { full_name: string; username: string; photo_path?: string | null }; onSignOut: () => void }) {
  return (
    <header className="topbar admin-topbar">
      <Logo size={30} />
      <AccountMenu user={user} onSignOut={onSignOut} roleLabel="Coordinador" showTheme={false} />
    </header>
  )
}

// Computers: a side menu with two modes. "Preparación" is where the Carrera is created and everything is set (users, groups,
// bases, schedule); "En carrera" is what the coordinator watches while it runs, with nothing to create. Phones: a bottom bar
// with the live screens and a "Preparar" button that opens the setup screens (seven tabs do not fit on a phone).
export default function AdminNav({
  eventName,
  eventActive = false,
  mode = 'live',
  running = false,
  onMode,
  user,
  onSignOut,
}: {
  eventName?: string
  eventActive?: boolean
  mode?: AdminMode
  running?: boolean
  onMode?: (mode: AdminMode) => void
  user?: { full_name: string; username: string; photo_path?: string | null }
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const inSetup = SETUP_TABS.some((t) => pathname.startsWith(t.to))

  const link = (t: NavItem, onClick?: () => void) => (
    <NavLink key={t.to} to={t.to} end={t.end} className="tab" onClick={onClick} viewTransition>
      {t.icon}
      <span>{t.label}</span>
    </NavLink>
  )

  return (
    <aside className={`admin-nav${open ? ' sheet-open' : ''}`}>
      <div className="admin-brand">
        <Logo size={46} />
        <p className="doc-kicker office">Torre de control · Control tower</p>
        <p className="event">
          <Flag size={15} aria-hidden="true" />
          <strong>{eventName ?? 'Sin Carrera'}</strong>
          {eventName && <span className={`badge ${eventActive ? 'ok live' : ''}`}>{eventActive ? 'En curso' : 'Borrador'}</span>}
        </p>
        <p className="tower-hour">
          <small>Hora local</small>
          <TowerClock />
        </p>
        <div className="mode-switch" role="tablist" aria-label="Modo del panel">
          <button type="button" role="tab" aria-selected={mode === 'setup'} className="mode" onClick={() => onMode?.('setup')}>
            Preparación
          </button>
          <button type="button" role="tab" aria-selected={mode === 'live'} className="mode" onClick={() => onMode?.('live')}>
            {running && <span className="live-dot" aria-hidden="true" />}
            En carrera
          </button>
        </div>
      </div>

      <nav className="nav-desktop" aria-label="Secciones del panel">
        <p className="nav-label">{mode === 'live' ? 'En carrera' : 'Crear la Carrera'}</p>
        {(mode === 'live' ? LIVE_TABS : SETUP_TABS).map((t) => link(t))}
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
        <AccountMenu user={user} onSignOut={onSignOut} placement="up" roleLabel="Coordinador" showTheme={false} />
      </div>
    </aside>
  )
}
