import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzeSchedule, generateSchedule, matchErrorMessage, type PlannedMatch } from '../../lib/schedule'
import { supabase } from '../../lib/supabase'
import { STATUS_LABEL, type MatchRow } from '../../types'
import { errMsg, useAdmin } from './AdminContext'

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
  const [proposal, setProposal] = useState<PlannedMatch[] | null>(null)
  const [roundsToGenerate, setRoundsToGenerate] = useState(3)
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
        .select('id, round_number, base_id, team_a, team_b, status')
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

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams])
  const baseName = useMemo(() => new Map(bases.map((b) => [b.id, b.name])), [bases])
  const analysis = useMemo(() => analyzeSchedule(matches, teams, bases), [matches, teams, bases])
  const proposalAnalysis = useMemo(
    () => (proposal ? analyzeSchedule(proposal, teams, bases) : null),
    [proposal, teams, bases],
  )

  if (!event) return <p className="warn">Primero crea una Carrera en "Resumen".</p>

  const maxRound = matches.reduce((max, m) => Math.max(max, m.round_number), 0)
  const roundCount = Math.max(maxRound, extraRounds, 1)
  const maxPossibleRounds = Math.max(teams.length - (teams.length % 2 === 0 ? 1 : 0), 1)

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

  function propose() {
    setProposal(
      generateSchedule(
        teams.map((t) => t.id),
        bases.map((b) => b.id),
        roundsToGenerate,
      ),
    )
  }

  function saveProposal() {
    if (!proposal || !supabase || !eventId) return
    const withScores = matches.some((m) => m.status !== 'pending')
    const msg = matches.length
      ? `Esto reemplaza los ${matches.length} cruces actuales${withScores ? ' y BORRA los puntos ya registrados' : ''}. ¿Continuar?`
      : null
    if (msg && !window.confirm(msg)) return
    void run(async () => {
      const del = await supabase!.from('matches').delete().eq('event_id', eventId)
      if (del.error) throw new Error('No se pudieron borrar los cruces actuales.')
      const { error: err } = await supabase!
        .from('matches')
        .insert(proposal.map((p) => ({ ...p, event_id: eventId })))
      if (err) throw new Error(matchErrorMessage(err.message))
      setProposal(null)
      setExtraRounds(0)
    })
  }

  function clearAll() {
    if (!supabase || !eventId || matches.length === 0) return
    const withScores = matches.some((m) => m.status !== 'pending')
    if (!window.confirm(`¿Borrar los ${matches.length} cruces${withScores ? ' y TODOS los puntos registrados' : ''}?`)) return
    void run(async () => {
      const { error: err } = await supabase!.from('matches').delete().eq('event_id', eventId)
      if (err) throw new Error('No se pudieron borrar los cruces.')
      setExtraRounds(0)
    })
  }

  const notEnough = teams.length < 2 || bases.length < 1

  return (
    <>
      <h1>Cruces y rotación</h1>
      <p className="muted">
        {teams.length} grupos · {bases.length} bases · {matches.length} cruces en {maxRound} rondas.
        Cada pareja de grupos solo puede enfrentarse una vez; la app lo valida.
      </p>
      {error && <p className="error">{error}</p>}

      {notEnough ? (
        <p className="warn">Necesitas al menos 2 grupos y 1 base para armar cruces.</p>
      ) : (
        <section className="card">
          <h2>Generar propuesta automática</h2>
          <p className="muted">
            Reparte los grupos para que nadie repita rival ni se cruce en dos bases a la vez, y rota las bases.
            Con {teams.length} grupos puedes tener hasta {maxPossibleRounds} rondas sin repetir rivales.
            Puedes ajustar a mano después.
          </p>
          <div className="row">
            <label className="inline-field grow">
              Rondas a generar
              <input
                type="number"
                min={1}
                max={maxPossibleRounds}
                value={roundsToGenerate}
                onChange={(e) => setRoundsToGenerate(Math.max(1, Math.min(maxPossibleRounds, Number(e.target.value) || 1)))}
              />
            </label>
            <button disabled={busy} onClick={propose}>Ver propuesta</button>
          </div>

          {proposal && proposalAnalysis && (
            <div className="proposal">
              <h3>Propuesta ({proposal.length} cruces)</h3>
              {Array.from({ length: Math.max(...proposal.map((p) => p.round_number), 0) }, (_, i) => i + 1).map((r) => (
                <div key={r}>
                  <strong>Ronda {r}</strong>
                  <ul className="list">
                    {proposal.filter((p) => p.round_number === r).map((p) => (
                      <li key={p.base_id}>
                        <span className="grow">{teamName.get(p.team_a)} vs {teamName.get(p.team_b)}</span>
                        <span className="badge idle">{baseName.get(p.base_id)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {proposalAnalysis.warnings.length > 0 && (
                <div className="warn">
                  <strong>Ojo:</strong>
                  <ul>{proposalAnalysis.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              )}
              <div className="row">
                <button disabled={busy || proposal.length === 0} onClick={saveProposal}>
                  {matches.length ? 'Guardar (reemplaza los cruces actuales)' : 'Guardar propuesta'}
                </button>
                <button className="ghost" onClick={() => setProposal(null)}>Descartar</button>
              </div>
            </div>
          )}
        </section>
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
          <div className="grid">
            {Array.from({ length: roundCount }, (_, i) => i + 1).map((r) => (
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
            <button className="ghost" onClick={() => setExtraRounds(roundCount + 1)}>+ Agregar ronda</button>
            {matches.length > 0 && <button className="ghost danger" disabled={busy} onClick={clearAll}>Borrar todos los cruces</button>}
          </div>
        </>
      )}
    </>
  )
}

function RoundCard({
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

  async function remove(m: MatchRow) {
    if (!supabase) return
    if (m.status !== 'pending' && !window.confirm('Este cruce ya tiene puntos registrados. ¿Borrarlo con sus puntos?')) return
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
              <br />
              {teamName.get(m.team_a)} vs {teamName.get(m.team_b)}
              <small className="muted"> · {STATUS_LABEL[m.status]}</small>
            </span>
            <button className="ghost danger" disabled={disabled} onClick={() => void remove(m)} aria-label="Borrar cruce">✕</button>
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
      {error && <p className="error">{error}</p>}
    </section>
  )
}
