import PageTitle from './PageTitle'
import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing } from 'lucide-react'
import { sendMatchAlert } from '../../components/DelaysPanel'
import RoundPager from '../../components/RoundPager'
import { analyzeSchedule, currentRound, formatTime, matchErrorMessage } from '../../lib/schedule'
import { useRealtimeReload } from '../../lib/realtime'
import { DEFAULT_ALERT_MESSAGE } from '../../lib/delays'
import { supabase } from '../../lib/supabase'
import { STATUS_LABEL, type MatchRow } from '../../types'
import { errMsg, useAdmin } from './AdminContext'
import { confirmDialog, promptDialog } from '../../lib/dialog'

interface Named {
  id: string
  name: string
}

export default function Cruces() {
  const { event } = useAdmin()
  const [teams, setTeams] = useState<Named[]>([])
  const [bases, setBases] = useState<Named[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [extraRounds, setExtraRounds] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventId = event?.id

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [t, b, m] = await Promise.all([
      supabase.from('teams').select('id, name').eq('event_id', eventId).order('sort_order').order('name'),
      supabase.from('bases').select('id, name').eq('event_id', eventId).order('sort_order').order('name'),
      supabase
        .from('matches')
        .select('id, round_number, base_id, team_a, team_b, status, arrived_at, finished_at')
        .eq('event_id', eventId)
        .order('round_number'),
    ])
    setTeams(t.data ?? [])
    setBases(b.data ?? [])
    setMatches((m.data ?? []) as MatchRow[])
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeReload(['matches'], load)

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const baseName = useMemo(() => new Map(bases.map((b) => [b.id, b.name])), [bases])
  const analysis = useMemo(() => analyzeSchedule(matches, teams, bases), [matches, teams, bases])

  if (!event) return <p className="warn">Primero crea una carrera en la pestaña "Carrera".</p>

  const maxRound = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const roundCount = Math.max(maxRound, extraRounds, 1)
  const shownRound = Math.min(selected ?? currentRound(matches), roundCount)
  const roundMatches = matches.filter((m) => m.round_number === shownRound)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function clearAll() {
    if (!supabase || !eventId || matches.length === 0) return
    const withScores = matches.some((m) => m.status !== 'pending')
    if (!(await confirmDialog({ title: `¿Borrar los ${matches.length} cruces?`, message: withScores ? 'Se borran también TODOS los puntos registrados.' : undefined, confirmLabel: 'Borrar cruces', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      const { error: err } = await supabase!.from('matches').delete().eq('event_id', eventId)
      if (err) throw new Error('No se pudieron borrar los cruces.')
      setExtraRounds(0)
    })
  }

  const notEnough = teams.length < 2 || bases.length < 1

  return (
    <>
            <PageTitle step={5}>Cruces</PageTitle>
      <p className="muted">
        {teams.length} grupos · {bases.length} bases · {matches.length} cruces en {maxRound} rondas.
        Cada pareja de grupos solo puede enfrentarse una vez; la app lo valida.
      </p>
      {error && <p className="error">{error}</p>}

      {notEnough ? (
        <p className="warn">Necesitas al menos 2 grupos y 1 base para armar cruces.</p>
      ) : (
        matches.length === 0 && (
          <p className="ok-box">
            El cronograma se arma a mano: en cada ronda agrega los cruces eligiendo la base y los dos grupos. La app no deja repetir rivales ni
            poner un grupo en dos bases a la vez.
          </p>
        )
      )}

      {matches.length > 0 && (
        <section className="card">
          <h2>Revisión del cronograma</h2>
          <p>
            {analysis.pairsPlanned} de {analysis.pairsTotal} enfrentamientos posibles están programados.
          </p>
          {analysis.warnings.length === 0 ? (
            <p className="ok-box">Sin observaciones: todos juegan y no repiten base.</p>
          ) : (
            <div className="warn">
              <ul>{analysis.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {!notEnough && (
        <>
          <h2 className="section-title">Rondas</h2>
          <RoundPager
            round={shownRound}
            total={roundCount}
            matches={roundMatches.length}
            finished={roundMatches.filter((m) => m.status === 'finished').length}
            onChange={setSelected}
            showAll={showAll}
            onToggleAll={setShowAll}
          />
          <div className="grid">
            {Array.from({ length: roundCount }, (_, i) => i + 1).filter((r) => showAll || r === shownRound).map((r) => (
              <RoundCard
                key={r}
                round={r}
                matches={matches.filter((m) => m.round_number === r)}
                allMatches={matches}
                teams={teams}
                bases={bases}
                teamName={teamName}
                baseName={baseName}
                eventId={event.id}
                busy={busy}
                onChange={load}
              />
            ))}
          </div>
          <div className="row">
            <button className="ghost" onClick={() => { setExtraRounds(roundCount + 1); setSelected(roundCount + 1) }}>+ Agregar ronda</button>
            {matches.length > 0 && <button className="ghost danger" disabled={busy} onClick={clearAll}>Borrar todos los cruces</button>}
          </div>
        </>
      )}
    </>
  )
}

export function RoundCard({
  round,
  matches,
  allMatches,
  teams,
  bases,
  teamName,
  baseName,
  eventId,
  busy: parentBusy,
  onChange,
}: {
  round: number
  matches: MatchRow[]
  allMatches: MatchRow[]
  teams: Named[]
  bases: Named[]
  teamName: Map<string, string>
  baseName: Map<string, string>
  eventId: string
  busy: boolean
  onChange: () => Promise<void>
}) {
  const [baseId, setBaseId] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const usedTeams = new Set(matches.flatMap((m) => [m.team_a, m.team_b]))
  const usedBases = new Set(matches.map((m) => m.base_id))
  const freeTeams = teams.filter((t) => !usedTeams.has(t.id))
  const freeBases = bases.filter((x) => !usedBases.has(x.id))

  // Rivals that team A has not faced yet (in any round).
  const played = new Set(
    allMatches.filter((m) => m.team_a === a || m.team_b === a).flatMap((m) => [m.team_a, m.team_b]),
  )
  const rivals = freeTeams.filter((t) => t.id !== a && !played.has(t.id))

  async function add() {
    if (!supabase || !baseId || !a || !b) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from('matches')
      .insert({ event_id: eventId, base_id: baseId, round_number: round, team_a: a, team_b: b })
    if (err) setError(matchErrorMessage(err.message))
    else {
      setBaseId('')
      setA('')
      setB('')
      await onChange()
    }
    setBusy(false)
  }

  async function notify(m: MatchRow) {
    const message = await promptDialog({ title: 'Avisar a los grupos y a la base', message: 'Les llega como notificación y les suena el teléfono.', label: 'Mensaje', defaultValue: DEFAULT_ALERT_MESSAGE, confirmLabel: 'Enviar aviso', icon: 'bell' })
    if (!message) return
    setError(null)
    setNotice(null)
    const err = await sendMatchAlert(eventId, m.id, message)
    if (err) setError(err)
    else setNotice('Aviso enviado a los grupos y a la base.')
  }

  async function remove(m: MatchRow) {
    if (!supabase) return
    if (m.status !== 'pending' && !(await confirmDialog({ title: '¿Borrar este cruce?', message: 'Ya tiene puntos registrados: se borran con él.', confirmLabel: 'Borrar cruce', tone: 'danger', icon: 'trash' }))) return
    setBusy(true)
    const { error: err } = await supabase.from('matches').delete().eq('id', m.id)
    if (err) setError('No se pudo borrar el cruce.')
    else await onChange()
    setBusy(false)
  }

  const disabled = busy || parentBusy

  return (
    <section className="card">
      <h2>Ronda {round}</h2>
      {matches.length === 0 && <p className="muted">Sin cruces.</p>}
      <ul className="list">
        {matches.map((m) => (
          <li key={m.id}>
            <span className="grow">
              <strong>{baseName.get(m.base_id)}</strong>
              <span className="match-names">
                {teamName.get(m.team_a)} <span className="muted">vs</span> {teamName.get(m.team_b)}
              </span>
              <span className="meta">
                <span className={`badge ${m.status === 'finished' ? 'ok' : m.status === 'in_progress' ? 'ok live' : ''}`}>
                  {STATUS_LABEL[m.status]}
                </span>
                {m.arrived_at && <small className="muted">Llegaron a las {formatTime(m.arrived_at)}</small>}
              </span>
            </span>
            <button className="ghost icon-btn" disabled={disabled} onClick={() => void notify(m)} aria-label="Enviar aviso" title="Enviar aviso a los grupos y la base">
              <BellRing size={18} />
            </button>
            <button className="ghost danger icon-btn" disabled={disabled} onClick={() => void remove(m)} aria-label="Borrar cruce" title="Borrar cruce"><Trash2 size={18} /></button>
          </li>
        ))}
      </ul>

      {freeBases.length > 0 && freeTeams.length >= 2 && (
        <div className="form add-match">
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} aria-label="Base">
            <option value="">Base…</option>
            {freeBases.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={a} onChange={(e) => { setA(e.target.value); setB('') }} aria-label="Grupo A">
            <option value="">Grupo A…</option>
            {freeTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)} disabled={!a} aria-label="Grupo B">
            <option value="">{a && rivals.length === 0 ? 'Sin rivales nuevos' : 'Grupo B…'}</option>
            {rivals.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button disabled={disabled || !baseId || !a || !b} onClick={() => void add()}>Agregar cruce</button>
        </div>
      )}
      {notice && <p className="ok-text">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
