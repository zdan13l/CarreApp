import { FlaskConical } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { PHASE_LABEL } from '../../lib/phase'
import { useAdmin } from './AdminContext'
import { phaseBadge } from './AdminNav'

// Level 2: the space of ONE carrera. The side menu (AdminNav) already says which carrera it is, its state and holds every section, so there is NO
// bar of tabs up here: on computers this renders only the page; on phones, which have no side menu, a thin strip says which carrera it is.
// Everything below (groups, bases, schedule, users…) belongs only to this edition.
export default function CarreraShell() {
  const { event } = useAdmin()
  if (!event) return <p className="warn">No encontré esa carrera. <Link to="/admin">Volver a las carreras</Link></p>
  return (
    <>
      <p className="carrera-strip">
        <strong className="mono">{event.is_test ? 'PRUEBA' : (event.code ?? '—')}</strong>
        <span>{event.is_test ? 'Carrera de prueba' : event.name}</span>
        {event.is_test && <FlaskConical size={16} aria-label="Carrera de prueba" />}
        <span className={phaseBadge(event.phase)}>{PHASE_LABEL[event.phase]}</span>
      </p>
      <Outlet />
    </>
  )
}
