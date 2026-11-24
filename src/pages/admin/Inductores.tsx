import { Camera, Copy, Download, FileSpreadsheet, GraduationCap, KeyRound, RotateCcw, Search, Trash2, Upload, UserPlus, UserX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '../../components/Avatar'
import { confirmDialog } from '../../lib/dialog'
import {
  credentialsWorkbook,
  downloadBlob,
  nameKey,
  newPassword,
  passportUsername,
  PASSPORT_ROLE_LABEL,
  PASSPORT_ROLES,
  readPeopleFile,
  templateWorkbook,
  type CredentialRow,
  missingColumn,
  PERSON_COLUMNS,
  PERSON_COLUMNS_BASE,
  RECORD_COLUMNS,
  RECORD_COLUMNS_0024,
  RECORD_COLUMNS_BASE,
  type PassportPerson,
  type PassportRecordRow,
  type PassportRole,
  type PersonIn,
  type TermRow,
} from '../../lib/passports'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { COMMITTEES, committeeOf } from '../../lib/committees'
import { GENERATIONS, generationsOf } from '../../lib/seals'
import { useCatalogVersion } from '../../lib/catalogStore'
import { SYMBOLS } from '../../lib/symbols'
import { cultureOf, themeOf, type CultureKey } from '../../lib/themes'
import { createPassportUser, deleteUser, resetPassword } from '../../lib/usersApi'
import { errMsg } from './AdminContext'

// The generation of a person is CHOSEN from the catalog (Administración global → Generaciones), never typed. Someone who entered twice has two:
// the second selector appears once the first is chosen. The value is the names joined by « / » ('' = none). A text written before the catalog
// existed and not in it is shown as «sin elegir» so it can be fixed.
export function GenerationPicker({ value, onChange, disabled, label, name }: { value: string | null | undefined; onChange?: (value: string) => void; disabled?: boolean; label: string; name?: string }) {
  const known = generationsOf(value)
  const legacy = Boolean(value?.trim()) && known.length === 0
  const [first, setFirst] = useState(known[0]?.name ?? '')
  const [second, setSecond] = useState(known[1]?.name ?? '')
  const join = (a: string, b: string) => [a, b].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(' / ')
  const options = (skip: string) => GENERATIONS.filter((g) => g.name !== skip).map((g) => <option key={g.key} value={g.name}>{g.name}{g.term ? ` (${g.term})` : ''}</option>)
  const pick = (a: string, b: string) => {
    setFirst(a)
    setSecond(b)
    onChange?.(join(a, b))
  }
  return (
    <span className="gen-picker">
      <select name={name} value={first} disabled={disabled} aria-label={label} onChange={(e) => pick(e.target.value, e.target.value ? second : '')}>
        <option value="">{legacy ? `Sin elegir (decía «${value}»)` : 'Sin generación'}</option>
        {options('')}
      </select>
      {first && (
        <select name={name ? `${name}2` : undefined} value={second} disabled={disabled} aria-label={`${label}: segunda generación (si entró dos veces)`} onChange={(e) => pick(first, e.target.value)}>
          <option value="">Una sola generación</option>
          {options(first)}
        </select>
      )}
    </span>
  )
}

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
  participation,
  onRemove,
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
  onIdentity: (patch: { generation?: string | null; joined_term?: string | null; nickname?: string | null; symbol?: string | null; symbol_label?: string | null }) => void
  onPhoto: (file: File) => void
  onReset: () => void
  onDelete: () => void
  onAncestor?: () => void
  onReactivate?: () => void
  onDisable?: () => void
  // the same person is shown in two places and each one edits only what is its own:
  //   'global'  (Administración global → Inductores): the PERSON: photo, @, password, nickname, symbol, generation, ancestor, delete
  //   'carrera' (inside a carrera): their PARTICIPATION in that edition: role, culture, committees, group or base, and removing them from it
  view?: 'global' | 'carrera'
  participation?: string // global: the carreras they take part in
  onRemove?: () => void // carrera: take them out of this edition (the person stays in the system)
}) {
  const { passport: p, record: r } = person
  const status = p.status ?? 'active'
  const theme = themeOf(themeKey)
  const culture = r ? cultureOf(themeKey, r.culture) : null
  return (
    <li className="person">
      <Avatar name={p.full_name} photoPath={p.photo_path} size={46} />
      <span className="grow person-main">
        <strong>
          {p.full_name}
          {status === 'ancestor' && <span className="badge ancestor"> Ancestro{p.disable_at ? ` · hasta ${new Date(p.disable_at).toLocaleDateString('es-CO')}` : ''}</span>}
          {status === 'disabled' && <span className="badge off"> Deshabilitado</span>}
        </strong>
        <small className="muted">
          @{p.username}
          {r ? ` · ${r.career}` : ''}
        </small>
        {view === 'global' ? (
          <small className="muted">{participation ? `Participa en: ${participation}` : 'Todavía no participa en ninguna carrera.'}</small>
        ) : r ? (
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
              <select value={r.team_id ?? ''} disabled={busy} onChange={(e) => onLink(e.target.value || null)} aria-label={`Grupo de ${p.full_name}`}>
                <option value="">Sin grupo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
            {r.role === 'base' && (
              <select value={r.base_id ?? ''} disabled={busy} onChange={(e) => onLink(e.target.value || null)} aria-label={`Base de ${p.full_name}`}>
                <option value="">Sin base</option>
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            )}
          </span>
        ) : (
          <small className="muted">No está en este semestre.</small>
        )}
        {view === 'global' && (
        <span className="person-edit identity-edit">
          <GenerationPicker key={p.generation ?? ''} value={p.generation} label={`Generación de ${p.full_name}`} disabled={busy} onChange={(v) => v !== (p.generation ?? '') && onIdentity({ generation: v || null })} />
          <input defaultValue={p.joined_term ?? ''} maxLength={20} placeholder="Ingresó (2024-2)" aria-label={`Ingreso a inducción de ${p.full_name}`} disabled={busy} onBlur={(e) => e.target.value.trim() !== (p.joined_term ?? '') && onIdentity({ joined_term: e.target.value.trim() || null })} />
          <input defaultValue={p.nickname ?? ''} maxLength={24} placeholder="Apodo" aria-label={`Apodo de ${p.full_name}`} disabled={busy} onBlur={(e) => e.target.value.trim() !== (p.nickname ?? '') && onIdentity({ nickname: e.target.value.trim() || null })} />
          <select value={p.symbol ?? ''} disabled={busy} onChange={(e) => onIdentity({ symbol: e.target.value || null })} aria-label={`Símbolo de ${p.full_name}`}>
            <option value="">Sin símbolo</option>
            {SYMBOLS.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <input defaultValue={p.symbol_label ?? ''} maxLength={24} placeholder="Nombre del símbolo" aria-label={`Nombre del símbolo de ${p.full_name}`} disabled={busy} onBlur={(e) => e.target.value.trim() !== (p.symbol_label ?? '') && onIdentity({ symbol_label: e.target.value.trim() || null })} />
        </span>
        )}
      </span>
      {view === 'global' && (
        <>
      <label className={`btn-like icon-only${busy ? ' disabled' : ''}`} title={p.photo_path ? 'Cambiar foto' : 'Agregar foto'}>
        <Camera size={18} aria-hidden="true" />
        <span className="sr-only">{p.photo_path ? `Cambiar la foto de ${p.full_name}` : `Agregar foto a ${p.full_name}`}</span>
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPhoto(file)
          }}
        />
      </label>
      {status === 'active' && onAncestor && (
        <button className="ghost icon-btn" disabled={busy} onClick={onAncestor} aria-label={`Marcar a ${p.full_name} como ancestro`} title="Ancestro: ya no está en la inducción">
          <GraduationCap size={18} />
        </button>
      )}
      {status !== 'active' && onReactivate && (
        <button className="ghost icon-btn" disabled={busy} onClick={onReactivate} aria-label={`Reactivar a ${p.full_name}`} title="Volver a activarlo">
          <RotateCcw size={18} />
        </button>
      )}
      {status === 'ancestor' && onDisable && (
        <button className="ghost danger icon-btn" disabled={busy} onClick={onDisable} aria-label={`Deshabilitar ya a ${p.full_name}`} title="Deshabilitar su perfil ya">
          <UserX size={18} />
        </button>
      )}
      <button className="ghost icon-btn" disabled={busy} onClick={onReset} aria-label={`Nueva contraseña de ${p.full_name}`} title="Generar una contraseña nueva">
        <KeyRound size={18} />
      </button>
      <button className="ghost danger icon-btn" disabled={busy} onClick={onDelete} aria-label={`Eliminar a ${p.full_name}`} title="Eliminar el pasaporte">
        <Trash2 size={18} />
      </button>
        </>
      )}
      {view === 'carrera' && onRemove && (
        <button className="ghost danger" disabled={busy} onClick={onRemove} title="Quitarlo de esta carrera (la persona sigue en el sistema)">Quitar de la carrera</button>
      )}
    </li>
  )
}

export function UploadPreview({ rows, themeKey, onChange }: { rows: PersonIn[]; themeKey: string; onChange: (index: number, patch: Partial<PersonIn>) => void }) {
  const theme = themeOf(themeKey)
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Carrera</th>
            <th>Cultura</th>
            <th>Papel</th>
            <th>Usuario</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.line}-${r.fullName}`} className={r.errors.length ? 'bad' : undefined}>
              <td>{r.fullName || '—'}</td>
              <td>{r.career || '—'}</td>
              <td>
                <select value={r.culture ?? ''} onChange={(e) => onChange(i, { culture: (e.target.value || null) as CultureKey | null })} aria-label={`Cultura de ${r.fullName}`}>
                  <option value="">Elegir…</option>
                  {theme.cultures.map((c) => (
                    <option key={c.key} value={c.key}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select value={r.role} onChange={(e) => onChange(i, { role: e.target.value as PassportRole })} aria-label={`Papel de ${r.fullName}`}>
                  {PASSPORT_ROLES.map((x) => (
                    <option key={x} value={x}>{PASSPORT_ROLE_LABEL[x]}</option>
                  ))}
                </select>
              </td>
              <td className="mono">@{r.username || '—'}</td>
              <td>
                {r.errors.length ? <span className="badge warn-tone">{r.errors[0]}</span> : r.existing ? <span className="badge">Ya tiene @</span> : !r.culture ? <span className="badge warn-tone">Falta la cultura</span> : <span className="badge ok">Nuevo</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Report {
  created: number
  reused: number
  failed: { name: string; why: string }[]
}

// The coordinator's list of inductors of the semester. They upload the Excel of names and careers, and the app returns another Excel
// with the @ and the password of everybody; then they set who runs, who staffs a base and who coordinates, and link each runner to
// the group of two. Each @ opens only the personal passport (see MemberHome).
// `fixedTermId`: inside a carrera, the people of THAT carrera's semester (no semester picker); without it, the global list of people.
export default function Inductores({ fixedTermId }: { fixedTermId?: string | null } = {}) {
  useCatalogVersion() // the committees and cultures are the ones the coordinator keeps
  const input = useRef<HTMLInputElement>(null)
  const [terms, setTerms] = useState<TermRow[]>([])
  const [termId, setTermId] = useState<string | null>(null)
  const [passports, setPassports] = useState<PassportPerson[]>([])
  const [records, setRecords] = useState<PassportRecordRow[]>([])
  const [teams, setTeams] = useState<{ id: string; name: string; event: string }[]>([])
  const [termEvents, setTermEvents] = useState<string[]>([]) // the Carreras of the open semester
  const [freeEvents, setFreeEvents] = useState<{ id: string; name: string }[]>([]) // Carreras made before there were semesters
  const [pickEvent, setPickEvent] = useState('')
  const [bases, setBases] = useState<{ id: string; name: string; event: string }[]>([])
  const [usernames, setUsernames] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [missingSql, setMissingSql] = useState(false)
  const [missing0024, setMissing0024] = useState(false) // committee, generation… need migration 0024
  const [missing0025, setMissing0025] = useState(false) // the words of the induction need migration 0025
  const [missing0027, setMissing0027] = useState(false) // the extra committees need migration 0027
  const [welcome, setWelcome] = useState('')
  const [committeeWords, setCommitteeWords] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PersonIn[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [phase, setPhase] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [sheet, setSheet] = useState<{ rows: CredentialRow[]; term: string; theme: string } | null>(null)
  const [creds, setCreds] = useState<{ username: string; password: string; label: string } | null>(null)
  const [filter, setFilter] = useState<PassportRole | 'all' | 'none' | 'ancestor'>('all')
  const [search, setSearch] = useState('')
  const [careerNames, setCareerNames] = useState<string[]>([])
  const [participation, setParticipation] = useState<Map<string, string>>(new Map()) // global: person -> the carreras they take part in
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
    const [ev, pf, free] = await Promise.all([
      current ? supabase.from('events').select('id, name, teams(id, name, sort_order), bases(id, name, sort_order)').eq('term_id', current).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from('profiles').select('username'),
      supabase.from('events').select('id, name').is('term_id', null).order('created_at', { ascending: false }),
    ])
    if (p.error || r.error || ev.error) setError('No se pudo cargar la lista.')
    setPassports((p.data ?? []) as unknown as PassportPerson[])
    setRecords((r.data ?? []) as unknown as PassportRecordRow[])
    type Ev = { id: string; name: string; teams: { id: string; name: string; sort_order: number }[]; bases: { id: string; name: string; sort_order: number }[] }
    const events = (ev.data ?? []) as unknown as Ev[]
    setTermEvents(events.map((e) => e.name))
    setFreeEvents((free.data ?? []) as { id: string; name: string }[])
    setTeams(events.flatMap((e) => [...e.teams].sort((a, b) => a.sort_order - b.sort_order).map((x) => ({ id: x.id, name: x.name, event: e.name }))))
    setBases(events.flatMap((e) => [...e.bases].sort((a, b) => a.sort_order - b.sort_order).map((x) => ({ id: x.id, name: x.name, event: e.name }))))
    const all = await supabase.from('passport_records').select('passport_id, term_id')
    const termName = new Map(list.map((x) => [x.id, x.name]))
    const part = new Map<string, string[]>()
    for (const x of all.data ?? []) part.set(x.passport_id as string, [...(part.get(x.passport_id as string) ?? []), termName.get(x.term_id as string) ?? '—'])
    setParticipation(new Map([...part].map(([k, v]) => [k, v.join(', ')])))
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

  // ---------- semester ----------
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
  function onMakeCurrent() {
    if (!term || !supabase) return
    void run(async () => {
      await supabase!.from('terms').update({ is_current: false }).eq('is_current', true)
      const { error: err } = await supabase!.from('terms').update({ is_current: true }).eq('id', term.id)
      if (err) throw new Error('No se pudo cambiar el semestre vigente.')
    })
  }

  function onAddEvent() {
    if (!term || !pickEvent || !supabase) return
    void run(async () => {
      const { error: err } = await supabase!.from('events').update({ term_id: term.id }).eq('id', pickEvent)
      if (err) throw new Error('No se pudo poner la carrera en este semestre.')
      setPickEvent('')
    })
  }

  // ---------- the Excel ----------
  const byPassport = useMemo(() => new Map(records.map((r) => [r.passport_id, r])), [records])
  const people: PersonRow[] = passports.map((p) => ({ passport: p, record: byPassport.get(p.id) ?? null }))

  async function onFile(f: File) {
    if (!term) return
    setError(null)
    setReport(null)
    setSheet(null)
    setRows(null)
    setFileName(f.name)
    try {
      const known = new Map(passports.map((p) => [nameKey(p.full_name), p.username]))
      const parsed = await readPeopleFile(f, { theme: term.theme, usernames, known })
      // someone who is already in this semester cannot be loaded twice
      const inTerm = new Set(people.filter((x) => x.record).map((x) => nameKey(x.passport.full_name)))
      for (const r of parsed) if (inTerm.has(nameKey(r.fullName))) r.errors.push('Ya está en este semestre.')
      setRows(parsed)
    } catch (e) {
      setError(errMsg(e))
    }
  }
  const patchRow = (i: number, patch: Partial<PersonIn>) => setRows((cur) => cur?.map((r, k) => (k === i ? { ...r, ...patch } : r)) ?? null)
  const valid = (rows ?? []).filter((r) => r.errors.length === 0 && r.culture)
  const blocked = (rows ?? []).length - valid.length

  async function onCreate() {
    if (!supabase || !term || valid.length === 0) return
    const sb = supabase
    setBusy(true)
    setError(null)
    const out: Report = { created: 0, reused: 0, failed: [] }
    const sheetRows: CredentialRow[] = []
    let next = 0
    const known = new Map(passports.map((p) => [p.username, p.id]))
    const worker = async () => {
      for (;;) {
        const i = next++
        if (i >= valid.length) return
        const r = valid[i]
        setPhase(`Creando ${i + 1} de ${valid.length}…`)
        try {
          let id = r.existing ? known.get(r.username) : undefined
          let password = ''
          if (!id) {
            password = newPassword()
            id = (await createPassportUser({ username: r.username, password, full_name: r.fullName })).id
            if (!id) throw new Error('No se pudo crear el usuario.')
          }
          const identity = r.existing ? {} : { ...(r.generation ? { generation: r.generation } : {}), ...(r.joined ? { joined_term: r.joined } : {}), ...(r.nickname ? { nickname: r.nickname } : {}) }
          if (Object.keys(identity).length) await sb.from('passports').update(identity).eq('id', id) // optional columns of the Excel (migration 0024)
          const { error: err } = await sb.from('passport_records').insert({ passport_id: id, term_id: term.id, role: r.role, career: r.career, culture: r.culture!, ...(r.committee ? { committee: r.committee } : {}) })
          if (err) {
            if (!r.existing) await deleteUser(id).catch(() => undefined) // do not leave a login without a record
            throw new Error('No se pudo registrar en el semestre.')
          }
          if (r.existing) out.reused++
          else out.created++
          sheetRows.push({ fullName: r.fullName, career: r.career, role: r.role, culture: cultureOf(term.theme, r.culture).name, committee: committeeOf(r.committee)?.name, username: r.username, password })
        } catch (e) {
          out.failed.push({ name: r.fullName, why: errMsg(e) })
        }
      }
    }
    try {
      await Promise.all([worker(), worker(), worker(), worker()])
      sheetRows.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      setReport(out)
      setRows(null)
      if (sheetRows.length) {
        const s = { rows: sheetRows, term: term.name, theme: term.theme }
        setSheet(s)
        downloadBlob(await credentialsWorkbook(s.rows, s.term, s.theme), `credenciales-pasaportes-${term.name}.xlsx`)
      }
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setPhase('')
      setBusy(false)
    }
  }

  // ---------- the list ----------
  function update(person: PersonRow, patch: Partial<PassportRecordRow>, failMessage = 'No se pudo guardar el cambio.') {
    if (!supabase || !person.record) return
    void run(async () => {
      const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', person.record!.id)
      if (err) throw new Error(/dos personas/.test(err.message) ? 'Un grupo tiene como máximo dos personas.' : /otro semestre/.test(err.message) ? err.message : missingColumn(err) ? 'Falta aplicar la migración 0024 (o la 0027 para los comités extra).' : failMessage)
    })
  }
  function updateIdentity(person: PersonRow, patch: { status?: 'active' | 'ancestor' | 'disabled'; ancestor_at?: string | null; disable_at?: string | null; generation?: string | null; joined_term?: string | null; nickname?: string | null; symbol?: string | null; symbol_label?: string | null }) {
    if (!supabase) return
    void run(async () => {
      const { error: err } = await supabase!.from('passports').update(patch).eq('id', person.passport.id)
      if (err) throw new Error(missingColumn(err) ? 'Falta aplicar la migración 0024.' : 'No se pudo guardar el cambio.')
    })
  }
  const onRole = (p: PersonRow, role: PassportRole) => update(p, { role, team_id: null, base_id: null })

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
    if (!(await confirmDialog({ title: `¿Cambiar la contraseña de ${p.full_name}?`, message: 'Se genera una nueva y se muestra una sola vez.', confirmLabel: 'Generar nueva', icon: 'question' }))) return
    const next = newPassword()
    void run(async () => {
      await resetPassword(p.id, next)
      setCreds({ username: p.username, password: next, label: `Nueva contraseña de ${p.full_name}` })
    })
  }
  async function onDelete(p: PassportPerson) {
    if (!(await confirmDialog({ title: `¿Retirar a ${p.full_name} de la inducción?`, message: `@${p.username}. Antes pídele que descargue su pasaporte en PDF (Mi perfil): al retirarla se borran su usuario, su foto y sus sellos de todos los semestres para liberar espacio. No se puede deshacer.`, confirmLabel: 'Retirar', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      await deleteUser(p.id)
      await deletePhoto(p.photo_path)
    })
  }

  // ---------- global: a new PERSON (the only place where people are created) ----------
  async function onCreatePerson(form: HTMLFormElement) {
    if (!supabase) return
    const f = new FormData(form)
    const fullName = String(f.get('name') ?? '').trim().replace(/\s+/g, ' ')
    if (fullName.length < 3) return setError('Escribe el nombre completo.')
    const known = passports.find((x) => nameKey(x.full_name) === nameKey(fullName))
    if (known) return setError(`${known.full_name} ya existe (@${known.username}). Agrégalo a una carrera desde la pestaña Inductores de esa carrera.`)
    const extra: Record<string, unknown> = {}
    for (const [k, col] of [['joined', 'joined_term'], ['nickname', 'nickname']] as const) {
      const v = String(f.get(k) ?? '').trim()
      if (v) extra[col] = v
    }
    const generation = [String(f.get('generation') ?? ''), String(f.get('generation2') ?? '')].filter(Boolean).join(' / ') // chosen from the catalog
    if (generation) extra.generation = generation
    await run(async () => {
      const username = passportUsername(fullName, usernames)
      const password = newPassword()
      const id = (await createPassportUser({ username, password, full_name: fullName })).id
      if (!id) throw new Error('No se pudo crear el usuario.')
      if (Object.keys(extra).length) await supabase!.from('passports').update(extra).eq('id', id)
      form.reset()
      setCreds({ username, password, label: `Usuario nuevo de ${fullName}` })
    })
  }

  // ---------- inside a carrera: an EXISTING person takes part in this edition ----------
  async function onJoin(form: HTMLFormElement) {
    if (!supabase || !term) return
    const f = new FormData(form)
    const id = String(f.get('person') ?? '')
    const career = String(f.get('career') ?? '').trim()
    const role = String(f.get('role') ?? 'runner') as PassportRole
    const committee = String(f.get('committee') ?? '') || null
    if (!id || !career) return setError('Elige a la persona y su carrera.')
    const culture = themeOf(term.theme).cultureOf(career)
    if (!culture) return setError(`La carrera «${career}» no tiene grupo ni subtemática en la temática de esta carrera. Agrégala en Grupos organizativos o asígnale una subtemática en Temática.`)
    await run(async () => {
      const { error: err } = await supabase!.from('passport_records').insert({ passport_id: id, term_id: term.id, role, career, culture, ...(committee ? { committee } : {}) })
      if (err) throw new Error('No se pudo agregar a esta carrera.')
      form.reset()
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
    if (!(await confirmDialog({ title: `¿${p.full_name} es ahora ancestro?`, message: `Ya no está en la inducción. Su perfil sigue activo hasta el ${until.toLocaleDateString('es-CO')} y después queda deshabilitado. Puedes reactivarlo o deshabilitarlo antes.`, confirmLabel: 'Marcar ancestro', icon: 'question' }))) return
    updateIdentity({ passport: p, record: null }, { status: 'ancestor', ancestor_at: new Date().toISOString(), disable_at: until.toISOString() })
  }
  const onReactivate = (p: PassportPerson) => updateIdentity({ passport: p, record: null }, { status: 'active', ancestor_at: null, disable_at: null })
  async function onDisableNow(p: PassportPerson) {
    if (!(await confirmDialog({ title: `¿Deshabilitar a ${p.full_name} ya?`, message: 'Su perfil deja de abrir el pasaporte ahora mismo. Puedes reactivarlo después.', confirmLabel: 'Deshabilitar', tone: 'danger', icon: 'warning' }))) return
    updateIdentity({ passport: p, record: null }, { status: 'disabled', disable_at: new Date().toISOString() })
  }

  const teamOptions: LinkOption[] = teams.map((t) => {
    const n = records.filter((r) => r.team_id === t.id).length
    return { id: t.id, label: `${t.name} (${n}/2)${teams.some((o) => o.name === t.name && o.id !== t.id) ? ` · ${t.event}` : ''}` }
  })
  const baseOptions: LinkOption[] = bases.map((b) => ({ id: b.id, label: b.name }))

  const shown = people.filter((x) => {
    if (isCarrera && !x.record) return false // inside a carrera only its participants are listed
    if (filter === 'none') return !participation.has(x.passport.id)
    if (filter === 'ancestor') return (x.passport.status ?? 'active') !== 'active'
    if (filter !== 'all' && x.record?.role !== filter) return false
    const q = nameKey(search)
    return !q || nameKey(x.passport.full_name).includes(q) || x.passport.username.includes(search.trim().toLowerCase())
  })
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
      <h1>{fixedTermId ? 'Inductores de esta carrera' : 'Inductores'}</h1>
      <p className="muted">
        {isCarrera
          ? 'Quiénes participan en ESTA carrera y con qué papel: carrera, rol, comité, grupo o base. Las personas se registran una sola vez en Administración global → Inductores.'
          : 'Las personas del sistema, con su identidad y su perfil (ancestros incluidos). Aquí se registran una sola vez; en qué carrera participan se decide dentro de cada carrera.'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      {missing0025 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0025_passport_pages.sql</span> para las palabras de la inducción y de los comités.</p>}
      {missing0027 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0027_more_committees.sql</span> para que una persona esté en más de un comité.</p>}
      {missing0024 && <p className="warn" role="status">Falta aplicar la migración <span className="mono">0024_passport_identity.sql</span> para guardar el comité, la generación y el ingreso.</p>}

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
            <button className="ghost" onClick={() => setCreds(null)}>Cerrar</button>
          </div>
        </section>
      )}

      {isCarrera ? (
      <section className="card">
        <h2>Semestre</h2>
        {fixedTermId ? (
          term && <p className="muted"><span className="badge">{plural(inTerm.length, 'inductor', 'inductores')}</span> participan en esta carrera. Su participación es solo de esta edición: no cambia la de otras carreras.</p>
        ) : terms.length > 0 ? (
          <div className="row">
            <select value={termId ?? ''} onChange={(e) => setTermId(e.target.value)} aria-label="Semestre">
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {themeOf(t.theme).name}{t.is_current ? ' (vigente)' : ''}</option>
              ))}
            </select>
            {term && !term.is_current && <button className="ghost" disabled={busy} onClick={onMakeCurrent}>Hacer vigente</button>}
            {term && <span className="badge">{plural(inTerm.length, 'inductor', 'inductores')}</span>}
          </div>
        ) : (
          <p className="muted">Todavía no hay ninguna carrera con semestre. Crea una en «Todas las carreras».</p>
        )}
        {term && !fixedTermId && (
          <>
            <p className="muted">Carreras de este semestre: {termEvents.length ? termEvents.join(', ') : 'ninguna todavía'}. Los grupos y las bases de esas Carreras son los que se pueden enlazar abajo; las carreras que se creen desde ahora quedan en el semestre vigente.</p>
            {freeEvents.length > 0 && (
              <div className="row">
                <select value={pickEvent} onChange={(e) => setPickEvent(e.target.value)} aria-label="Carrera sin semestre">
                  <option value="">Carrera sin semestre…</option>
                  {freeEvents.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button className="ghost" disabled={busy || !pickEvent} onClick={onAddEvent}>Poner en {term.name}</button>
              </div>
            )}
          </>
        )}
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
      </section>
      ) : (
        <section className="card">
          <h2>Las personas</h2>
          <p className="muted">Aquí se registran las personas y su identidad (usuario, contraseña, foto, apodo, símbolo, generación). Una persona se crea UNA sola vez: su participación (rol, comité, grupo o base) se pone dentro de cada carrera, en su pestaña Inductores.</p>
        </section>
      )}

      {!isCarrera && (
        <form className="card add-person" onSubmit={(e) => { e.preventDefault(); void onCreatePerson(e.currentTarget) }}>
          <h2>Registrar una persona nueva</h2>
          <p className="muted">Se crea su usuario personal y se muestra la contraseña una sola vez. Su carrera, rol y comité se eligen al agregarla a una carrera.</p>
          <div className="grid2">
            <label className="inline-field">Nombre completo<input name="name" required minLength={3} maxLength={80} placeholder="Nombre Apellido" /></label>
            <label className="inline-field">Generación<GenerationPicker value="" name="generation" label="Generación" disabled={busy} /></label>
            <label className="inline-field">Ingresó<input name="joined" maxLength={20} placeholder="2027-1" /></label>
            <label className="inline-field">Apodo<input name="nickname" maxLength={24} /></label>
          </div>
          <div className="row"><button disabled={busy}><UserPlus size={18} aria-hidden="true" /> Registrar persona</button></div>
        </form>
      )}

      {isCarrera && term && (
        <form className="card add-person" onSubmit={(e) => { e.preventDefault(); void onJoin(e.currentTarget) }}>
          <h2>Agregar una persona a esta carrera</h2>
          <p className="muted">Eliges entre las personas ya registradas. ¿No está? Regístrala una vez en Administración global → Inductores.</p>
          <div className="grid2">
            <label className="inline-field">
              Persona
              <select name="person" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {passports.filter((x) => !byPassport.has(x.id) && (x.status ?? 'active') !== 'disabled').map((x) => <option key={x.id} value={x.id}>{x.full_name} (@{x.username})</option>)}
              </select>
            </label>
            <label className="inline-field">
              Carrera
              <select name="career" required defaultValue="">
                <option value="" disabled>Elige…</option>
                {careerNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
          <div className="row"><button disabled={busy}><UserPlus size={18} aria-hidden="true" /> Agregar a esta carrera</button></div>
        </form>
      )}

      {isCarrera && term && (
        <details className="card">
          <summary><strong>Carga masiva con Excel</strong> <span className="muted">(solo si llegan muchos a la vez)</span></summary>
          <p className="muted">
            Excel con las columnas <strong>Nombre</strong> y <strong>Carrera</strong> (y, si quieres, <strong>Rol</strong>). Cada carrera recibe su cultura según la temática de esta inducción («{themeOf(term.theme).name}»), solo para ella. Quien ya tenía pasaporte de una inducción anterior conserva su @ y solo se le abren páginas nuevas.
          </p>
          <div className="row">
            <button type="button" className="ghost" onClick={async () => downloadBlob(await templateWorkbook(), 'plantilla-inductores.xlsx')}>
              <FileSpreadsheet size={18} aria-hidden="true" />
              Plantilla
            </button>
            <label className={`btn-like${busy ? ' disabled' : ''}`}>
              <Upload size={18} aria-hidden="true" />
              {fileName && rows ? 'Cambiar archivo' : 'Elegir Excel'}
              <input
                ref={input}
                type="file"
                accept=".xlsx,.csv,.docx"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void onFile(f)
                }}
              />
            </label>
            {fileName && rows && <span className="muted">{fileName}</span>}
          </div>

          {rows && (
            <>
              <UploadPreview rows={rows} themeKey={term.theme} onChange={patchRow} />
              <div className="row">
                <button disabled={busy || valid.length === 0} onClick={() => void onCreate()}>
                  {busy ? phase || 'Creando…' : `Crear ${plural(valid.length, 'pasaporte', 'pasaportes')} y descargar las contraseñas`}
                </button>
                <button className="ghost" disabled={busy} onClick={() => setRows(null)}>Cancelar</button>
                {blocked > 0 && <span className="muted">{plural(blocked, 'fila se salta', 'filas se saltan')} hasta que se arreglen.</span>}
              </div>
            </>
          )}

          {report && (
            <div className="report">
              <p>
                <strong>{plural(report.created, 'pasaporte creado', 'pasaportes creados')}</strong>
                {report.reused > 0 && ` y ${plural(report.reused, 'persona que ya tenía @ y recibió una página nueva', 'personas que ya tenían @ y recibieron una página nueva')}`}.
              </p>
              {sheet && (
                <>
                  <p className="muted">El Excel con los usuarios y las contraseñas se descargó solo. Las contraseñas no se pueden consultar después: guárdalo bien.</p>
                  <button type="button" className="ghost" onClick={async () => downloadBlob(await credentialsWorkbook(sheet.rows, sheet.term, sheet.theme), `credenciales-pasaportes-${sheet.term}.xlsx`)}>
                    <Download size={18} aria-hidden="true" />
                    Descargar de nuevo
                  </button>
                </>
              )}
              {report.failed.length > 0 && (
                <ul className="list">
                  {report.failed.map((f) => (
                    <li key={f.name}>
                      <span className="grow">{f.name}</span>
                      <span className="badge warn-tone">{f.why}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </details>
      )}

      {(isCarrera ? term : true) && (
        <section className="card">
          <div className="row">
            <h2 className="grow">{isCarrera ? `Participan en ${term?.name ?? 'esta carrera'}` : 'Todas las personas'}</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filtrar">
              <option value="all">Todos</option>
              {isCarrera && PASSPORT_ROLES.map((x) => (
                <option key={x} value={x}>{PASSPORT_ROLE_LABEL[x]}</option>
              ))}
              {!isCarrera && <option value="none">Sin ninguna carrera</option>}
              {!isCarrera && <option value="ancestor">Ancestros y deshabilitados</option>}
            </select>
          </div>
          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o @" aria-label="Buscar" />
          </label>
          {isCarrera && (loose > 0 || alone > 0) && (
            <p className="muted">
              {loose > 0 && `${plural(loose, 'corredor sin grupo', 'corredores sin grupo')}. `}
              {alone > 0 && `${plural(alone, 'grupo con una sola persona', 'grupos con una sola persona')}.`}
            </p>
          )}
          {loading ? (
            <p className="loading">Cargando…</p>
          ) : shown.length === 0 ? (
            <p className="muted">{people.length === 0 ? (isCarrera ? 'Todavía no hay inductores en esta carrera: agrégalos arriba.' : 'Todavía no hay personas registradas.') : 'Nadie coincide con ese filtro.'}</p>
          ) : (
            <ul className="list people">
              {shown.map((x) => (
                <PersonItem
                  key={x.passport.id}
                  person={x}
                  themeKey={term?.theme ?? 'mitologias'}
                  view={isCarrera ? 'carrera' : 'global'}
                  participation={participation.get(x.passport.id)}
                  onRemove={x.record ? () => void onLeave(x.passport, x.record!.id) : undefined}
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
                  onIdentity={(patch) => updateIdentity(x, patch)}
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
