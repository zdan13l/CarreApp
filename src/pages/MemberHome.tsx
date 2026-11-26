import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import LoadFailed from '../components/LoadFailed'
import MemberPage from '../components/MemberPage'
import type { MemberPassportData, MemberRecord } from '../components/MemberPassport'
import type { MemberActions } from '../components/MemberProfile'
import { updateAccount } from '../lib/accountApi'
import { useAuth } from '../lib/auth'
import {
  missingColumn,
  PERSON_COLUMNS,
  PERSON_COLUMNS_BASE,
  type PassportContextRow,
  type PassportPerson,
  type PassportStampRow,
  type TermCommitteeRow,
} from '../lib/passports'
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

// What an inductor sees after signing in with their personal @: their passport and their profile. Nothing else: the group's or the base's
// own user is the one that enters the live Carrera.
export default function MemberHome() {
  const { profile } = useAuth()
  const [data, setData] = useState<MemberPassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const userId = profile?.id

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const sb = supabase
    // level 2: everything; 1: without the extra committees (migration 0027); 0: without the identity either (0024). The passport always opens.
    const read = async (level: 0 | 1 | 2) =>
      Promise.all([
        sb.from('passports').select(level > 0 ? PERSON_COLUMNS : PERSON_COLUMNS_BASE).eq('id', userId).maybeSingle(),
        level === 2
          ? sb.from('passport_records').select('id, passport_id, term_id, role, career, culture, team_id, base_id, committee, committee_lead, extra_committees, extra_leads, terms(id, name, theme, is_current, created_at, welcome)').eq('passport_id', userId)
          : level === 1
            ? sb.from('passport_records').select('id, passport_id, term_id, role, career, culture, team_id, base_id, committee, committee_lead, terms(id, name, theme, is_current, created_at, welcome)').eq('passport_id', userId)
            : sb.from('passport_records').select('id, passport_id, term_id, role, career, culture, team_id, base_id, terms(id, name, theme, is_current, created_at)').eq('passport_id', userId),
      ])
    let [p, r] = await read(2)
    if (missingColumn(r.error) && !missingColumn(p.error)) [p, r] = await read(1)
    if (missingColumn(p.error) || missingColumn(r.error)) [p, r] = await read(0)
    const [st, ctx, live, words] = await Promise.all([
      sb.from('passport_stamps').select('record_id, event_id, event_name, kind, base_name, base_key, round_number, stamped_at'),
      sb.rpc('my_passport_context'),
      sb.rpc('my_live_stamps'),
      sb.from('term_committees').select('term_id, committee, message'), // migration 0025: without it the words are simply missing
    ])
    if (p.error || r.error || st.error) {
      setFailed(true) // keep what is on screen: an empty passport would look like lost stamps
      setLoading(false)
      return
    }
    setFailed(false)
    const person = p.data as unknown as PassportPerson | null
    if (!person) {
      setLoading(false)
      return
    }
    // what the later migrations added is read apart, so the passport opens before they are applied: the song (0042), the career (0043) and the
    // other career of a double program (0044), how many inductions they have (0044, a view) and the inductions where their profile is disabled (0044)
    let apart: { song?: PassportPerson['song']; career?: string | null; second_career?: string | null } = {}
    for (const columns of ['song, career, second_career', 'song, career', 'song']) {
      const read1 = await sb.from('passports').select(columns).eq('id', userId).maybeSingle()
      if (!read1.error) {
        apart = (read1.data ?? {}) as typeof apart
        break
      }
    }
    person.song = apart.song ?? null
    person.career = apart.career ?? null
    person.second_career = apart.second_career ?? null
    const [counted, flags] = await Promise.all([
      sb.from('passport_inductions').select('inductions').eq('passport_id', userId).maybeSingle(),
      sb.from('passport_records').select('id, disabled').eq('passport_id', userId),
    ])
    person.inductions = counted.error ? null : ((counted.data as { inductions?: number } | null)?.inductions ?? 0)
    const disabled = new Set(flags.error ? [] : ((flags.data ?? []) as { id: string; disabled: boolean }[]).filter((x) => x.disabled).map((x) => x.id))
    const records = ((r.data ?? []) as unknown as RecordQuery[])
      .filter((x) => x.terms && !disabled.has(x.id)) // an induction where they were disabled has no pages: they did not take part in it
      .map(({ terms, ...rest }) => ({ ...rest, term: terms! }))
      .sort((a, b) => Number(b.term.is_current) - Number(a.term.is_current) || b.term.created_at.localeCompare(a.term.created_at))
    setData({
      person,
      records,
      stamps: mergeStamps((st.data ?? []) as PassportStampRow[], (live.data ?? []) as PassportStampRow[]),
      context: (ctx.data ?? []) as PassportContextRow[],
      committeeMessages: (words.data ?? []) as TermCommitteeRow[],
    })
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])
  // Ending or starting a Carrera changes the stamps (they are archived when it ends)
  useRealtimeReload(['events'], load, 2000)

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      setNotice(await action())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.')
    } finally {
      setBusy(false)
    }
  }

  const actions: MemberActions = {
    busy,
    error,
    notice,
    pdfBusy,
    changeUsername: (username, currentPassword) =>
      void run(async () => {
        await updateAccount({ current_password: currentPassword, username })
        await supabase!.auth.refreshSession() // the session now carries the new @: the screens read it again
        return `Listo: tu usuario ahora es @${username}. Úsalo la próxima vez que entres.`
      }),
    changePassword: (currentPassword, newPassword) =>
      void run(async () => {
        await updateAccount({ current_password: currentPassword, new_password: newPassword })
        return 'Contraseña cambiada. Úsala la próxima vez que entres.'
      }),
    downloadPdf: () => {
      if (!data) return
      setPdfBusy(true)
      setError(null)
      setNotice(null)
      void import('../lib/passportPdf')
        .then((m) => m.downloadPassportPdf(data))
        .then(() => setNotice('Tu pasaporte está listo.'))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo armar el PDF.'))
        .finally(() => setPdfBusy(false))
    },
  }

  if (data) return <MemberPage data={data} actions={actions} /> // if a refresh fails the passport stays on screen and the next poll tries again
  return (
    <AppShell title="Mi pasaporte" showTitle={false}>
      {loading ? (
        <p className="loading">Abriendo tu pasaporte…</p>
      ) : failed ? (
        <LoadFailed onRetry={() => void load()} />
      ) : (
        <div className="card">
          <h2>Sin pasaporte</h2>
          <p>Tu usuario existe pero todavía no tiene un pasaporte en ningún semestre. Avísale al coordi.</p>
        </div>
      )}
    </AppShell>
  )
}
