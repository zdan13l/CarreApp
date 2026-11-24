import { Archive, Baby, Contact, Flag, GraduationCap, Palette, History, KeyRound, LayoutGrid, MapPin, Medal, Network, Radar, Settings2, ShieldCheck, Stamp, Swords, TowerControl, Users, Waypoints } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import AccountMenu from '../../components/AccountMenu'
import Logo from '../../components/Logo'
import TowerClock from '../../components/TowerClock'
import { PHASE_LABEL } from '../../lib/phase'
import type { EventPhase } from '../../types'

const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

// The panel has three levels. 1) Carreras: every edition, with its state. 2) Inside ONE carrera: only what belongs to that edition.
// 3) Global administration: what is shared by all the carreras (inductores, grupos de carreras, comités, generaciones with their seals, insignias, the library of seals).

/** What lives inside one carrera (the paths hang from /admin/carreras/<id>/). */
export const CARRERA_TABS: { path: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { path: '', label: 'Resumen y control', icon: <TowerControl {...ICON} />, end: true },
  { path: 'configuracion', label: 'Configuración', icon: <Settings2 {...ICON} /> },
  { path: 'tematica', label: 'Temática', icon: <Palette {...ICON} /> },
  { path: 'sellos', label: 'Sellos', icon: <Stamp {...ICON} /> },
  { path: 'grupos', label: 'Grupos participantes', icon: <Users {...ICON} /> },
  { path: 'bases', label: 'Bases', icon: <MapPin {...ICON} /> },
  { path: 'cruces', label: 'Cruces', icon: <Swords {...ICON} /> },
  { path: 'inductores', label: 'Inductores', icon: <Contact {...ICON} /> },
  { path: 'comites', label: 'Coordi y comités', icon: <Network {...ICON} /> },
  { path: 'usuarios', label: 'Usuarios', icon: <KeyRound {...ICON} /> },
  { path: 'puntajes', label: 'Puntajes', icon: <ShieldCheck {...ICON} /> },
  { path: 'mapa', label: 'Radar', icon: <Radar {...ICON} /> },
]

/** Shared by every carrera. */
export const GLOBAL_TABS: NavItem[] = [
  { to: '/admin/inductores', label: 'Inductores', icon: <Contact {...ICON} /> },
  { to: '/admin/programas', label: 'Grupos organizativos', icon: <GraduationCap {...ICON} /> },
  { to: '/admin/comites', label: 'Comités', icon: <Network {...ICON} /> },
  { to: '/admin/generaciones', label: 'Generaciones', icon: <Baby {...ICON} /> },
  { to: '/admin/insignias', label: 'Insignias', icon: <Medal {...ICON} /> },
  { to: '/admin/sellos', label: 'Biblioteca de sellos', icon: <Stamp {...ICON} /> },
]

export interface NavEvent {
  id: string
  name: string
  code?: string | null
  is_test?: boolean
  phase: EventPhase
}

// Brand and sign-out for phones (the side menu has them on computers).
export function AdminTopbar({ user, onSignOut }: { user?: { full_name: string; username: string; photo_path?: string | null }; onSignOut: () => void }) {
  return (
    <header className="topbar admin-topbar">
      <Logo size={30} />
      <AccountMenu user={user} onSignOut={onSignOut} roleLabel="Coordi" showTheme={false} />
    </header>
  )
}

export const phaseBadge = (phase: EventPhase) => `badge ${phase === 'started' ? 'ok live' : phase === 'enabled' ? 'ok' : phase === 'finished' ? 'warn-tone' : ''}`

// Computers: a side menu. Phones: a bottom bar (Carreras · the open carrera · Global) whose two last buttons open a sheet.
export default function AdminNav({
  event,
  user,
  onSignOut,
}: {
  event?: NavEvent | null // the carrera that is open (inside /admin/carreras/<id>)
  user?: { full_name: string; username: string; photo_path?: string | null }
  onSignOut: () => void
}) {
  const [sheet, setSheet] = useState<'carrera' | 'global' | null>(null)
  const { pathname } = useLocation()
  const base = event ? `/admin/carreras/${event.id}` : ''
  const inGlobal = GLOBAL_TABS.some((t) => pathname.startsWith(t.to))
  const close = () => setSheet(null)

  const link = (t: NavItem, onClick?: () => void) => (
    <NavLink key={t.to} to={t.to} end={t.end} className="tab" onClick={onClick} viewTransition>
      {t.icon}
      <span>{t.label}</span>
    </NavLink>
  )
  const carreraLinks = (onClick?: () => void) =>
    CARRERA_TABS.map((t) => link({ to: t.path ? `${base}/${t.path}` : base, label: t.label, icon: t.icon, end: t.end }, onClick))
  const globalLinks = (onClick?: () => void) => GLOBAL_TABS.map((t) => link(t, onClick))
  const name = event ? (event.is_test ? 'Carrera de prueba' : event.name) : null

  return (
    <aside className={`admin-nav${sheet ? ' sheet-open' : ''}`}>
      <div className="admin-brand">
        <Logo size={46} />
        <p className="doc-kicker office">Torre de control · Control tower</p>
        {event && (
          <p className="event">
            <Flag size={15} aria-hidden="true" />
            <strong>{name}</strong>
            <span className={phaseBadge(event.phase)}>{PHASE_LABEL[event.phase]}</span>
          </p>
        )}
        <p className="tower-hour">
          <small>Hora local</small>
          <TowerClock />
        </p>
      </div>

      <nav className="nav-desktop" aria-label="Secciones del panel">
        <p className="nav-label">Carreras</p>
        {link({ to: '/admin', label: 'Todas las carreras', icon: <LayoutGrid {...ICON} />, end: true })}
        {link({ to: '/admin/historial', label: 'Historial de resultados', icon: <History {...ICON} /> })}
        {event && (
          <>
            <p className="nav-label nav-sub">{name}{event.code && !name?.includes(event.code) ? ` · ${event.code}` : ''}</p>
            {carreraLinks()}
          </>
        )}
        <p className="nav-label">Administración global</p>
        {globalLinks()}
      </nav>

      <nav className="nav-mobile" aria-label="Secciones del panel">
        {link({ to: '/admin', label: 'Carreras', icon: <LayoutGrid {...ICON} />, end: true }, close)}
        {event ? (
          <button type="button" className={`tab more${sheet === 'carrera' || pathname.startsWith(base) ? ' active' : ''}`} aria-expanded={sheet === 'carrera'} aria-controls="admin-sheet" onClick={() => setSheet(sheet === 'carrera' ? null : 'carrera')}>
            <Waypoints {...ICON} />
            <span>Esta carrera</span>
          </button>
        ) : (
          <NavLink to="/admin/historial" className="tab" onClick={close}>
            <Archive {...ICON} />
            <span>Historial</span>
          </NavLink>
        )}
        <button type="button" className={`tab more${sheet === 'global' || inGlobal ? ' active' : ''}`} aria-expanded={sheet === 'global'} aria-controls="admin-sheet" onClick={() => setSheet(sheet === 'global' ? null : 'global')}>
          <Network {...ICON} />
          <span>Global</span>
        </button>
      </nav>
      {sheet && (
        <>
          <div className="sheet-backdrop" onClick={close} aria-hidden="true" />
          <div className="setup-sheet" id="admin-sheet">
            <p className="nav-label">{sheet === 'carrera' ? `${name ?? ''}` : 'Administración global'}</p>
            {sheet === 'carrera' ? carreraLinks(close) : globalLinks(close)}
          </div>
        </>
      )}

      <div className="admin-user">
        <AccountMenu user={user} onSignOut={onSignOut} placement="up" roleLabel="Coordi" showTheme={false} />
      </div>
    </aside>
  )
}
