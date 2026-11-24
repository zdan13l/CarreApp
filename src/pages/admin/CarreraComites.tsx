import SectionSeals from '../../components/SectionSeals'
import type { SealKind } from '../../lib/eventSeals'
import { useCallback, useEffect, useState } from 'react'
import CommitteeSeal from '../../components/CommitteeSeal'
import EventSealView from '../../components/EventSealView'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { allCommittees, committeesOfRecord } from '../../lib/committees'
import { loadEventSeals, type EventSeal } from '../../lib/eventSeals'
import { supabase } from '../../lib/supabase'
import { errMsg, useAdmin } from './AdminContext'

interface Rec {
  id: string
  role: string
  committee: string | null
  committee_lead: boolean
  extra_committees: string[]
  extra_leads: string[]
  passports: { full_name: string; username: string } | null
}
interface Person { id: string; full_name: string; username: string }

// The coordi and the committees of THIS carrera. The committees themselves are global (Administración global → Comités); what is particular of an
// edition is which ones take part, who coordinates each one and who the coordi of the carrera is. Nothing is inherited from the previous carrera.
const SEAL_KINDS: SealKind[] = ['committee']
export default function CarreraComites() {
  useCatalogVersion()
  const { event, reload } = useAdmin()
  const [records, setRecords] = useState<Rec[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [seals, setSeals] = useState<EventSeal[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const eventId = event?.id
  const termId = event?.term_id
  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const ec = await supabase.from('event_committees').select('committee_key').eq('event_id', eventId)
    if (ec.error) return setMissing(true)
    setAssigned(new Set((ec.data ?? []).map((x) => x.committee_key as string)))
    const [pp, rec] = await Promise.all([
      supabase.from('passports').select('id, full_name, username').order('full_name'),
      termId
        ? supabase.from('passport_records').select('id, role, committee, committee_lead, extra_committees, extra_leads, passports(full_name, username)').eq('term_id', termId)
        : Promise.resolve({ data: [] }),
    ])
    setPeople((pp.data ?? []) as Person[])
    setRecords((rec.data ?? []) as unknown as Rec[])
    setSeals(await loadEventSeals(eventId))
    await loadCatalog()
  }, [eventId, termId])
  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      await reload()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  if (!event) return null
  if (missing) return <p className="warn">Falta aplicar la migración 0037 (comités y coordi por carrera).</p>
  const locked = event.phase === 'archived'
  const coordinator = people.find((p) => p.id === event.coordinator_id)
  const goldSeal = seals.find((s) => s.kind === 'coordinator')
  const coordisOf = (key: string) => records.filter((r) => committeesOfRecord(r).some((c) => c.key === key && c.lead))

  function setCarreraCoordi(personId: string) {
    if (!supabase || !eventId) return
    void run(async () => {
      const { error: err } = await supabase!.from('events').update({ coordinator_id: personId || null }).eq('id', eventId)
      if (err) throw new Error('No se pudo cambiar el coordi de la carrera.')
      // in this carrera's semester they are the coordi (if they take part in it)
      if (personId && termId) await supabase!.from('passport_records').update({ role: 'coordinator', team_id: null, base_id: null }).eq('passport_id', personId).eq('term_id', termId)
    })
  }

  function toggle(key: string, on: boolean) {
    if (!supabase || !eventId) return
    void run(async () => {
      const { error: err } = on
        ? await supabase!.from('event_committees').insert({ event_id: eventId, committee_key: key })
        : await supabase!.from('event_committees').delete().eq('event_id', eventId).eq('committee_key', key)
      if (err) throw new Error('No se pudo cambiar el comité de esta carrera.')
    })
  }

  // the new coordi of a committee takes the golden stamp; the old ones give it up (only in THIS carrera's semester)
  function setCoordi(key: string, recordId: string) {
    const next = records.find((r) => r.id === recordId)
    if (!supabase || !next) return
    void run(async () => {
      for (const old of coordisOf(key)) {
        if (old.id === next.id) continue
        const patch = old.committee === key ? { committee_lead: false } : { extra_leads: old.extra_leads.filter((k) => k !== key) }
        const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', old.id)
        if (err) throw new Error('No se pudo quitar al coordi anterior.')
      }
      let patch: Record<string, unknown>
      if (next.committee === key) patch = { committee_lead: true }
      else if (next.extra_committees.includes(key)) patch = { extra_leads: [...new Set([...next.extra_leads, key])] }
      else if (!next.committee) patch = { committee: key, committee_lead: true }
      else patch = { extra_committees: [...next.extra_committees, key], extra_leads: [...next.extra_leads, key] }
      const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', next.id)
      if (err) throw new Error('No se pudo poner al coordi nuevo.')
    })
  }

  const committees = allCommittees().filter((c) => c.active !== false || assigned.has(c.key))
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Preparación · 6</p>
          <h1>Coordi y comités</h1>
        </div>
        <p className="head-meta">El coordi y los comités cambian de una carrera a otra y no se heredan.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="card committee-card">
        <EventSealView shape={goldSeal?.shape ?? 'circle'} color={goldSeal?.color ?? 'currentColor'} gold size={84} initial={coordinator?.full_name} label="Sello dorado del coordi" />
        <div className="committee-body">
          <h2>Coordi de la carrera</h2>
          {coordinator ? <p><strong>{coordinator.full_name}</strong> (@{coordinator.username}): recibe el sello dorado.</p> : <p className="warn">Esta carrera todavía no tiene coordi: elige uno para que reciba el sello dorado.</p>}
          <select value={event.coordinator_id ?? ''} disabled={busy || locked} onChange={(e) => setCarreraCoordi(e.target.value)} aria-label="Coordi de la carrera">
            <option value="">Sin coordi</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>)}
          </select>
        </div>
      </section>

      <h2 className="section-title">Comités de esta carrera</h2>
      <div className="committee-list">
        {committees.map((c) => {
          const on = assigned.has(c.key)
          const coordis = coordisOf(c.key)
          return (
            <section key={c.key} className={`card committee-card${on ? '' : ' off'}`}>
              <CommitteeSeal committee={c.key} lead={on && coordis.length > 0} size={84} label={`Sello de ${c.name}`} />
              <div className="committee-body">
                <label className="inline-field">
                  <span><input type="checkbox" checked={on} disabled={busy || locked} onChange={(e) => toggle(c.key, e.target.checked)} /> <strong>{c.name}</strong> participa en esta carrera</span>
                </label>
                {on && (
                  <div className="committee-coordi">
                    {coordis.length === 0 ? <p className="warn">Sin coordi en esta carrera: elige uno.</p> : <p><strong>Coordi{coordis.length > 1 ? 's' : ''}:</strong> {coordis.map((r) => r.passports?.full_name).join(', ')}</p>}
                    <select value="" disabled={busy || locked || records.length === 0} onChange={(e) => e.target.value && setCoordi(c.key, e.target.value)} aria-label={`Coordi de ${c.name}`}>
                      <option value="">{records.length === 0 ? 'Primero agrega inductores a esta carrera' : coordis.length ? 'Cambiar coordi…' : 'Elegir coordi…'}</option>
                      {[...records]
                        .sort((a, b) => (a.passports?.full_name ?? '').localeCompare(b.passports?.full_name ?? '', 'es'))
                        .filter((r) => !coordis.some((x) => x.id === r.id))
                        .map((r) => <option key={r.id} value={r.id}>{r.passports?.full_name} (@{r.passports?.username})</option>)}
                    </select>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
      <SectionSeals event={event} kinds={SEAL_KINDS} title="Sellos de los comités de esta carrera" />
    </>
  )
}
