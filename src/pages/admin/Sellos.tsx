import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { MythPicture } from '../../components/InkSeals'
import { SEAL_ORDER, sealOf, type MythSeal } from '../../lib/seals'
import { supabase } from '../../lib/supabase'

const CULTURES: Record<string, string> = { egipcia: 'Egipcia', nordica: 'Nórdica', griega: 'Griega', mexicana: 'Mexicana', china: 'China' }

// One seal at its real size, in its own ink.
function SealFace({ seal, color }: { seal: MythSeal; color: string }) {
  return (
    <span className="seal-face" style={{ '--stamp-ink': color } as CSSProperties}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <g className="stamp-ink">
          <MythPicture seal={seal} />
        </g>
      </svg>
    </span>
  )
}

// GLOBAL: the library of the seals the app brings (read only). Seals are made and edited INSIDE each carrera (its Sellos tab): the seals of its
// theme, subthemes, groups, committees and bases, and the extra ones it uploads. Nothing is made here, so nothing is made twice.
export default function Sellos() {
  const [rows, setRows] = useState<{ id: string; name: string; code: string | null; is_test: boolean; bases: number; seals: number }[]>([])

  const load = useCallback(async () => {
    if (!supabase) return
    const [e, b, s] = await Promise.all([
      supabase.from('events').select('id, name, code, is_test').order('created_at', { ascending: false }),
      supabase.from('bases').select('event_id'),
      supabase.from('event_seals').select('event_id'),
    ])
    const count = (list: { event_id: string }[] | null) => {
      const m = new Map<string, number>()
      for (const r of list ?? []) m.set(r.event_id, (m.get(r.event_id) ?? 0) + 1)
      return m
    }
    const bases = count(b.data)
    const seals = count(s.data)
    setRows((e.data ?? []).map((x) => ({ id: x.id as string, name: x.name as string, code: x.code as string | null, is_test: Boolean(x.is_test), bases: bases.get(x.id as string) ?? 0, seals: seals.get(x.id as string) ?? 0 })))
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Administración global</p>
          <h1>Biblioteca de sellos</h1>
        </div>
        <p className="head-meta">Los sellos de siempre de la app. Cada carrera los usa, los edita y sube los suyos en su pestaña Sellos.</p>
      </header>

      <section className="card">
        <h2>Los 15 sellos de la app</h2>
        <p className="muted">Cinco mitologías, tres sellos cada una, cada uno con su color. Son los de siempre (los de la 2710); editarlos para otra carrera se hace en esa carrera.</p>
        <div className="seal-grid">
          {SEAL_ORDER.map((k) => {
            const s = sealOf(k)
            return (
              <figure key={k} className="seal-item">
                <SealFace seal={s} color={`var(--seal-${s.key})`} />
                <figcaption>
                  <strong>{s.name}</strong>
                  <small>{CULTURES[s.culture]}</small>
                  <i className="swatch" style={{ background: `var(--seal-${s.key})` }} aria-hidden="true" />
                </figcaption>
              </figure>
            )
          })}
        </div>
      </section>

      <section className="card">
        <h2>Sellos de cada carrera</h2>
        <ul className="list">
          {rows.map((r) => (
            <li key={r.id}>
              <span className="grow">
                <strong>{r.is_test ? 'Carrera de prueba' : r.name}</strong>
                <small className="muted"> · {r.bases} bases · {r.seals} sellos propios</small>
              </span>
              <Link className="btn-like" to={`/admin/carreras/${r.id}/sellos`}>Abrir sellos</Link>
            </li>
          ))}
          {rows.length === 0 && <li className="muted">Todavía no hay carreras.</li>}
        </ul>
      </section>
    </>
  )
}
