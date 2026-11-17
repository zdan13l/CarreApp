import { CalendarOff } from 'lucide-react'

// What a runner or an inductor sees when their user has no active Carrera: a calm explanation, not a bare error.
export default function NoActiveCarrera({ role }: { role: 'runner' | 'base' }) {
  return (
    <section className="empty-state" role="status">
      <span className="empty-icon" aria-hidden="true"><CalendarOff size={34} /></span>
      <h2>No hay ninguna Carrera activa para tu usuario</h2>
      <p className="muted">
        {role === 'base'
          ? 'Cuando el coordinador active la Carrera y te asigne a una base, aquí verás tus cruces. Esta pantalla se actualiza sola.'
          : 'Cuando el coordinador active la Carrera y te asigne a un grupo, aquí verás tu ronda. Esta pantalla se actualiza sola.'}
      </p>
      <p className="muted">¿Crees que es un error? Avísale al coordinador.</p>
    </section>
  )
}
