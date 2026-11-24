import { Archive, Baby, ChevronDown, ChevronLeft, Contact, Flag, GraduationCap, History, KeyRound, LayoutGrid, MapPin, Medal, Network, Palette, Radar, Settings2, ShieldCheck, Stamp, Swords, TowerControl, Users, Waypoints } from 'lucide-react'
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

// The panel has three levels and the menu shows ONE of them at a time, so nobody gets lost:
//  1) Outside a carrera: Carreras (every edition, with its state) and the Global administration (what all the carreras share).
//  2) Inside ONE carrera: only that edition, in three groups that follow its life: Resumen y control (the state), Preparación (what is done
//     BEFORE it starts, in the order it is done) and En carrera (what is looked at while it runs). The global administration is not shown there.

export type CarreraGroup = 'control' | 'prep' | 'live'

/** What lives inside one carrera (the paths hang from /admin/carreras/<id>/). The Preparación ones are in the order they are done. */
export const CARRERA_TABS: { path: string; label: string; icon: ReactNode; group: CarreraGroup; end?: boolean }[] = [
  { path: '', label: 'Resumen y control', icon: <TowerControl {...ICON} />, group: 'control', end: true },
  { path: 'configuracion', label: 'Configuración', icon: <Settings2 {...ICON} />, group: 'prep' },
  { path: 'tematica', label: 'Temática', icon: <Palette {...ICON} />, group: 'prep' },
  { path: 'grupos', label: 'Grupos participantes', icon: <Users {...ICON} />, group: 'prep' },
  { path: 'bases', label: 'Bases', icon: <MapPin {...ICON} />, group: 'prep' },
  { path: 'cruces', label: 'Cruces', icon: <Swords {...ICON} />, group: 'prep' },
  { path: 'comites', label: 'Coordi y comités', icon: <Network {...ICON} />, group: 'prep' },
  { path: 'inductores', label: 'Inductores', icon: <Contact {...ICON} />, group: 'prep' },
  { path: 'usuarios', label: 'Usuarios', icon: <KeyRound {...ICON} />, group: 'prep' },
  { path: 'puntajes', label: 'Puntajes', icon: <ShieldCheck {...ICON} />, group: 'live' },
  { path: 'mapa', label: 'Radar', icon: <Radar {...ICON} />, group: 'live' },
]

/** Shared by every carrera (only shown outside a carrera). */
export const GLOBAL_TABS: NavItem[] = [
  { to: '/admin/inductores', label: 'Inductores', icon: <Contact {...ICON} /> },
  { to: '/admin/programas', label: 'Grupos organizativos', icon: <GraduationCap {...ICON} /> },
  { to: '/admin/comites', label: 'Comités', icon: <Network {...ICON} /> },
  { to: '/admin/generaciones', label: 'Generaciones', icon: <Baby {...ICON} /> },
  { to: '/admin/insignias', label: 'Insignias', icon: <Medal {...ICON} /> },
  { to: '/admin/sellos', label: 'Sellos', icon: <Stamp {...ICON} /> },
]

/** Which group is open by default in each state: before it starts the preparation, from the start the race and its results. */
export const groupOpenIn = (group: CarreraGroup, phase: EventPhase): boolean =>
  group === 'prep' ? phase === 'disabled' || phase === 'enabled' : group === 'live' ? phase === 'started' || phase === 'finished' || phase === 'archived' : true
const GROUP_HINT: Record<'prep' | 'live', Partial<Record<EventPhase, string>>> = {
  prep: { started: 'protegida mientras corre', finished: 'cerrada', archived: 'solo lectura' },
  live: { disabled: 'al iniciar', enabled: 'al iniciar' },
}

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

// A group of the menu that can be folded: the one that matches the state of the carrera starts open, and the one that holds the page you are on
// is always open.
function NavGroup({ title, hint, open: initial, holdsActive, children }: { title: string; hint?: string; open: boolean; holdsActive: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial)
  const shown = open || holdsActive
  return (
    <div className={`nav-group${shown ? ' open' : ''}`}>
      <button type="button" className="nav-group-head" aria-expanded={shown} onClick={() => setOpen(!shown)}>
        <span>{title}</span>
        {hint && <small>{hint}</small>}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {shown && <div className="nav-group-body">{children}</div>}
    </div>
  )
}

// Computers: a side menu. Phones: a bottom bar (Carreras · the open carrera, or Carreras · Historial · Global) whose last button opens a sheet.
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

  const link = (t: NavItem, onClick?: () => void, step?: number) => (
    <NavLink key={t.to} to={t.to} end={t.end} className="tab" onClick={onClick} viewTransition>
      {step ? <b className="step-no" aria-hidden="true">{step}</b> : t.icon}
      <span>{t.label}</span>
    </NavLink>
  )
  const globalLinks = (onClick?: () => void) => GLOBAL_TABS.map((t) => link(t, onClick))
  const name = event ? (event.is_test ? 'Carrera de prueba' : event.name) : null

  // inside a carrera: Resumen y control, then Preparación (numbered, in the order it is done) and En carrera
  const carreraMenu = (onClick?: () => void) => {
    if (!event) return null
    const to = (path: string) => (path ? `${base}/${path}` : base)
    const holds = (group: CarreraGroup) => CARRERA_TABS.some((t) => t.group === group && t.path !== '' && pathname.startsWith(to(t.path)))
    const item = (t: (typeof CARRERA_TABS)[number], step?: number) => link({ to: to(t.path), label: t.label, icon: t.icon, end: t.end }, onClick, step)
    const prep = CARRERA_TABS.filter((t) => t.group === 'prep')
    const live = CARRERA_TABS.filter((t) => t.group === 'live')
    return (
      <>
        {CARRERA_TABS.filter((t) => t.group === 'control').map((t) => item(t))}
        <NavGroup key={`prep-${event.phase}`} title="Preparación" hint={GROUP_HINT.prep[event.phase]} open={groupOpenIn('prep', event.phase)} holdsActive={holds('prep')}>
          {prep.map((t, i) => item(t, i + 1))}
        </NavGroup>
        <NavGroup key={`live-${event.phase}`} title="En carrera" hint={GROUP_HINT.live[event.phase]} open={groupOpenIn('live', event.phase)} holdsActive={holds('live')}>
          {live.map((t) => item(t))}
        </NavGroup>
      </>
    )
  }

  return (
    <aside className={`admin-nav${sheet ? ' sheet-open' : ''}`}>
      <div className="admin-brand">
        <Logo size={40} />
        <p className="doc-kicker office">Torre de control</p>
        <p className="tower-hour">
          <small>Hora local</small>
          <TowerClock />
        </p>
      </div>

      <nav className="nav-desktop" aria-label="Secciones del panel">
        {event ? (
          <>
            <NavLink to="/admin" end className="back-link nav-back"><ChevronLeft size={16} aria-hidden="true" /> Todas las carreras</NavLink>
            <p className="event nav-event">
              <Flag size={15} aria-hidden="true" />
              <strong>{name}{event.code && !name?.includes(event.code) ? ` · ${event.code}` : ''}</strong>
              <span className={phaseBadge(event.phase)}>{PHASE_LABEL[event.phase]}</span>
            </p>
            {carreraMenu()}
          </>
        ) : (
          <>
            <p className="nav-label">Carreras</p>
            {link({ to: '/admin', label: 'Todas las carreras', icon: <LayoutGrid {...ICON} />, end: true })}
            {link({ to: '/admin/historial', label: 'Historial de resultados', icon: <History {...ICON} /> })}
            <p className="nav-label">Administración global</p>
            {globalLinks()}
          </>
        )}
      </nav>

      <nav className="nav-mobile" aria-label="Secciones del panel">
        {link({ to: '/admin', label: 'Carreras', icon: <LayoutGrid {...ICON} />, end: true }, close)}
        {event ? (
          <button type="button" className={`tab more${sheet === 'carrera' || pathname.startsWith(base) ? ' active' : ''}`} aria-expanded={sheet === 'carrera'} aria-controls="admin-sheet" onClick={() => setSheet(sheet === 'carrera' ? null : 'carrera')}>
            <Waypoints {...ICON} />
            <span>Esta carrera</span>
          </button>
        ) : (
          <>
            <NavLink to="/admin/historial" className="tab" onClick={close}>
              <Archive {...ICON} />
              <span>Historial</span>
            </NavLink>
            <button type="button" className={`tab more${sheet === 'global' || inGlobal ? ' active' : ''}`} aria-expanded={sheet === 'global'} aria-controls="admin-sheet" onClick={() => setSheet(sheet === 'global' ? null : 'global')}>
              <Network {...ICON} />
              <span>Global</span>
            </button>
          </>
        )}
      </nav>
      {sheet && (
        <>
          <div className="sheet-backdrop" onClick={close} aria-hidden="true" />
          <div className="setup-sheet" id="admin-sheet">
            {sheet === 'carrera' && event ? (
              <>
                <p className="nav-label">{name} · {PHASE_LABEL[event.phase]}</p>
                {carreraMenu(close)}
              </>
            ) : (
              <>
                <p className="nav-label">Administración global</p>
                {globalLinks(close)}
              </>
            )}
          </div>
        </>
      )}

      <div className="admin-user">
        <AccountMenu user={user} onSignOut={onSignOut} placement="up" roleLabel="Coordi" showTheme={false} />
      </div>
    </aside>
  )
}
