import { BellRing, CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useNow } from '../lib/alerts'
import { DEFAULT_ALERT_MESSAGE, lateTeams, type TimedMatch } from '../lib/delays'
import { distanceMeters } from '../lib/geo'
import { formatDistance } from '../lib/mapbox'
import { supabase } from '../lib/supabase'

export async function sendMatchAlert(eventId: string, matchId: string, message: string, target: 'groups' | 'base' = 'groups'): Promise<string | null> {
  if (!supabase) return 'Supabase no está configurado.'
  const { error } = await supabase.from('alerts').insert({ event_id: eventId, match_id: matchId, message: message.trim(), ...(target === 'base' ? { target } : {}) })
  return error ? 'No se pudo enviar el aviso.' : null
}

// Coordinator view of the groups that are taking too long between bases, with a button to alert
// the groups and the base of each delayed match.
export default function DelaysPanel({
  eventId,
  matches,
  maxMinutes,
  teamName,
  baseName,
  baseCoords,
  teamCoords,
  travel,
}: {
  eventId: string
  matches: TimedMatch[]
  maxMinutes: number
  teamName: Map<string, string>
  baseName: Map<string, string>
  baseCoords?: Map<string, [number, number]>
  teamCoords?: Map<string, [number, number]>
  travel?: Map<string, number>
}) {
  const now = useNow()
  const late = lateTeams(matches, maxMinutes, now, travel)
  const matchIds = [...new Set(late.map((l) => l.matchId))]
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  async function alert(matchId: string) {
    const message = window.prompt('Mensaje para los grupos y la base de este cruce:', DEFAULT_ALERT_MESSAGE)
    if (!message?.trim()) return
    setError(null)
    const err = await sendMatchAlert(eventId, matchId, message)
    if (err) setError(err)
    else setSent((prev) => new Set(prev).add(matchId))
  }

  return (
    <section className="card delay-list">
      <h2>Demoras en el traslado</h2>
      {matchIds.length === 0 ? (
        <p className="ok-box">
          Ningún grupo ha superado su tiempo de traslado entre bases.
        </p>
      ) : (
        <ul className="list">
          {matchIds.map((matchId) => {
            const m = matches.find((x) => x.id === matchId)!
            const base = baseCoords?.get(m.base_id)
            return (
              <li key={matchId}>
                <span className="grow">
                  <strong>
                    Ronda {m.round_number} · {baseName.get(m.base_id)}
                  </strong>
                  {late
                    .filter((l) => l.matchId === matchId)
                    .map((l) => {
                      const pos = teamCoords?.get(l.teamId)
                      return (
                        <span key={l.teamId} className="match-names">
                          {teamName.get(l.teamId)}: <span className="late">{l.elapsedMin} min</span> (máx. {l.maxMin})
                          <small className="muted">
                            {pos && base ? ` · a ${formatDistance(distanceMeters(pos, base))} de la base` : ''}
                          </small>
                        </span>
                      )
                    })}
                </span>
                <button className="ghost" onClick={() => void alert(matchId)} disabled={sent.has(matchId)}>
                  {sent.has(matchId) ? (
                    <>
                      <CircleCheck size={17} aria-hidden="true" /> Avisado
                    </>
                  ) : (
                    <>
                      <BellRing size={17} aria-hidden="true" /> Avisar
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
