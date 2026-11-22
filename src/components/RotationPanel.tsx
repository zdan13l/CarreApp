import { BellRing, CircleCheck, Shuffle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from '../lib/dialog'
import { useRealtimeReload } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { sendMatchAlert } from './DelaysPanel'

export const ROTATION_MESSAGE = 'Ya pueden rotar: deja ir a los dos grupos y confírmalo en la app.'

interface Rotation {
  id: string
  round_number: number
}

// The coordinator's side of the rotation: when every base has finished (the stages are played first) it tells them all they can rotate, and
// sees how many bases already let their groups go. That way the groups reach the next base at a similar distance.
export default function RotationPanel({
  eventId,
  round,
  matches,
  baseName,
}: {
  eventId: string
  round: number
  matches: { id: string; round_number: number; base_id: string }[]
  baseName: Map<string, string>
}) {
  const [rotation, setRotation] = useState<Rotation | null>(null)
  const [acked, setAcked] = useState<Set<string>>(new Set())
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inRound = matches.filter((m) => m.round_number === round)
  const baseIds = [...new Set(inRound.map((m) => m.base_id))]

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error: err } = await supabase.from('round_rotations').select('id, round_number').eq('event_id', eventId).eq('round_number', round).maybeSingle()
    if (err) {
      setMissing(true) // migration 0029 is not applied yet
      return
    }
    setMissing(false)
    setRotation((data as Rotation | null) ?? null)
    if (data) {
      const a = await supabase.from('rotation_acks').select('base_id').eq('rotation_id', (data as Rotation).id)
      setAcked(new Set((a.data ?? []).map((x) => x.base_id as string)))
    } else setAcked(new Set())
  }, [eventId, round])

  useEffect(() => {
    void load()
  }, [load])
  useRealtimeReload(['round_rotations', 'rotation_acks'], load)

  async function announce() {
    if (!supabase) return
    const ok = await confirmDialog({
      title: `¿Avisar a las bases que ya pueden rotar?`,
      message: `Ronda ${round}. Cada base confirmará cuando haya dejado ir a sus dos grupos.`,
      details: baseIds.map((b) => baseName.get(b) ?? '').filter(Boolean),
      confirmLabel: 'Avisar a las bases',
      icon: 'bell',
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('round_rotations').insert({ event_id: eventId, round_number: round })
    if (err && !/duplicate|unique/i.test(err.message)) setError('No se pudo enviar el aviso.')
    else await Promise.all(inRound.map((m) => sendMatchAlert(eventId, m.id, ROTATION_MESSAGE, 'base'))) // rings the phone of each base; the card stays even if one fails
    await load()
    setBusy(false)
  }

  if (missing) return <p className="warn" role="status">Falta aplicar la migración <span className="mono">0029_round_rotations.sql</span> para avisar la rotación.</p>
  if (baseIds.length === 0) return null

  const done = baseIds.filter((b) => acked.has(b)).length
  const waiting = baseIds.filter((b) => !acked.has(b)).map((b) => baseName.get(b) ?? '—')
  return (
    <section className="card rotation-card" aria-label="Rotación de las bases">
      <h2>
        <Shuffle size={18} aria-hidden="true" /> Rotación · ronda {round}
      </h2>
      {!rotation ? (
        <>
          <p className="muted">Cuando todas las bases terminen sus etapas, avísales que ya pueden rotar.</p>
          {error && <p className="error">{error}</p>}
          <button type="button" disabled={busy} onClick={() => void announce()}>
            <BellRing size={19} aria-hidden="true" />
            {busy ? 'Enviando…' : 'Avisar que ya pueden rotar'}
          </button>
        </>
      ) : (
        <div className="rotation-progress">
          <p>
            {done === baseIds.length ? <CircleCheck size={18} aria-hidden="true" /> : null} <strong>{done} de {baseIds.length}</strong> bases ya dejaron ir a sus grupos
          </p>
          <div className="rotation-bar" role="progressbar" aria-valuemin={0} aria-valuemax={baseIds.length} aria-valuenow={done} aria-label="Bases que ya rotaron">
            <i style={{ width: `${(done / baseIds.length) * 100}%` }} />
          </div>
          {waiting.length > 0 && <p className="rotation-waiting">Faltan: {waiting.join(', ')}</p>}
        </div>
      )}
    </section>
  )
}
