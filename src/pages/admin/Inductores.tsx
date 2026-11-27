import PageTitle from './PageTitle'
import { Copy, Feather, FileSpreadsheet, GraduationCap, HeartHandshake, Lock, KeyRound, Music, Pencil, RotateCcw, Search, Trash2, UserPlus, UserX, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Avatar from '../../components/Avatar'
import FilterBar, { type ChipGroup } from '../../components/FilterBar'
import InductorsBulk from '../../components/InductorsBulk'
import NewInductorForm from '../../components/NewInductorForm'
import PersonEditor from '../../components/PersonEditor'
import { Audition } from '../../components/SongCell'
import { confirmDialog } from '../../lib/dialog'
import {
  careerOfPerson,
  hasFilters,
  inductionCounts,
  inductionsLabel,
  latestCareers,
  matchesSearch,
  NO_FILTERS,
  passesFilters,
  shortCareer,
  STATE_LABEL,
  type Filters,
  type IdentityPatch,
  type PersonState,
} from '../../lib/inductors'
import {
  newPassword,
  PASSPORT_ROLE_LABEL,
  PASSPORT_ROLES,
  missingColumn,
  PERSON_COLUMNS,
  PERSON_COLUMNS_BASE,
  RECORD_COLUMNS,
  RECORD_COLUMNS_0024,
  RECORD_COLUMNS_BASE,
  type PassportPerson,
  type PassportRecordRow,
  type PassportRole,
  type TermRow,
} from '../../lib/passports'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { COMMITTEES } from '../../lib/committees'
import { GENERATIONS, generationsOf } from '../../lib/seals'
import { useCatalogVersion } from '../../lib/catalogStore'
import type { PassportSong } from '../../lib/songs'
import { cultureOf, themeOf, type CultureKey } from '../../lib/themes'
import { deleteUser, renameUser, resetPassword } from '../../lib/usersApi'
import { errMsg } from './AdminContext'

export interface PersonRow {
  passport: PassportPerson
  record: PassportRecordRow | null // the record of the semester that is open (null: this person is not in it)
}

interface LinkOption {
  id: string
  label: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const missingTable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '42P01' || e.code === 'PGRST205' || /passports|terms|passport_records/.test(e.message ?? '')))

// ---------- presentational pieces (also used by the design preview) ----------

export function PersonItem({
  person,
  themeKey,
  teams,
  bases,
  busy,
  onRole,
  onLink,
  onCulture,
  onCommittee,
  onLead,
  onExtra,
  onIdentity,
  onPhoto,
  onReset,
  onDelete,
  onAncestor,
  onReactivate,
  onDisable,
  view = 'global',
  onRemove,
  onToggleDisabled,
  career,
  careers = [],
  usernames,
  startEditing = false,
}: {
  person: PersonRow
  themeKey: string
  teams: LinkOption[]
  bases: LinkOption[]
  busy: boolean
  onRole: (role: PassportRole) => void
  onLink: (id: string | null) => void
  onCulture: (culture: CultureKey) => void
  onCommittee: (committee: string | null) => void
  onLead: (lead: boolean) => void
  onExtra: (committee: string, to: 'off' | 'member' | 'lead') => void
  onIdentity: (patch: IdentityPatch) => Promise<string | null> | void // the message of what went wrong, null when it was saved
  onPhoto: (file: File) => void
  onReset: () => void
  onDelete: () => void
  onAncestor?: () => void
  onReactivate?: () => void
  onDisable?: () => void
  // the same person is shown in two places and each one edits only what is its own:
  //   'global'  (Administración global → Inductores): the PERSON: profile (name, career, generation, nickname, song, photo), password, ancestor, delete
  //   'carrera' (inside a carrera): their PARTICIPATION in that edition: role, culture, committees, group or base, and removing them from it
  view?: 'global' | 'carrera'
  onRemove?: () => void // carrera: take them out of this edition (the person stays in the system)
  onToggleDisabled?: () => void // carrera: disable / enable their profile in this edition (a disabled one does not count as an induction of theirs)
  career?: string | null // the career of the person (the one of their passport, or of their latest participation)
  careers?: string[] // the careers of the catalog, to choose one when editing
  usernames?: Set<string> // every @ in use, so editing one cannot repeat it
  startEditing?: boolean
}) {
  const { passport: p, record: r } = person
  const status = p.status ?? 'active'
  const locked = status !== 'active' // an ancestor or a disabled profile is not edited: it is reactivated first
  const [editing, setEditing] = useState(startEditing && !locked)
  const [editError, setEditError] = useState<string | null>(null)
  const theme = themeOf(themeKey)
  const culture = r ? cultureOf(themeKey, r.culture) : null
  const generations = generationsOf(p.generation).map((g) => g.name).join(' / ') || (p.generation ? `${p.generation} (sin elegir)` : '')
  const shownCareer = career ?? r?.career ?? null

  async function save(patch: IdentityPatch) {
    setEditError(null)
    const message = await onIdentity(patch)
    if (message) setEditError(message)
    else setEditing(false)
  }

  return (
    <li className={`person${editing ? ' is-editing' : ''}${status !== 'active' ? ` is-${status}` : ''}`}>
      <Avatar name={p.full_name} photoPath={p.photo_path} size={46} />
      <span className="grow person-main">
        <strong>
          <span className="person-name">
            {p.full_name}
            {p.nickname && <span className="nick"> «{p.nickname}»</span>}
          </span>
          {status === 'ancestor' && <span className="badge ancestor"> Ancestro{p.disable_at ? ` · hasta ${new Date(p.disable_at).toLocaleDateString('es-CO')}` : ''}</span>}
          {status === 'disabled' && <span className="badge off"> Deshabilitado</span>}
          {view === 'carrera' && r?.disabled && <span className="badge off"> Deshabilitado en esta carrera</span>}
        </strong>
        <small className="muted person-meta">
          <span className="mono">@{p.username}</span>
          {shownCareer && <span>{shownCareer}{p.second_career ? ` + ${p.second_career}` : ''}</span>}
          {view === 'global' && generations && <span>{generations}</span>}
          {view === 'global' && p.joined_term && <span>Ingresó {p.joined_term}</span>}
          {view === 'global' && p.inductions != null && <span className="inductions-meta">{inductionsLabel(p.inductions)}</span>}
        </small>
        {view === 'global' && p.song && (
          <span className="person-song">
            <Music size={14} aria-hidden="true" />
            <span className="grow"><strong>{p.song.title}</strong> <small className="muted">{p.song.artist}</small></span>
            <Audition song={p.song} />
          </span>
        )}
        {view === 'global' && status === 'ancestor' && (
          <span className="farewell">
            <Feather size={15} aria-hidden="true" />
            <span>Gracias por todo lo que diste a la inducción, este perfil queda solo para visualizarse.</span>
          </span>
        )}
        {view === 'global' && status === 'disabled' && (
          <span className="farewell off">
            <Lock size={14} aria-hidden="true" />
            <span>Perfil deshabilitado: solo se puede ver.</span>
          </span>
        )}
        {view === 'carrera' &&
          (r ? (
            <span className="person-edit">
              <select value={r.role} disabled={busy} onChange={(e) => onRole(e.target.value as PassportRole)} aria-label={`Papel de ${p.full_name}`}>
                {PASSPORT_ROLES.map((x) => (
                  <option key={x} value={x} disabled={x === 'coordinator' && r.role !== 'coordinator'}>{PASSPORT_ROLE_LABEL[x]}{x === 'coordinator' && r.role !== 'coordinator' ? ' (se elige en Coordi y comités)' : ''}</option>
                ))}
              </select>
              <select value={r.culture} disabled={busy} onChange={(e) => onCulture(e.target.value as CultureKey)} aria-label={`Cultura de ${p.full_name}`} className={`culture-pick culture-${culture?.key}`}>
                {theme.cultures.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </select>
              <select value={r.committee ?? ''} disabled={busy} onChange={(e) => onCommittee(e.target.value || null)} aria-label={`Comité de ${p.full_name}`}>
                <option value="">Sin comité</option>
                {COMMITTEES.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </select>
              {r.committee && (
                <label className="lead-check">
                  <input type="checkbox" checked={Boolean(r.committee_lead)} disabled={busy} onChange={(e) => onLead(e.target.checked)} />
                  Coordina el comité
                </label>
              )}
              <span className="extra-committees" role="group" aria-label={`Otros comités de ${p.full_name}`}>
                {COMMITTEES.filter((c) => c.key !== r.committee).map((c) => {
                  const on = (r.extra_committees ?? []).includes(c.key)
                  const lead = (r.extra_leads ?? []).includes(c.key)
                  return (
                    <button key={c.key} type="button" className={`chip-toggle${on ? ' on' : ''}${lead ? ' lead' : ''}`} aria-pressed={on} disabled={busy} onClick={() => onExtra(c.key, !on ? 'member' : lead ? 'off' : 'lead')} title="Toca para cambiar: no está, miembro, coordina">
                      {c.name}{lead ? ' · coordina' : on ? ' · miembro' : ''}
                    </button>
                  )
                })}
              </span>
              {r.role === 'runner' && (
                <select value={r.team_id ?? ''} disabled={busy || r.disabled} onChange={(e) => onLink(e.target.value || null)} aria-label={`Grupo de ${p.full_name}`}>
                  <option value="">Sin grupo</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              )}
              {r.role === 'base' && (
                <select value={r.base_id ?? ''} disabled={busy || r.disabled} onChange={(e) => onLink(e.target.value || null)} aria-label={`Base de ${p.full_name}`}>
                  <option value="">Sin base</option>
                  {bases.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              )}
            </span>
          ) : (
            <small className="muted">No está en este semestre.</small>
          ))}
      </span>
      {view === 'global' && (
        <span className="person-actions">
          {!locked && (
            <button type="button" className={`ghost${editing ? ' danger' : ''}`} disabled={busy} aria-expanded={editing} onClick={() => { setEditing(!editing); setEditError(null) }}>
              <Pencil size={16} aria-hidden="true" /> {editing ? 'Cerrar' : 'Editar perfil'}
            </button>
          )}
          {status === 'active' && onAncestor && (
            <button className="ghost icon-btn" disabled={busy} onClick={onAncestor} aria-label={`Marcar a ${p.full_name} como ancestro`} title="Ancestro">
              <GraduationCap size={18} />
            </button>
          )}
          {status !== 'active' && onReactivate && (
            <button className="ghost icon-btn" disabled={busy} onClick={onReactivate} aria-label={`Reactivar a ${p.full_name}`} title="Volver a activarlo">
              <RotateCcw size={18} />
            </button>
          )}
          {status === 'ancestor' && onDisable && (
            <button className="ghost danger icon-btn" disabled={busy} onClick={onDisable} aria-label={`Deshabilitar a ${p.full_name}`} title="Deshabilitar">
              <UserX size={18} />
            </button>
          )}
          <button className="ghost icon-btn" disabled={busy} onClick={onReset} aria-label={`Nueva contraseña de ${p.full_name}`} title="Nueva contraseña">
            <KeyRound size={18} />
          </button>
          <button className="ghost danger icon-btn" disabled={busy} onClick={onDelete} aria-label={`Eliminar a ${p.full_name}`} title="Eliminar el pasaporte">
            <Trash2 size={18} />
          </button>
        </span>
      )}
      {view === 'carrera' && r && (onToggleDisabled || onRemove) && (
        <span className="person-actions">
          {onToggleDisabled && (
            <button className="ghost" disabled={busy} onClick={onToggleDisabled} title={r.disabled ? 'Volver a contarlo en esta carrera' : 'No puede estar en esta carrera: no cuenta como una de sus inducciones'}>
              {r.disabled ? <RotateCcw size={16} aria-hidden="true" /> : <UserX size={16} aria-hidden="true" />} {r.disabled ? 'Habilitar en la carrera' : 'Deshabilitar en la carrera'}
            </button>
          )}
          {onRemove && <button className="ghost danger" disabled={busy} onClick={onRemove} title="Quitarlo de esta carrera (la persona sigue en el sistema)">Quitar de la carrera</button>}
        </span>
      )}
      {view === 'global' && editing && !locked && (
        <div className="person-editor-slot">
          <PersonEditor person={p} career={shownCareer} careers={careers} usernames={usernames} busy={busy} error={editError} onSave={(patch) => void save(patch)} onPhoto={onPhoto} onClose={() => { setEditing(false); setEditError(null) }} />
        </div>
      )}
    </li>
  )
}

// The coordinator's list of inductors. Global (Administración global → Inductores): the ONLY place where people are registered, one by one or with
// an Excel, and where their profile is edited; inside a carrera (`fixedTermId`) it only lists who takes part in that edition and with what role.
export default function Inductores({ fixedTermId }: { fixedTermId?: string | null } = {}) {
  useCatalogVersion() // the committees and cultures are the ones the coordinator keeps
  const [terms, setTerms] = useState<TermRow[]>([])
  const [termId, setTermId] = useState<string | null>(null)
  const [passports, setPassports] = useState<PassportPerson[]>([])
  const [records, setRecords] = useState<PassportRecordRow[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string; event: string }[]>([])
  const [termEvents, setTermEvents] = useState<string[]>([]) // the Carreras of the open semester
  const [eventId, setEventId] = useState<string | null>(null) // the newest carrera of that semester: where the active inductors are summed
  const [notice, setNotice] = useState<string | null>(null)
  const [bases, setBases] = useState<{ id: string; name: string; event: string }[]>([])
  const [usernames, setUsernames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [missingSql, setMissingSql] = useState(false)
  const [missing0024, setMissing0024] = useState(false) // committee, generation… need migration 0024
  const [missing0025, setMissing0025] = useState(false) // the words of the induction need migration 0025
  const [missing0027, setMissing0027] = useState(false) // the extra committees need migration 0027
  const [missing0043, setMissing0043] = useState(false) // the career of each person needs migration 0043
  const [missing0045, setMissing0045] = useState(false) // the inductions a person already had and the automatic entry need migration 0045
  const [missing0047, setMissing0047] = useState(false) // the birthday needs migration 0047
  const [missing0044, setMissing0044] = useState(false) // the other career, the count of inductions and the disabled profiles need migration 0044
  const [welcome, setWelcome] = useState('')
  const [committeeWords, setCommitteeWords] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creds, setCreds] = useState<{ username: string; password: string; label: string } | null>(null)
  const [panel, setPanel] = useState<'new' | 'bulk' | null>(null)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [search, setSearch] = useState('')
  const [careerNames, setCareerNames] = useState<string[]>([])
  const [latest, setLatest] = useState<Map<string, string>>(new Map()) // person -> the career of their latest participation (before 0043 it is all there is)
  const [joinId, setJoinId] = useState('')
  const isCarrera = Boolean(fixedTermId)

  const term = terms.find((t) => t.id === termId) ?? null

  const load = useCallback(async () => {
    if (!supabase) return
    type TermsResult = { data: TermRow[] | null; error: { code?: string; message?: string } | null }
    let t = (await supabase.from('terms').select('id, name, theme, is_current, created_at, welcome').order('created_at', { ascending: false })) as unknown as TermsResult
    setMissing0025(missingColumn(t.error))
    if (missingColumn(t.error)) t = (await supabase.from('terms').select('id, name, theme, is_current, created_at').order('created_at', { ascending: false })) as unknown as TermsResult
    if (t.error) {
      setMissingSql(missingTable(t.error))
      if (!missingTable(t.error)) setError('No se pudo cargar la lista.')
      setLoading(false)
      return
    }
    setMissingSql(false)
    const list = (t.data ?? []) as TermRow[]
    setTerms(list)
    const current = fixedTermId && list.some((x) => x.id === fixedTermId) ? fixedTermId : termId && list.some((x) => x.id === termId) ? termId : (list.find((x) => x.is_current) ?? list[0])?.id ?? null
    setTermId(current)
    setWelcome(list.find((x) => x.id === current)?.welcome ?? '')
    const words = current ? await supabase.from('term_committees').select('term_id, committee, message').eq('term_id', current) : { data: [], error: null }
    setCommitteeWords(Object.fromEntries((words.data ?? []).map((w) => [w.committee, w.message])))
    const sb = supabase
    const read = (level: 0 | 1 | 2) =>
      Promise.all([
        sb.from('passports').select(level > 0 ? PERSON_COLUMNS : PERSON_COLUMNS_BASE).order('full_name'),
        current ? sb.from('passport_records').select(level === 2 ? RECORD_COLUMNS : level === 1 ? RECORD_COLUMNS_0024 : RECORD_COLUMNS_BASE).eq('term_id', current) : Promise.resolve({ data: [], error: null }),
      ])
    let [p, r] = await read(2)
    const no0027 = missingColumn(r.error) && !missingColumn(p.error)
    if (no0027) [p, r] = await read(1)
    const without = missingColumn(p.error) || missingColumn(r.error)
    if (without) [p, r] = await read(0)
    setMissing0027(no0027 && !without)
    setMissing0024(without)
    const [ev, pf] = await Promise.all([
      current ? supabase.from('events').select('id, name, teams(id, name, sort_order), bases(id, name, sort_order)').eq('term_id', current).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from('profiles').select('username'),
    ])
    if (p.error || r.error || ev.error) setError('No se pudo cargar la lista.')
    // the song (0042) and the career (0043) are read apart so the list opens before they are applied
    // the other career and the count of inductions (0044) are read apart as well, and so are the profiles disabled in this carrera
    type Extra = { song?: PassportSong | null; career?: string | null; second_career?: string | null }
    let extra = await supabase.from('passports').select('id, song, career, second_career')
    setMissing0044(Boolean(extra.error))
    if (extra.error) extra = (await supabase.from('passports').select('id, song, career')) as unknown as typeof extra
    setMissing0043(Boolean(extra.error))
    if (extra.error) extra = (await supabase.from('passports').select('id, song')) as unknown as typeof extra
    const extras = new Map(((extra.error ? [] : extra.data) ?? []).map((x) => [x.id as string, x as unknown as Extra]))
    const priors = await supabase.from('passports').select('id, prior_inductions')
    setMissing0045(Boolean(priors.error))
    const priorOfId = new Map(((priors.error ? [] : priors.data) ?? []).map((x) => [x.id as string, Number(x.prior_inductions) || 0]))
    const births = await supabase.from('passports').select('id, birth_date')
    setMissing0047(Boolean(births.error))
    const birthOfId = new Map(((births.error ? [] : births.data) ?? []).map((x) => [x.id as string, (x.birth_date as string | null) ?? null]))
    const [counted, flagged] = await Promise.all([
      supabase.from('passport_inductions').select('passport_id, inductions'),
      current ? supabase.from('passport_records').select('id, disabled').eq('term_id', current) : Promise.resolve({ data: [], error: null }),
    ])
    const counts = counted.error ? null : inductionCounts((counted.data ?? []) as { passport_id: string; inductions: number }[])
    const disabledIds = new Set(flagged.error ? [] : ((flagged.data ?? []) as { id: string; disabled: boolean }[]).filter((x) => x.disabled).map((x) => x.id))
    setPassports(((p.data ?? []) as unknown as PassportPerson[]).map((x) => ({ ...x, song: extras.get(x.id)?.song ?? null, career: extras.get(x.id)?.career ?? null, second_career: extras.get(x.id)?.second_career ?? null, prior_inductions: priors.error ? null : priorOfId.get(x.id) ?? 0, birth_date: births.error ? null : birthOfId.get(x.id) ?? null, inductions: counts ? (counts.get(x.id) ?? 0) : null })))
    setRecords(((r.data ?? []) as unknown as PassportRecordRow[]).map((x) => ({ ...x, disabled: disabledIds.has(x.id) })))
    type Ev = { id: string; name: string; teams: { id: string; name: string; sort_order: number }[]; bases: { id: string; name: string; sort_order: number }[] }
    const events = (ev.data ?? []) as unknown as Ev[]
    setTermEvents(events.map((e) => e.name))
    setEventId(events[0]?.id ?? null)
    setTeams(events.flatMap((e) => [...e.teams].sort((a, b) => a.sort_order - b.sort_order).map((x) => ({ id: x.id, name: x.name, event: e.name }))))
    setBases(events.flatMap((e) => [...e.bases].sort((a, b) => a.sort_order - b.sort_order).map((x) => ({ id: x.id, name: x.name, event: e.name }))))
    const all = await supabase.from('passport_records').select('passport_id, career, created_at').order('created_at')
    setLatest(latestCareers((all.data ?? []) as { passport_id: string; career: string }[]))
    const cn = await supabase.from('careers').select('name').order('name')
    setCareerNames((cn.data ?? []).map((x) => x.name as string))
    setUsernames(new Set([...((p.data ?? []) as unknown as PassportPerson[]).map((x) => x.username), ...(pf.data ?? []).map((x) => x.username)]))
    setLoading(false)
  }, [termId, fixedTermId])

  useEffect(() => {
    void load()
  }, [load])

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

  // ---------- semester (inside a carrera) ----------
  // the words of the coordinators and of each committee for THIS induction (they open its pages in every passport)
  function onSaveWords(form: HTMLFormElement) {
    if (!term || !supabase) return
    const data = new FormData(form)
    const welcomeText = String(data.get('welcome') ?? '').trim()
    void run(async () => {
      const a = await supabase!.from('terms').update({ welcome: welcomeText || null }).eq('id', term.id)
      if (a.error) throw new Error(missingColumn(a.error) ? 'Falta aplicar la migración 0025.' : 'No se pudieron guardar las palabras.')
      for (const c of COMMITTEES) {
        const message = String(data.get(`c-${c.key}`) ?? '').trim()
        const r = message
          ? await supabase!.from('term_committees').upsert({ term_id: term.id, committee: c.key, message }, { onConflict: 'term_id,committee' })
          : await supabase!.from('term_committees').delete().eq('term_id', term.id).eq('committee', c.key)
        if (r.error) throw new Error('No se pudieron guardar las palabras de un comité.')
      }
    })
  }

  // ---------- the list ----------
  const byPassport = useMemo(() => new Map(records.map((r) => [r.passport_id, r])), [records])
  const people: PersonRow[] = passports.map((p) => ({ passport: p, record: byPassport.get(p.id) ?? null }))
  const careerOf = (x: PersonRow) => (isCarrera ? x.record?.career ?? null : careerOfPerson(x.passport, latest.get(x.passport.id)))
  const stateOf = (x: PersonRow): PersonState => x.passport.status ?? 'active'

  function update(person: PersonRow, patch: Partial<PassportRecordRow>, failMessage = 'No se pudo guardar el cambio.') {
    if (!supabase || !person.record) return
    void run(async () => {
      const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', person.record!.id)
      if (err) throw new Error(/dos personas/.test(err.message) ? 'Un grupo tiene como máximo dos personas.' : /otro semestre/.test(err.message) ? err.message : missingColumn(err) ? 'Falta aplicar la migración 0024 (o la 0027 para los comités extra).' : failMessage)
    })
  }
  // ancestors and the like: a change of status
  function updateIdentity(person: PersonRow, patch: IdentityPatch) {
    if (!supabase) return
    void run(async () => {
      const { error: err } = await supabase!.from('passports').update(patch).eq('id', person.passport.id)
      if (err) throw new Error(missingColumn(err) ? 'Falta aplicar la migración 0024.' : 'No se pudo guardar el cambio.')
    })
  }
  // the profile edited in place: returns what went wrong so the editor can show it where the coordi is looking
  async function saveProfile(person: PersonRow, patch: IdentityPatch): Promise<string | null> {
    if (!supabase) return 'Supabase no está configurado.'
    if (Object.keys(patch).length === 0) return null
    setBusy(true)
    try {
      const { username, ...rest } = patch
      if (username) {
        try {
          await renameUser(person.passport.id, username) // the login follows the @: only the server can change both
        } catch (e) {
          return errMsg(e)
        }
      }
      if (Object.keys(rest).length === 0) {
        await load()
        return null
      }
      const { error: err } = await supabase.from('passports').update(rest).eq('id', person.passport.id)
      if (err) return /birth_date/i.test(err.message) ? 'Falta aplicar la migración 0047 (el cumpleaños).' : /prior_inductions/i.test(err.message) ? 'Falta aplicar la migración 0045 (las inducciones previas).' : /second_career/i.test(err.message) ? 'Falta aplicar la migración 0044 (la otra carrera).' : /career/i.test(err.message) ? 'Falta aplicar la migración 0043 (la carrera de cada persona).' : /song/i.test(err.message) && missingColumn(err) ? 'Falta aplicar la migración 0042 (la canción).' : /generaci/i.test(err.message) ? err.message : 'No se pudo guardar el cambio.'
      await load()
      return null
    } finally {
      setBusy(false)
    }
  }
  const onRole = (p: PersonRow, role: PassportRole) => update(p, { role, team_id: null, base_id: null })
  // disabled in THIS carrera: it does not count as one of their inductions and they are let go of their group or base
  const onToggleDisabled = (p: PersonRow) => update(p, { disabled: !p.record?.disabled }, 'No se pudo cambiar. ¿Ya aplicaste la migración 0044?')

  function onPhoto(p: PassportPerson, file: File) {
    if (!supabase) return
    void run(async () => {
      const path = await uploadPhoto('users', file)
      const { error: err } = await supabase!.from('passports').update({ photo_path: path }).eq('id', p.id)
      if (err) {
        await deletePhoto(path)
        throw new Error('No se pudo guardar la foto.')
      }
      await deletePhoto(p.photo_path)
    })
  }
  async function onReset(p: PassportPerson) {
    if (!(await confirmDialog({ title: `¿Cambiar la contraseña de ${p.full_name}?`, confirmLabel: 'Generar nueva', icon: 'question' }))) return
    const next = newPassword()
    void run(async () => {
      await resetPassword(p.id, next)
      setCreds({ username: p.username, password: next, label: `Nueva contraseña de ${p.full_name}` })
    })
  }
  async function onDelete(p: PassportPerson) {
    if (!(await confirmDialog({ title: `¿Retirar a ${p.full_name} de la inducción?`, message: 'Antes pídele que descargue su pasaporte en PDF, al retirarlo se borran su usuario, su foto y sus sellos de todos los semestres para liberar espacio. No se puede deshacer.', confirmLabel: 'Retirar', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      await deleteUser(p.id)
      await deletePhoto(p.photo_path)
    })
  }

  // ---------- inside a carrera: an EXISTING person takes part in this edition ----------
  const joinable = passports.filter((x) => !byPassport.has(x.id) && (x.status ?? 'active') !== 'disabled')
  const joinPerson = joinable.find((x) => x.id === joinId) ?? null
  const joinCareer = joinPerson ? careerOfPerson(joinPerson, latest.get(joinPerson.id)) : null
  async function onJoin(form: HTMLFormElement) {
    if (!supabase || !term) return
    const f = new FormData(form)
    const id = String(f.get('person') ?? '')
    const career = joinCareer ?? String(f.get('career') ?? '').trim()
    const role = String(f.get('role') ?? 'runner') as PassportRole
    const committee = String(f.get('committee') ?? '') || null
    if (!id || !career) return setError('Elige a la persona y su carrera.')
    const culture = themeOf(term.theme).cultureOf(career)
    if (!culture) return setError(`La carrera «${career}» no tiene grupo ni subtemática en la temática de esta carrera. Agrégala en Carreras y temáticas o asígnale una subtemática en Temática.`)
    await run(async () => {
      const { error: err } = await supabase!.from('passport_records').insert({ passport_id: id, term_id: term.id, role, career, culture, ...(committee ? { committee } : {}) })
      if (err) throw new Error('No se pudo agregar a esta carrera.')
      form.reset()
      setJoinId('')
    })
  }
  // every active inductor that is not in this carrera yet (people registered after it was created, or one who was taken out by mistake)
  const missingActive = passports.filter((x) => !byPassport.has(x.id) && (x.status ?? 'active') === 'active' && Boolean(careerOfPerson(x, latest.get(x.id)))).length
  async function onSumActive() {
    if (!supabase || !eventId) return
    setNotice(null)
    await run(async () => {
      const { data, error: err } = await supabase!.rpc('enroll_active_inductors', { p_event: eventId })
      if (err) throw new Error(/enroll_active_inductors|function/i.test(err.message) ? 'Falta aplicar la migración 0045.' : err.message || 'No se pudo sumar a los inductores.')
      const added = Number(data) || 0
      setNotice(added > 0 ? `${plural(added, 'inductor entró', 'inductores entraron')} a esta carrera.` : 'No había inductores activos por sumar (sin carrera o sin subtemática para su carrera quedan fuera: agrégalos a mano).')
    })
  }
  async function onLeave(p: PassportPerson, recordId: string) {
    if (!supabase) return
    if (!(await confirmDialog({ title: `¿Quitar a ${p.full_name} de esta carrera?`, message: 'Deja de participar en esta edición (rol, comité, grupo o base). La persona, su pasaporte y su participación en otras carreras no cambian.', confirmLabel: 'Quitar de la carrera', tone: 'danger', icon: 'warning' }))) return
    void run(async () => {
      const { error: err } = await supabase!.from('passport_records').delete().eq('id', recordId)
      if (err) throw new Error('No se pudo quitar de la carrera.')
    })
  }

  // ---------- ancestors: they left the induction; their profile stays for a while and then it is disabled ----------
  async function onAncestor(p: PassportPerson) {
    const until = new Date()
    until.setMonth(until.getMonth() + 6)
    if (!(await confirmDialog({ title: `¿${p.full_name} es ahora ancestro?`, message: `Ahora ${p.nickname?.trim() || p.full_name.split(' ')[0]} pasará a ser ancestro, su perfil sigue activo hasta el ${until.toLocaleDateString('es-CO')} y después queda deshabilitado.`, confirmLabel: 'Marcar ancestro', icon: 'question' }))) return
    updateIdentity({ passport: p, record: null }, { status: 'ancestor', ancestor_at: new Date().toISOString(), disable_at: until.toISOString() })
  }
  const onReactivate = (p: PassportPerson) => updateIdentity({ passport: p, record: null }, { status: 'active', ancestor_at: null, disable_at: null })
  async function onDisableNow(p: PassportPerson) {
    if (!(await confirmDialog({ title: `¿Deshabilitar a ${p.full_name}?`, message: 'Su perfil deja de abrir el pasaporte ahora mismo, puedes reactivarlo después.', confirmLabel: 'Deshabilitar', tone: 'danger', icon: 'warning' }))) return
    updateIdentity({ passport: p, record: null }, { status: 'disabled', disable_at: new Date().toISOString() })
  }

  const teamOptions: LinkOption[] = teams.map((t) => {
    const n = records.filter((r) => r.team_id === t.id).length
    return { id: t.id, label: `${t.name} (${n}/2)${teams.some((o) => o.name === t.name && o.id !== t.id) ? ` · ${t.event}` : ''}` }
  })
  const baseOptions: LinkOption[] = bases.map((b) => ({ id: b.id, label: b.name }))

  // the list: inside a carrera only its participants; filters add up inside a group and narrow down between groups
  const scope = people.filter((x) => !isCarrera || x.record)
  const shown = scope.filter((x) => passesFilters(filters, { state: stateOf(x), career: careerOf(x), role: x.record?.role, generation: x.passport.generation }) && matchesSearch(x.passport, careerOf(x), search))
  const count = (test: (x: PersonRow) => boolean) => scope.filter(test).length
  const careersHere = [...new Set(scope.map(careerOf).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'es'))
  const groups: ChipGroup[] = [
    ...(isCarrera
      ? [{ id: 'role', label: 'Rol', options: PASSPORT_ROLES.map((x) => ({ value: x, label: PASSPORT_ROLE_LABEL[x], count: count((p) => p.record?.role === x) })).filter((o) => o.count > 0), selected: filters.roles, onChange: (roles: string[]) => setFilters({ ...filters, roles }) }]
      : []),
    { id: 'career', label: 'Carrera', options: careersHere.map((c) => ({ value: c, label: shortCareer(c), count: count((p) => careerOf(p) === c) })), selected: filters.careers, onChange: (careersSel) => setFilters({ ...filters, careers: careersSel }) },
    // every generation of the catalog is offered (also the ones nobody has yet, like Textiles, which has no semester), newest first
    ...(isCarrera ? [] : [{ id: 'generation', label: 'Generación', options: [...GENERATIONS].reverse().map((g) => ({ value: g.key, label: g.name, count: count((p) => generationsOf(p.passport.generation).some((x) => x.key === g.key)) })), selected: filters.generations, onChange: (generationsSel: string[]) => setFilters({ ...filters, generations: generationsSel }) }]),
    ...(isCarrera
      ? []
      : [{ id: 'state', label: 'Estado', options: (['active', 'ancestor', 'disabled'] as PersonState[]).map((s) => ({ value: s, label: STATE_LABEL[s], count: count((p) => stateOf(p) === s) })).filter((o) => o.count > 0), selected: filters.states, onChange: (states: string[]) => setFilters({ ...filters, states: states as PersonState[] }) }]),
  ]
  const inTerm = people.filter((x) => x.record)
  const loose = inTerm.filter((x) => x.record!.role === 'runner' && !x.record!.team_id).length
  const alone = teams.filter((t) => records.filter((r) => r.team_id === t.id).length === 1).length

  if (missingSql) {
    return (
      <>
        <h1>Inductores</h1>
        <section className="card">
          <h2>Falta aplicar la migración 0023</h2>
          <p>Los pasaportes personales necesitan unas tablas nuevas. Pega <span className="mono">supabase/migrations/0023_passports.sql</span> en el SQL Editor de Supabase, ejecútalo completo y recarga esta pantalla.</p>
        </section>
      </>
    )
  }

  return (
    <>
      <PageTitle step={fixedTermId ? 7 : undefined}>Inductores</PageTitle>
      {isCarrera && (
        <p className="muted">Quiénes participan en ESTA carrera y con qué papel: carrera, rol, comité, grupo o base. Las personas se registran una sola vez en Administración global → Inductores.</p>
      )}
      {!isCarrera && (
        <details className="card info-box">
          <summary><HeartHandshake size={24} aria-hidden="true" /><span>¿Qué es un inductor?</span></summary>
          <blockquote>
            <p>Ser inductor es abrirle la puerta a alguien que llega con ilusión y con susto, y hacer que se sienta en casa desde el primer día.</p>
            <p>No se trata de saber más, sino de acompañar: escuchar, orientar, esperar a quien se queda atrás y celebrar con quien llega.</p>
            <p>Es devolver, sirviendo, lo que alguna vez nos dieron a nosotros.</p>
            <footer>Amar y servir</footer>
          </blockquote>
        </details>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ok-box" role="status">{notice}</p>}
      {missing0025 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0025_passport_pages.sql</span> para las palabras de la inducción y de los comités.</p>}
      {missing0027 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0027_more_committees.sql</span> para que una persona esté en más de un comité.</p>}
      {missing0024 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0024_passport_identity.sql</span> para guardar el comité, la generación y el ingreso.</p>}
      {missing0047 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0047_cumpleanos_del_pasaporte.sql</span> para guardar el cumpleaños y armar con él el código del pasaporte.</p>}
      {missing0045 && !missing0043 && !missing0044 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0045_inducciones_previas_y_entrada_automatica.sql</span> para fijar las inducciones que ya lleva cada inductor y para que los inductores activos entren solos a cada carrera nueva.</p>}
      {missing0044 && !missing0043 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0044_inducciones_y_doble_programa.sql</span> para guardar la otra carrera, contar las inducciones y deshabilitar a alguien en una carrera.</p>}
      {missing0043 && !isCarrera && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0043_carrera_de_la_persona.sql</span> para guardar la carrera de cada inductor.</p>}

      {creds && (
        <section className="card creds">
          <h2>{creds.label}</h2>
          <p>Usuario: <strong>{creds.username}</strong></p>
          <p>Contraseña: <strong className="mono">{creds.password}</strong></p>
          <div className="row">
            <button onClick={() => void navigator.clipboard?.writeText(`Usuario: ${creds.username}\nContraseña: ${creds.password}`)}>
              <Copy size={18} aria-hidden="true" />
              Copiar
            </button>
            <button className="btn-danger" onClick={() => setCreds(null)}>Cerrar</button>
          </div>
        </section>
      )}

      {isCarrera && (
        <section className="card">
          <h2>Semestre</h2>
          {term && <p className="muted"><span className="badge">{plural(inTerm.length, 'inductor', 'inductores')}</span> participan en esta carrera. Su participación es solo de esta edición: no cambia la de otras carreras.</p>}
          {term && (
            <details className="new-term">
              <summary>Palabras para los pasaportes de esta inducción</summary>
              {missing0025 ? (
                <p className="warn">Falta aplicar la migración <span className="mono">0025_passport_pages.sql</span>.</p>
              ) : (
                <form key={`${term.id}-${welcome.length}-${Object.keys(committeeWords).length}`} className="form words-form" onSubmit={(e) => { e.preventDefault(); onSaveWords(e.currentTarget) }}>
                  <p className="muted">Salen en la página de la inducción y en la de cada comité de todos los pasaportes de «{term.name}». Máximo 700 letras cada una.</p>
                  <label>
                    Palabras de los coordis a sus inductores
                    <textarea name="welcome" rows={4} maxLength={700} defaultValue={welcome} />
                  </label>
                  {COMMITTEES.map((c) => (
                    <label key={c.key}>
                      Palabras del comité {c.name}
                      <textarea name={`c-${c.key}`} rows={3} maxLength={700} defaultValue={committeeWords[c.key] ?? ''} />
                    </label>
                  ))}
                  <button type="submit" disabled={busy}>Guardar las palabras</button>
                </form>
              )}
            </details>
          )}
          {!term && termEvents.length === 0 && <p className="muted">Todavía no hay ninguna carrera con semestre. Crea una en «Todas las carreras».</p>}
        </section>
      )}

      {!isCarrera && (
        <div className="inductor-actions" role="group" aria-label="Agregar inductores">
          <button type="button" className={`action-tab${panel === 'new' ? ' on' : ''}`} aria-expanded={panel === 'new'} onClick={() => setPanel(panel === 'new' ? null : 'new')}>
            <UserPlus size={20} aria-hidden="true" />
            <span><strong>Registrar inductor/a nuevo</strong></span>
          </button>
          <button type="button" className={`action-tab${panel === 'bulk' ? ' on' : ''}`} aria-expanded={panel === 'bulk'} onClick={() => setPanel(panel === 'bulk' ? null : 'bulk')}>
            <FileSpreadsheet size={20} aria-hidden="true" />
            <span><strong>Carga masiva con Excel</strong></span>
          </button>
        </div>
      )}

      {!isCarrera && panel === 'new' && (
        <section className="card panel-card">
          <h2>Registrar inductor/a nuevo</h2>
          <NewInductorForm careers={careerNames} people={passports} usernames={usernames} busy={busy} run={run} onError={setError} onCreated={setCreds} />
        </section>
      )}

      {!isCarrera && panel === 'bulk' && (
        <section className="card panel-card">
          <h2>Carga masiva con Excel</h2>
          <InductorsBulk careers={careerNames} people={passports} usernames={usernames} onDone={load} />
        </section>
      )}

      {isCarrera && term && (
        <form className="card add-person" onSubmit={(e) => { e.preventDefault(); void onJoin(e.currentTarget) }}>
          <h2>Agregar una persona a esta carrera</h2>
          <p className="muted">Al crear la carrera entraron solos los inductores activos. Aquí agregas a quien falte, o a quien se registró después. ¿No está? Regístralo en Administración global → Inductores.</p>
          <div className="grid2">
            <label className="inline-field">
              Persona
              <select name="person" required value={joinId} onChange={(e) => setJoinId(e.target.value)}>
                <option value="" disabled>Elige…</option>
                {joinable.map((x) => <option key={x.id} value={x.id}>{x.full_name} (@{x.username})</option>)}
              </select>
            </label>
            <label className="inline-field">
              Carrera
              {joinPerson && joinCareer ? (
                <span className="readonly-field">{joinCareer}</span>
              ) : (
                <select name="career" required defaultValue="">
                  <option value="" disabled>Elige…</option>
                  {careerNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </label>
            <label className="inline-field">
              Rol
              <select name="role" defaultValue="runner">
                {PASSPORT_ROLES.filter((x) => x !== 'coordinator').map((x) => <option key={x} value={x}>{PASSPORT_ROLE_LABEL[x]}</option>)}
              </select>
            </label>
            <label className="inline-field">
              Comité
              <select name="committee" defaultValue="">
                <option value="">Sin comité</option>
                {COMMITTEES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="row">
            <button disabled={busy}><UserPlus size={18} aria-hidden="true" /> Agregar a esta carrera</button>
            {missingActive > 0 && eventId && <button type="button" className="ghost" disabled={busy || missing0045} onClick={() => void onSumActive()}><Users size={18} aria-hidden="true" /> Sumar a los {plural(missingActive, 'activo que falta', 'activos que faltan')}</button>}
          </div>
        </form>
      )}

      {(isCarrera ? term : true) && (
        <section className="card people-card">
          <div className="people-head">
            <h2 className="grow">{isCarrera ? `Participan en ${term?.name ?? 'esta carrera'}` : 'Todos los inductores'}</h2>
            <span className="badge">{hasFilters(filters) || search.trim() ? `${shown.length} de ${scope.length}` : plural(scope.length, 'inductor', 'inductores')}</span>
          </div>
          <FilterBar groups={groups} onClear={() => setFilters(NO_FILTERS)}>
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar inductor, carrera o @" aria-label="Buscar" autoComplete="off" />
            </label>
          </FilterBar>
          {isCarrera && (loose > 0 || alone > 0) && (
            <p className="muted">
              {loose > 0 && `${plural(loose, 'corredor sin grupo', 'corredores sin grupo')}. `}
              {alone > 0 && `${plural(alone, 'grupo con una sola persona', 'grupos con una sola persona')}.`}
            </p>
          )}
          {loading ? (
            <p className="loading">Cargando…</p>
          ) : shown.length === 0 ? (
            <p className="muted empty-note">{scope.length === 0 ? (isCarrera ? 'Todavía no hay inductores en esta carrera: agrégalos arriba.' : 'Todavía no hay inductores: registra el primero arriba.') : 'Nadie coincide con la búsqueda y los filtros.'}</p>
          ) : (
            <ul className="list people">
              {shown.map((x) => (
                <PersonItem
                  key={x.passport.id}
                  person={x}
                  themeKey={term?.theme ?? 'mitologias'}
                  view={isCarrera ? 'carrera' : 'global'}
                  usernames={usernames}
                  career={careerOf(x)}
                  careers={careerNames}
                  onRemove={x.record ? () => void onLeave(x.passport, x.record!.id) : undefined}
                  onToggleDisabled={x.record ? () => onToggleDisabled(x) : undefined}
                  teams={teamOptions}
                  bases={baseOptions}
                  busy={busy}
                  onRole={(role) => onRole(x, role)}
                  onLink={(id) => update(x, x.record?.role === 'runner' ? { team_id: id } : { base_id: id })}
                  onCulture={(culture) => update(x, { culture })}
                  onCommittee={(committee) => update(x, { committee, committee_lead: false, extra_committees: (x.record?.extra_committees ?? []).filter((k) => k !== committee), extra_leads: (x.record?.extra_leads ?? []).filter((k) => k !== committee) })}
                  onLead={(lead) => update(x, { committee_lead: lead })}
                  onExtra={(committee, to) => {
                    const members = (x.record?.extra_committees ?? []).filter((k) => k !== committee)
                    const leads = (x.record?.extra_leads ?? []).filter((k) => k !== committee)
                    if (to !== 'off') members.push(committee)
                    if (to === 'lead') leads.push(committee)
                    update(x, { extra_committees: members, extra_leads: leads })
                  }}
                  onIdentity={(patch) => saveProfile(x, patch)}
                  onPhoto={(file) => onPhoto(x.passport, file)}
                  onReset={() => void onReset(x.passport)}
                  onDelete={() => void onDelete(x.passport)}
                  onAncestor={() => void onAncestor(x.passport)}
                  onReactivate={() => onReactivate(x.passport)}
                  onDisable={() => void onDisableNow(x.passport)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
