import Inductores from './Inductores'
import { useAdmin } from './AdminContext'

// The inductores that take part in THIS carrera: its semester's records. The people themselves are global (Administración global → Inductores);
// being in an edition (career, culture, committee, group or base) is set here and never touches other carreras.
export default function CarreraInductores() {
  const { event } = useAdmin()
  if (!event) return null
  if (!event.term_id) return <p className="warn">Esta carrera todavía no tiene semestre (aplica la migración 0037).</p>
  return <Inductores key={event.term_id} fixedTermId={event.term_id} />
}
