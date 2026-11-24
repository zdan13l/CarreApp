import { Archive, FlaskConical, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { confirmDialog } from '../../lib/dialog'
import { PHASE_LABEL } from '../../lib/phase'
import { supabase } from '../../lib/supabase'
import type { EventRow } from '../../types'
import { useAdmin } from './AdminContext'
import { ALLOWED } from './PhaseControl'

interface Counts { teams: number; bases: number; matches: number }

// Level 2 of the panel: every edition (carrera) with its code and state, the way into each one, the permanent test carrera, and the history.
// New carreras are created here with the next code (2710 → 2730 → 2810…): nobody types it.
export default function Carreras() {
  const { events, reload } = useAdmin()
  const navigate = useNavigate()
  const [counts, setCounts] = useState<Record<string, Counts>>({})
  const [next, setNext] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ key: string; name: string }[]>([])
  const [template, setTemplate] = useState('mitologias')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const [t, b, m, n, tp] = await Promise.all([
      supabase.from('teams').select('event_id'),
      supabase.from('bases').select('event_id'),
      supabase.from('matches').select('event_id'),
      supabase.rpc('next_event_code'),
      supabase.from('themes').select('key, name').is('term_id', null).eq('is_global', false).order('name'),
    ])
    if (!tp.error) setTemplates((tp.data ?? []) as { key: string; name: string }[])
    const by: Record<string, Counts> = {}
    const add = (rows: { event_id: string }[] | null, k: keyof Counts) => {
      for (const r of rows ?? []) (by[r.event_id] ??= { teams: 0, bases: 0, matches: 0 })[k] += 1
    }
    add(t.data, 'teams')
    add(b.data, 'bases')
    add(m.data, 'matches')
    setCounts(by)
    setNext(typeof n.data === 'string' ? n.data : null)
  }, [])
  useEffect(() => {
    void load()
  }, [load, events.length])

  async function create() {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Crear la carrera ${next ?? ''}?`, message: 'Empieza vacía: sin grupos, bases, cruces ni usuarios. Su temática se copia de la plantilla que elegiste y es solo suya. Nada se hereda de otras carreras.', confirmLabel: 'Crear carrera', icon: 'check' }))) return
    setBusy(true)
    setError(null)
    let { data, error: err } = await supabase.rpc('create_event', { p_theme: template })
    if (err && /create_event/.test(err.message)) ({ data, error: err } = await supabase.rpc('create_event')) // migration 0037 is not applied yet
    if (err) setError(err.message)
    await reload()
    setBusy(false)
    if (!err && typeof data === 'string') navigate(`/admin/carreras/${data}/configuracion`)
  }

  const open = events.filter((e) => e.phase !== 'archived')
  const history = events.filter((e) => e.phase === 'archived')
  // the test carrera first, then the newest code
  const order = (a: EventRow, b: EventRow) => Number(b.is_test) - Number(a.is_test) || (b.code ?? '').localeCompare(a.code ?? '')

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Todas las carreras</h1>
        </div>
        <div className="head-meta">
          {templates.length > 1 && (
            <select value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Temática de la nueva carrera">
              {templates.map((t) => <option key={t.key} value={t.key}>Temática: {t.name}</option>)}
            </select>
          )}
          <button onClick={() => void create()} disabled={busy}>
            <Plus size={18} aria-hidden="true" /> Nueva carrera{next ? ` (${next})` : ''}
          </button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <p className="muted">Cada carrera es una edición con su propia configuración: grupos, bases, cruces, usuarios y todo lo suyo. Lo compartido (inductores, comités, insignias, sellos) está en <strong>Administración global</strong>.</p>

      <div className="carrera-grid">
        {[...open].sort(order).map((e) => (
          <CarreraCard key={e.id} e={e} c={counts[e.id]} />
        ))}
      </div>

      <h2 className="section-title"><Archive size={18} aria-hidden="true" /> Historial</h2>
      {history.length === 0 ? (
        <p className="muted">Las carreras finalizadas aparecen aquí, con todos sus datos. Los puntajes guardados también están en <Link to="/admin/historial">Historial de resultados</Link>.</p>
      ) : (
        <div className="carrera-grid">
          {[...history].sort(order).map((e) => (
            <CarreraCard key={e.id} e={e} c={counts[e.id]} />
          ))}
        </div>
      )}
    </>
  )
}

function CarreraCard({ e, c }: { e: EventRow; c?: Counts }) {
  const code = e.is_test ? 'PRUEBA' : (e.code ?? '—')
  return (
    <div className="tc-wrap">
      <Link to={`/admin/carreras/${e.id}`} className={`carrera-pass${e.is_test ? ' test' : ''}${e.phase === 'archived' ? ' archived' : ''}`}>
        <div className="tc">
          <div className="tc-main">
            <p className="tc-kicker">{c ? `${c.teams} grupos · ${c.bases} bases · ${c.matches} cruces` : 'Sin grupos ni bases todavía'}</p>
            <span className="tc-name">{e.is_test ? 'Carrera de prueba' : e.name}</span>
            <div className="tc-chips">
              {e.phase === 'started' ? <span className="live-label">{PHASE_LABEL[e.phase]}</span> : <span className={`badge${e.phase === 'enabled' ? ' ok' : ''}`}>{PHASE_LABEL[e.phase]}</span>}
            </div>
            {e.is_test && <p className="tc-note"><FlaskConical size={15} aria-hidden="true" /> Permanente: para probar configuraciones y funciones.</p>}
            <p className="tc-note allowed">{ALLOWED[e.phase]}</p>
          </div>
          <div className="tc-stub">
            <span className={`tc-code${code.length > 5 ? ' long' : ''}`}>{code}</span>
            <small>carrera</small>
          </div>
        </div>
      </Link>
    </div>
  )
}
