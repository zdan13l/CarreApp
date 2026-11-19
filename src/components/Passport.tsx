import { ChevronLeft, ChevronRight, Plane } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Mrz from './Mrz'
import RouteMap, { type RouteStop } from './RouteMap'
import Stamp, { type StampState } from './Stamp'
import { airportCode } from '../lib/flight'
import { stampTime } from '../lib/stamp'

// The passport of a group: a cover that opens, an identity page with the route chart and the progress of the trip, and the
// stamp pages (four destinations each). A stamp is earned when the base has scored the three stages of the match (the match is
// finished); until then its destination is "en ruta", "en puerta" (the base confirmed the arrival) or "pendiente".
// Everything is read from the matches the group already has: nothing is stored here and nothing is invented.
export interface PassportMatch {
  id: string
  round_number: number
  base_id: string
  status: 'pending' | 'in_progress' | 'finished'
  arrived_at: string | null
  finished_at: string | null
  bases: { name: string; location_photo_path: string | null; lat: number | null; lng: number | null } | null
}

const PER_PAGE = 4
const STATUS_TEXT: Record<StampState, string> = { done: 'Completado', stamped: 'Completado', current: 'Disponible', pending: 'Pendiente', rest: 'Sin cruce' }

export default function Passport({
  team,
  flight,
  mine,
  totalRounds,
  nextId,
  detail,
  newId,
}: {
  team: string
  flight: string
  mine: PassportMatch[]
  totalRounds: number
  nextId?: string
  detail: (match: PassportMatch) => ReactNode // what to show when a stamp is opened (the three stages of that destination)
  newId?: string | null // the stamp that was just earned: it plays the stamping animation
}) {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>('closed')
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [open, setOpen] = useState<string | null>(null)
  const swipe = useRef<number | null>(null)

  // The cover is the first thing every time the Pasaporte tab is opened, and it waits for a touch: it opens when it is tapped.
  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => setPhase('open'), 1050)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  const rounds = Array.from({ length: totalRounds }, (_, i) => i + 1)
  const slots = rounds.map((round) => {
    const m = mine.find((x) => x.round_number === round)
    const state: StampState = !m ? 'rest' : m.status === 'finished' ? 'done' : m.id === nextId ? 'current' : 'pending'
    return { round, m, state }
  })
  const trip = slots.filter((s) => s.state !== 'rest')
  const done = trip.filter((s) => s.state === 'done').length
  const complete = trip.length > 0 && done === trip.length
  const stampPages = Math.max(1, Math.ceil(slots.length / PER_PAGE))
  const pages = 1 + stampPages
  const stops: RouteStop[] = trip.map((s) => ({
    id: s.m!.id,
    name: s.m!.bases?.name ?? `Ronda ${s.round}`,
    lat: s.m!.bases?.lat ?? null,
    lng: s.m!.bases?.lng ?? null,
    state: s.state === 'done' ? 'done' : s.state === 'current' ? 'current' : 'pending',
  }))

  const go = (to: number) => {
    const next = Math.min(Math.max(to, 0), pages - 1)
    if (next === page) return
    setDir(next > page ? 'next' : 'prev')
    setPage(next)
    setOpen(null)
  }

  if (totalRounds === 0) {
    return (
      <section className="card passport">
        <p className="muted">Todavía no hay rondas programadas.</p>
      </section>
    )
  }

  const opened = slots.find((s) => s.m && s.m.id === open)
  const pageSlots = page > 0 ? slots.slice((page - 1) * PER_PAGE, page * PER_PAGE) : []

  return (
    <section className="booklet" aria-label={`Pasaporte de ${team}`}>
      <div
        className="leaf-wrap"
        onPointerDown={(e) => {
          swipe.current = e.clientX
        }}
        onPointerUp={(e) => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 60) go(page + (dx < 0 ? 1 : -1))
        }}
      >
        <article key={page} className={`leaf ${dir === 'next' ? 'turn-next' : 'turn-prev'}`}>
          {page === 0 ? (
            <>
              <header className="leaf-head">
                <img className="uni-mark" src="/crest-simple.svg" alt="CarreApp" width={569} height={622} />
                <div>
                  <p className="doc-kicker">Pasaporte · Carrera 2710</p>
                  <h2 className="leaf-title">{team}</h2>
                </div>
              </header>
              <dl className="id-grid">
                <div>
                  <dt>Equipo</dt>
                  <dd>{team}</dd>
                </div>
                <div>
                  <dt>Vuelo</dt>
                  <dd className="mono">{flight}</dd>
                </div>
                <div>
                  <dt>Destinos</dt>
                  <dd className="num">{trip.length}</dd>
                </div>
                <div>
                  <dt>Sellos</dt>
                  <dd className="num">{done}</dd>
                </div>
              </dl>
              <RouteMap stops={stops} title={`Recorrido de ${team}`} />
              <div className="trip" role="img" aria-label={`Progreso del viaje: ${done} de ${trip.length} destinos`}>
                <div className="trip-line">
                  <i style={{ width: `${trip.length ? (done / trip.length) * 100 : 0}%` }} />
                  <Plane className="trip-plane" size={18} style={{ left: `${trip.length ? (done / trip.length) * 100 : 0}%` }} aria-hidden="true" />
                </div>
                <p className="trip-text">
                  <strong className="num">{done}</strong> de {trip.length} destinos completados
                </p>
              </div>
              <ul className="itinerary">
                {trip.map((s) => (
                  <li key={s.m!.id} className={s.state}>
                    <span className="mono">{airportCode(s.m!.bases?.name ?? '')}</span>
                    <span className="grow">{s.m!.bases?.name}</span>
                    <span className="flap-mini">{STATUS_TEXT[s.state]}</span>
                  </li>
                ))}
              </ul>
              {complete && (
                <div className="passport-complete" role="status">
                  <strong>Viaje completo</strong>
                  <span>Todos los sellos son de {team}. ¡Buen recorrido!</span>
                </div>
              )}
            </>
          ) : (
            <>
              <header className="leaf-head">
                <div className="grow">
                  <p className="doc-kicker">Sellos de entrada · {flight}</p>
                  <h2 className="leaf-title">Página {page + 1}</h2>
                </div>
                <p className="passport-count num" aria-label={`${done} de ${trip.length} sellos`}>
                  {done}
                  <small>/{trip.length}</small>
                </p>
              </header>
              {done > 0 && <p className="slot-hint">Toca un sello para verlo más grande.</p>}
              <ul className="slots">
                {pageSlots.map(({ round, m, state }) => {
                  const base = m?.bases?.name ?? ''
                  const inner = (
                    <>
                      <span className="slot-page mono">{m ? airportCode(base) : `R${round}`}</span>
                      <Stamp
                        seed={m?.base_id ?? `r${round}`}
                        name={base || `Ronda ${round}`}
                        photoPath={m?.bases?.location_photo_path}
                        round={round}
                        time={stampTime(m?.finished_at)}
                        state={state}
                        atGate={Boolean(m?.arrived_at || m?.status === 'in_progress')}
                        size={132}
                        pop={m?.id === newId}
                      />
                      <span className="slot-name">{base || 'Descansas'}</span>
                      <span className={`flap-mini ${state}`}>
                        {state === 'current' && (m?.arrived_at || m?.status === 'in_progress') ? 'En puerta' : state === 'current' ? 'En ruta' : STATUS_TEXT[state]}
                      </span>
                    </>
                  )
                  return (
                    <li key={round} className={`slot ${state}`}>
                      {state === 'done' && m ? (
                        <button type="button" className="slot-btn" aria-haspopup="dialog" aria-label={`Ver el sello de ${base} más grande`} onClick={() => setOpen(m.id)}>
                          {inner}
                        </button>
                      ) : (
                        <div className="slot-btn">{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <Mrz team={team} stamps={done} rounds={trip.length} />
        </article>
      </div>

      {opened?.m && createPortal(
        <div className="moment zoom" role="dialog" aria-modal="true" aria-label={`Sello de ${opened.m.bases?.name ?? 'la ronda'}`} onClick={() => setOpen(null)}>
          <div className="moment-card" onClick={(e) => e.stopPropagation()}>
            <p className="moment-kicker">
              Sello {opened.round} · {airportCode(opened.m.bases?.name ?? '')}
            </p>
            <Stamp
              seed={opened.m.base_id}
              name={opened.m.bases?.name ?? `Ronda ${opened.round}`}
              photoPath={opened.m.bases?.location_photo_path}
              round={opened.round}
              time={stampTime(opened.m.finished_at)}
              state="done"
              size={250}
              straight
            />
            <h2>{opened.m.bases?.name}</h2>
            <div className="zoom-detail">{detail(opened.m)}</div>
            <button type="button" className="ghost moment-close" onClick={() => setOpen(null)}>
              Cerrar
            </button>
          </div>
        </div>,
        document.body,
      )}

      <nav className="leaf-nav" aria-label="Páginas del pasaporte">
        <button type="button" className="ghost icon-btn" onClick={() => go(page - 1)} disabled={page === 0} aria-label="Página anterior">
          <ChevronLeft size={20} />
        </button>
        <span className="leaf-dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page ? 'on' : undefined} />
          ))}
        </span>
        <span className="sr-only">
          Página {page + 1} de {pages}
        </span>
        <button type="button" className="ghost icon-btn" onClick={() => go(page + 1)} disabled={page === pages - 1} aria-label="Página siguiente">
          <ChevronRight size={20} />
        </button>
      </nav>

      {phase !== 'open' && (
        <button type="button" className={`cover${phase === 'opening' ? ' opening' : ''}`} onClick={() => setPhase('opening')} aria-label="Abrir el pasaporte">
          <span className="cover-inner">
            <img className="cover-uni" src="/crest-dorado.svg" alt="CarreApp" width={1110} height={1215} />
            <span className="cover-title">Pasaporte</span>
            <span className="cover-sub">Carrera 2710</span>
            <span className="cover-team">{team}</span>
            <span className="cover-flight mono">{flight}</span>
            <span className="cover-hint">Toca para abrir</span>
          </span>
        </button>
      )}
    </section>
  )
}
