import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import LoadFailed from '../components/LoadFailed'
import MemberPage from '../components/MemberPage'
import type { MemberPassportData, MemberRecord } from '../components/MemberPassport'
import { useAuth } from '../lib/auth'
import type { PassportContextRow, PassportPerson, PassportStampRow } from '../lib/passports'
import { useRealtimeReload } from '../lib/realtime'
import { supabase } from '../lib/supabase'

type RecordQuery = Omit<MemberRecord, 'term'> & { terms: (MemberRecord['term'] & { created_at: string }) | null }

/** The stamps of Carreras that already ended (kept for ever) and those of the Carrera that is running, without repeating any. */
export function mergeStamps(kept: PassportStampRow[], live: PassportStampRow[]): PassportStampRow[] {
  const key = (s: PassportStampRow) => `${s.record_id}|${s.event_id ?? s.event_name}|${s.kind}|${s.round_number}`
  const map = new Map(kept.map((s) => [key(s), s]))
  for (const s of live) map.set(key(s), s) // what is happening now wins over an old copy of the same Carrera
  return [...map.values()]
}

// What an inductor sees after signing in with their personal @: their passport. Nothing else: the group's or the base's own
// user is the one that enters the live Carrera.
export default function MemberHome() {
  const { profile } = useAuth()
  const [data, setData] = useState<MemberPassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const [p, r, st, ctx, live] = await Promise.all([
      supabase.from('passports').select('id, username, full_name, photo_path').eq('id', userId).maybeSingle(),
      supabase
        .from('passport_records')
        .select('id, passport_id, term_id, role, career, culture, team_id, base_id, terms(id, name, theme, is_current, created_at)')
        .eq('passport_id', userId),
      supabase.from('passport_stamps').select('record_id, event_id, event_name, kind, base_name, base_key, round_number, stamped_at'),
      supabase.rpc('my_passport_context'),
      supabase.rpc('my_live_stamps'),
    ])
    if (p.error || r.error || st.error) {
      setFailed(true) // keep what is on screen: an empty passport would look like lost stamps
      setLoading(false)
      return
    }
    setFailed(false)
    const person = p.data as PassportPerson | null
    if (!person) {
      setLoading(false)
      return
    }
    const records = ((r.data ?? []) as unknown as RecordQuery[])
      .filter((x) => x.terms)
      .map(({ terms, ...rest }) => ({ ...rest, term: terms! }))
      .sort((a, b) => Number(b.term.is_current) - Number(a.term.is_current) || b.term.created_at.localeCompare(a.term.created_at))
    setData({
      person,
      records,
      stamps: mergeStamps((st.data ?? []) as PassportStampRow[], (live.data ?? []) as PassportStampRow[]),
      context: (ctx.data ?? []) as PassportContextRow[],
    })
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])
  // Ending or starting a Carrera changes the stamps (they are archived when it ends)
  useRealtimeReload(['events'], load, 2000)

  if (data) return <MemberPage data={data} /> // if a refresh fails the passport stays on screen and the next poll tries again
  return (
    <AppShell title="Mi pasaporte" showTitle={false}>
      {loading ? (
        <p className="loading">Abriendo tu pasaporte…</p>
      ) : failed ? (
        <LoadFailed onRetry={() => void load()} />
      ) : (
        <div className="card">
          <h2>Sin pasaporte</h2>
          <p>Tu usuario existe pero todavía no tiene un pasaporte en ningún semestre. Avísale al coordinador.</p>
        </div>
      )}
    </AppShell>
  )
}
