import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Counts } from '../lib/prepStatus'

// "Preparación": the steps to prepare a carrera, with the SAME numbers as the Preparación group of the side menu, each with its state and a link
// to the screen where it is done. The ones the database needs to enable the carrera are marked as required; the rest are optional.
export default function PrepSteps({ eventId, counts, problems, phase }: { eventId: string; counts: Counts; problems: string[]; phase: 'disabled' | 'enabled' }) {
  const has = (re: RegExp) => problems.some((p) => re.test(p))
  const to = (path: string) => `/admin/carreras/${eventId}/${path}`
  const steps: { to: string; title: string; sub: string; done: boolean | null }[] = [
    { to: to('configuracion'), title: 'Configuración', sub: 'Tiempos de traslado y carga desde un archivo', done: null },
    { to: to('tematica'), title: 'Temática', sub: 'La temática de esta carrera y sus subtemáticas', done: null },
    { to: to('grupos'), title: 'Grupos participantes', sub: `${counts.teams} grupos con su foto`, done: counts.teams >= 2 && !has(/^El grupo ".*" no tiene foto/) },
    { to: to('bases'), title: 'Bases', sub: `${counts.bases} bases con foto, información y 3 preguntas`, done: counts.bases >= 1 && !has(/^La base /) },
    { to: to('cruces'), title: 'Cruces', sub: counts.matches > 0 ? `${counts.matches} cruces armados` : 'El cronograma, ronda por ronda', done: counts.matches > 0 },
    { to: to('comites'), title: 'Coordi y comités', sub: 'Quién coordina la carrera y cada comité', done: null },
    { to: to('inductores'), title: 'Inductores', sub: 'Las personas que participan en esta carrera', done: null },
    { to: to('usuarios'), title: 'Usuarios', sub: `${counts.users} corredores e inductores, asignados a su grupo o base`, done: counts.users > 0 && !has(/ningún corredor/) },
  ]
  const ready = problems.length === 0
  return (
    <section className="card prep-steps">
      <h2>Pasos para preparar la carrera</h2>
      <p className="muted">Siguen el mismo orden del menú. Los marcados con círculo son obligatorios para habilitarla; los demás son opcionales.</p>
      <ol>
        {steps.map((st, i) => (
          <li key={st.to}>
            <Link to={st.to} className="prep-step">
              <span className={`prep-mark${st.done ? ' done' : ''}`}>
                {st.done === null ? <span className="step-no" aria-hidden="true">{i + 1}</span> : st.done ? <CheckCircle2 size={22} aria-label="Listo" /> : <Circle size={22} aria-label="Pendiente" />}
              </span>
              <span className="grow">
                <strong>{i + 1}. {st.title}{st.done === null && <small className="muted"> · opcional</small>}</strong>
                <small className="muted">{st.sub}</small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <div className="prep-step">
            <span className={`prep-mark${phase === 'enabled' ? ' done' : ''}`}>{phase === 'enabled' ? <CheckCircle2 size={22} aria-label="Listo" /> : <Circle size={22} aria-label="Pendiente" />}</span>
            <span className="grow">
              <strong>Habilitar</strong>
              <small className="muted">{phase === 'enabled' ? 'Habilitada: los usuarios ya entran. Inicia la carrera arriba cuando sea la hora.' : ready ? 'Todo listo: ya puedes habilitarla (arriba).' : `Faltan ${problems.length} cosas (abajo).`}</small>
            </span>
          </div>
        </li>
      </ol>
    </section>
  )
}

/** What still prevents enabling the carrera, and what is only worth checking. */
export function PrepReport({ phase, problems, warnings }: { phase: 'disabled' | 'enabled'; problems: string[]; warnings: string[] }) {
  return (
    <>
      {problems.length === 0 ? (
        <p className="ok-box">Todo completo: fotos, un usuario por grupo, información y 3 preguntas por base.</p>
      ) : (
        <div className="fail-box">
          <strong>{phase === 'enabled' ? 'Pendientes antes de iniciar:' : 'Falta para poder habilitar la carrera:'}</strong>
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="warn">
          <strong>Recomendado revisar (no bloquea):</strong>
          <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
    </>
  )
}
