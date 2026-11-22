import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'

// The history of the Carreras: when one is deactivated its final table and every point of every match are saved (migration 0028) before its
// progress is reset, written with the names of the groups and bases so it stays whole even if they are deleted later.
interface Standing {
  team: string
  points: number
}
interface Result {
  round: number
  base: string
  team_a: string
  team_b: string
  item: string
  winner: string | null
  voided: boolean
}
export interface Archive {
  id: string
  event_name: string
  term_name: string | null
  archived_at: string
  matches_played: number
  standings: Standing[]
  results: Result[]
}

const ITEM: Record<string, string> = { barra: 'Barra', pregunta: 'Pregunta', minijuego: 'Minijuego' }
const when = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

/** One saved Carrera: its final table and, folded away, every point. */
export function ArchiveCard({ a, onRemove }: { a: Archive; onRemove: () => void }) {
  return (
    <section className="card history-card">
      <header className="history-head">
        <div className="grow">
          <h2>{a.event_name}</h2>
          <p className="muted">
            {a.term_name ? `Inducción ${a.term_name} · ` : ''}
            {when(a.archived_at)} · {a.matches_played} {a.matches_played === 1 ? 'cruce terminado' : 'cruces terminados'}
          </p>
        </div>
        <button type="button" className="ghost icon-btn" aria-label={`Borrar el historial de ${a.event_name}`} onClick={() => onRemove()}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </header>
      <table className="history-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Grupo</th>
            <th scope="col">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {a.standings.map((s, i) => (
            <tr key={`${s.team}-${i}`}>
              <td>{i + 1}</td>
              <td>{s.team}</td>
              <td className="num">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="history-detail">
        <summary>Cada punto, ronda por ronda</summary>
        {Array.from(new Set(a.results.map((r) => r.round))).map((round) => (
          <div key={round} className="history-round">
            <h3>Ronda {round}</h3>
            <ul>
              {a.results
                .filter((r) => r.round === round)
                .map((r, i) => (
                  <li key={i}>
                    <span className="muted">{r.base} · {r.team_a} vs {r.team_b} · {ITEM[r.item] ?? r.item}:</span>{' '}
                    {r.voided ? <em>no se jugó</em> : <strong>{r.winner}</strong>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  )
}

export default function Historial() {
  const [archives, setArchives] = useState<Archive[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: err } = await supabase
      .from('event_archives')
      .select('id, event_name, term_name, archived_at, matches_played, standings, results')
      .order('archived_at', { ascending: false })
    if (err) setMissing(true) // migration 0028 is not applied yet
    else {
      setMissing(false)
      setArchives((data ?? []) as unknown as Archive[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(a: Archive) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Borrar este historial de ${a.event_name}?`, message: 'Se borran la tabla final y los puntos de esa vez. No se puede deshacer.', confirmLabel: 'Borrar', tone: 'danger', icon: 'trash' }))) return
    const { error: err } = await supabase.from('event_archives').delete().eq('id', a.id)
    if (err) setError('No se pudo borrar.')
    else {
      setError(null)
      void load()
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">Historial</h1>
      <p className="muted">Cada vez que una Carrera se desactiva se guarda aquí su tabla final y todos sus puntos, antes de reiniciarla. Las Carreras no se eliminan: se quedan desactivadas.</p>
      {missing && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0028_event_archives.sql</span> para guardar el historial de puntajes.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : archives.length === 0 && !missing ? (
        <section className="card">
          <p className="muted">Todavía no hay historial: aparece cuando se desactiva una Carrera que ya tuvo puntos.</p>
        </section>
      ) : (
        archives.map((a) => <ArchiveCard key={a.id} a={a} onRemove={() => void remove(a)} />)
      )}
    </div>
  )
}
