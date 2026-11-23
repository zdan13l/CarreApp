import { ChevronLeft, FlaskConical } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { PHASE_LABEL } from '../../lib/phase'
import { useAdmin } from './AdminContext'
import { CARRERA_TABS, phaseBadge } from './AdminNav'
import { ALLOWED } from './PhaseControl'

// Level 3: the space of ONE carrera. It always says which carrera it is, which section you are in (the tabs), its state and what is allowed now.
// Everything below it (groups, bases, schedule, users…) belongs only to this edition.
export default function CarreraShell() {
  const { event } = useAdmin()
  if (!event) return <p className="warn">No encontré esa carrera. <Link to="/admin">Volver a las carreras</Link></p>
  const base = `/admin/carreras/${event.id}`
  return (
    <>
      <div className="carrera-bar">
        <Link to="/admin" className="back-link"><ChevronLeft size={16} aria-hidden="true" /> Carreras</Link>
        <div className="carrera-id">
          <strong className="mono">{event.is_test ? 'PRUEBA' : (event.code ?? '—')}</strong>
          <span>{event.is_test ? 'Carrera de prueba' : event.name}</span>
          {event.is_test && <FlaskConical size={16} aria-label="Carrera de prueba" />}
          <span className={phaseBadge(event.phase)}>{PHASE_LABEL[event.phase]}</span>
        </div>
        <p className="muted allowed">{ALLOWED[event.phase]}</p>
        <nav className="carrera-tabs" aria-label={`Secciones de ${event.name}`}>
          {CARRERA_TABS.map((t) => (
            <NavLink key={t.path} to={t.path ? `${base}/${t.path}` : base} end={t.end} className="ctab">
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </>
  )
}
