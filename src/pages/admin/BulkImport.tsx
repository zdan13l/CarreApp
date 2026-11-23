import { Copy, Download, FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import {
  countErrors,
  isEmpty,
  nameKey,
  parseTables,
  readTablesFromFile,
  validateFile,
  type ExistingData,
  type ParsedFile,
} from '../../lib/bulk'
import { supabase } from '../../lib/supabase'
import { createUser } from '../../lib/usersApi'
import { ROLE_LABEL } from '../../types'
import { errMsg, useAdmin } from './AdminContext'

interface Target {
  id: string | null // null = a new Carrera will be created
  name: string
}

interface Loaded {
  existing: ExistingData
  trackers: Set<string> // ids of teams that already have a GPS runner
}

interface UserOutcome {
  line: number
  name: string
  role: string
  assignment: string
  username: string
  password: string
  ok: boolean
  note: string
}

interface Report {
  done: string[] // what was created, one line each
  problems: string[] // what could not be done
  users: UserOutcome[]
}

const csvCell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const EMPTY: Loaded = { existing: { usernames: new Set(), teams: new Set(), bases: new Set(), matches: [] }, trackers: new Set() }

// Loads everything a new file has to be checked against. Usernames are global; the rest belongs
// to the Carrera the file will be loaded into (nothing, when the file creates a new Carrera).
async function loadExisting(eventId: string | null): Promise<Loaded> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  const profiles = await supabase.from('profiles').select('username')
  const usernames = new Set((profiles.data ?? []).map((x) => x.username))
  if (!eventId) return { ...EMPTY, existing: { ...EMPTY.existing, usernames } }
  const [t, b, tr, m] = await Promise.all([
    supabase.from('teams').select('id, name').eq('event_id', eventId),
    supabase.from('bases').select('id, name').eq('event_id', eventId),
    supabase.from('team_runners').select('team_id, is_gps_tracker, teams!inner(event_id)').eq('teams.event_id', eventId),
    supabase.from('matches').select('round_number, team_a, team_b, base_id').eq('event_id', eventId),
  ])
  const teamName = new Map((t.data ?? []).map((x) => [x.id, nameKey(x.name)]))
  const baseName = new Map((b.data ?? []).map((x) => [x.id, nameKey(x.name)]))
  return {
    existing: {
      usernames,
      teams: new Set(teamName.values()),
      bases: new Set(baseName.values()),
      matches: (m.data ?? []).map((x) => ({
        round: x.round_number,
        base: baseName.get(x.base_id) ?? '',
        a: teamName.get(x.team_a) ?? '',
        b: teamName.get(x.team_b) ?? '',
      })),
    },
    trackers: new Set((tr.data ?? []).filter((x) => x.is_gps_tracker).map((x) => x.team_id)),
  }
}

// Starts a Carrera from a Word / Excel / CSV file with a fixed format. EVERY section is optional
// (Carrera, groups, bases, people, matchups, travel times). It shows a preview with every problem
// before creating anything, and lists the usernames and passwords at the end.
export default function BulkImport() {
  const { event, events, selectEvent, reload } = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [loaded, setLoaded] = useState<Loaded>(EMPTY)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const [report, setReport] = useState<Report | null>(null)

  async function onFile(f: File) {
    setError(null)
    setReport(null)
    setFile(null)
    setFileName(f.name)
    try {
      const parsed = parseTables(await readTablesFromFile(f))
      if (isEmpty(parsed)) {
        throw new Error('No se encontró ninguna tabla reconocida. Usa la plantilla y no cambies los títulos de las columnas.')
      }
      // Where does it go? Into the Carrera named in the file (created if new) or the open one.
      let t: Target | null = null
      if (parsed.carrera?.name) {
        const same = events.find((e) => nameKey(e.name) === nameKey(parsed.carrera!.name))
        t = { id: same?.id ?? null, name: parsed.carrera.name }
      } else if (event) {
        t = { id: event.id, name: event.name }
      }
      if (!t) throw new Error('Primero crea una carrera (pestaña "Carrera"), o incluye la sección "Carrera" en el archivo.')
      const ld = await loadExisting(t.id)
      setTarget(t)
      setLoaded(ld)
      setFile(validateFile(parsed, ld.existing))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const problems = file ? countErrors(file) : 0

  async function run() {
    if (!supabase || !file || !target) return
    const sb = supabase
    setBusy(true)
    setError(null)
    const out: Report = { done: [], problems: [], users: [] }
    try {
      // 1) The Carrera
      setPhase('Carrera')
      let eventId = target.id ?? ''
      if (!eventId) {
        const { data, error: err } = await sb.from('events').insert({ name: target.name }).select('id').single()
        if (err) throw new Error(err.message.includes('duplicate') ? 'Ya existe una carrera con ese nombre.' : 'No se pudo crear la carrera.')
        eventId = data.id
        out.done.push(`Carrera "${target.name}" creada (queda en borrador hasta que la actives).`)
      }
      if (file.carrera?.maxMinutes) {
        await sb.from('events').update({ max_travel_minutes: file.carrera.maxMinutes }).eq('id', eventId)
        out.done.push(`Tiempo máximo general: ${file.carrera.maxMinutes} min.`)
      }

      // 2) Groups: the listed ones plus any named by people.
      setPhase('Grupos')
      const teams = new Map<string, string>() // nameKey -> id
      const ex = await sb.from('teams').select('id, name').eq('event_id', eventId)
      for (const t of ex.data ?? []) teams.set(nameKey(t.name), t.id)
      const wantedTeams = [...file.grupos.map((g) => g.name), ...file.personas.filter((p) => p.role === 'runner').map((p) => p.assignment)]
      let createdTeams = 0
      for (const name of wantedTeams) {
        if (!name || teams.has(nameKey(name))) continue
        const { data, error: err } = await sb.from('teams').insert({ event_id: eventId, name, sort_order: teams.size }).select('id').single()
        if (err) throw new Error(`No se pudo crear el grupo "${name}".`)
        teams.set(nameKey(name), data.id)
        createdTeams++
      }
      if (createdTeams > 0) out.done.push(`${plural(createdTeams, 'grupo creado', 'grupos creados')} (sin foto: se agrega después).`)

      // 3) Bases: create, then fill in location, information and questions.
      setPhase('Bases')
      const bases = new Map<string, string>()
      const exb = await sb.from('bases').select('id, name').eq('event_id', eventId)
      for (const b of exb.data ?? []) bases.set(nameKey(b.name), b.id)
      const wantedBases = [...file.bases.map((b) => b.name), ...file.personas.filter((p) => p.role === 'base').map((p) => p.assignment)]
      let createdBases = 0
      for (const name of wantedBases) {
        if (!name || bases.has(nameKey(name))) continue
        const { data, error: err } = await sb.from('bases').insert({ event_id: eventId, name, sort_order: bases.size }).select('id').single()
        if (err) throw new Error(/sellos/.test(err.message) ? err.message : `No se pudo crear la base "${name}".`)
        bases.set(nameKey(name), data.id)
        createdBases++
      }
      if (createdBases > 0) out.done.push(`${plural(createdBases, 'base creada', 'bases creadas')} (sin foto del lugar: se agrega después).`)
      for (const b of file.bases) {
        const id = bases.get(nameKey(b.name))!
        if (b.lat !== null && b.lng !== null) {
          const { error: err } = await sb.from('bases').update({ lat: b.lat, lng: b.lng }).eq('id', id)
          if (err) out.problems.push(`Base "${b.name}": no se pudo guardar la ubicación.`)
        }
        if (b.info) {
          const { error: err } = await sb.from('base_details').upsert({ base_id: id, info: b.info })
          if (err) out.problems.push(`Base "${b.name}": no se pudo guardar la información.`)
        }
        for (const [i, q] of b.questions.entries()) {
          const { error: err } = await sb.from('base_questions').upsert({ base_id: id, position: i + 1, question: q, answer: b.answers[i] || null }, { onConflict: 'base_id,position' })
          if (err) out.problems.push(`Base "${b.name}": no se pudo guardar la pregunta ${i + 1}.`)
        }
      }
      if (file.bases.length > 0) out.done.push(`Información de ${plural(file.bases.length, 'base', 'bases')} cargada (datos, preguntas y ubicación).`)

      // 4) People: the GPS runner of each team is the one marked, otherwise the first one.
      const tracker = new Map<string, number>()
      const runners = file.personas.filter((p) => p.role === 'runner')
      for (const r of runners) {
        const id = teams.get(nameKey(r.assignment))!
        if (!loaded.trackers.has(id) && r.gps && !tracker.has(id)) tracker.set(id, r.line)
      }
      for (const r of runners) {
        const id = teams.get(nameKey(r.assignment))!
        if (!loaded.trackers.has(id) && !tracker.has(id)) tracker.set(id, r.line)
      }
      for (const [i, p] of file.personas.entries()) {
        setPhase(`Usuarios ${i + 1} de ${file.personas.length}`)
        const base: UserOutcome = {
          line: p.line, name: p.fullName, role: ROLE_LABEL[p.role!], assignment: p.assignment,
          username: p.username, password: p.password, ok: false, note: '',
        }
        try {
          const created = await createUser({ username: p.username, password: p.password, full_name: p.fullName, role: p.role!, event_id: eventId })
          if (!created.id) throw new Error('El servidor no devolvió el usuario creado.')
          if (p.role === 'runner') {
            const teamId = teams.get(nameKey(p.assignment))!
            const { error: err } = await sb.from('team_runners').insert({ team_id: teamId, user_id: created.id, is_gps_tracker: tracker.get(teamId) === p.line })
            out.users.push({ ...base, ok: !err, note: err ? `Creado, pero no se pudo asignar al grupo: ${err.message}` : '' })
          } else {
            const { error: err } = await sb.from('base_staff').insert({ base_id: bases.get(nameKey(p.assignment))!, user_id: created.id })
            out.users.push({ ...base, ok: !err, note: err ? `Creado, pero no se pudo asignar a la base: ${err.message}` : '' })
          }
        } catch (e) {
          out.users.push({ ...base, note: errMsg(e) })
        }
      }

      // 5) Matchups, round by round.
      if (file.cruces.length > 0) {
        setPhase('Cruces')
        let ok = 0
        for (const m of [...file.cruces].sort((a, b) => a.round - b.round)) {
          const { error: err } = await sb.from('matches').insert({
            event_id: eventId, base_id: bases.get(nameKey(m.base))!, round_number: m.round,
            team_a: teams.get(nameKey(m.teamA))!, team_b: teams.get(nameKey(m.teamB))!,
          })
          if (err) out.problems.push(`Cruce de la ronda ${m.round} (${m.teamA} vs ${m.teamB}): ${err.message}`)
          else ok++
        }
        out.done.push(`${plural(ok, 'cruce programado', 'cruces programados')}.`)
      }

      // 6) Travel times between bases.
      if (file.tiempos.length > 0) {
        setPhase('Tiempos')
        const rows = file.tiempos.map((l) => ({
          event_id: eventId, from_base_id: bases.get(nameKey(l.from))!, to_base_id: bases.get(nameKey(l.to))!, minutes: l.minutes,
        }))
        const { error: err } = await sb.from('base_travel_times').upsert(rows, { onConflict: 'from_base_id,to_base_id' })
        if (err) out.problems.push('No se pudieron guardar los tiempos entre bases.')
        else out.done.push(`${plural(rows.length, 'tiempo entre bases guardado', 'tiempos entre bases guardados')}.`)
      }

      const created = out.users.filter((u) => u.ok).length
      if (file.personas.length > 0) out.done.push(`${created} de ${plural(file.personas.length, 'usuario creado y asignado', 'usuarios creados y asignados')}.`)
      if (eventId !== event?.id) selectEvent(eventId)
    } catch (e) {
      out.problems.push(errMsg(e))
    } finally {
      setReport(out)
      setPhase('')
      setBusy(false)
      await reload()
    }
  }

  const credentials = (report?.users ?? []).filter((u) => u.ok || u.note.startsWith('Creado'))
  const copyText = credentials.map((u) => `${u.name}\t${u.role}\t${u.assignment}\t${u.username}\t${u.password}`).join('\n')

  function downloadCsv() {
    const lines = [['Nombre', 'Rol', 'Grupo o base', 'Usuario', 'Contraseña'], ...credentials.map((u) => [u.name, u.role, u.assignment, u.username, u.password])]
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'usuarios-carreapp.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="card">
      <h2>Cargar la carrera desde un archivo</h2>
      <p className="muted">
        Con una plantilla de Word o Excel puedes cargar todo lo necesario para empezar: la carrera, los grupos, las bases
        (información, preguntas y ubicación), las personas con su usuario, los cruces y los tiempos entre bases. Todas las
        secciones son opcionales: incluye solo las que necesites. Las fotos se suben después en la app. Antes de crear
        nada ves una vista previa con los errores.
      </p>
      <div className="row">
        <a className="btn-like" href="/plantillas/plantilla-carrera.docx" download>
          <FileText size={18} aria-hidden="true" /> Plantilla Word
        </a>
        <a className="btn-like" href="/plantillas/plantilla-carrera.xlsx" download>
          <FileSpreadsheet size={18} aria-hidden="true" /> Plantilla Excel
        </a>
        <a className="btn-like" href="/plantillas/plantilla-personas.csv" download>
          <FileText size={18} aria-hidden="true" /> Solo personas (CSV)
        </a>
        <a className="btn-like" href="/plantillas/carrera-de-prueba.xlsx" download>
          <FileSpreadsheet size={18} aria-hidden="true" /> Carrera de prueba (ejemplo completo)
        </a>
      </div>

      <div className="row">
        <input
          ref={input}
          type="file"
          hidden
          accept=".docx,.xlsx,.csv,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void onFile(f)
          }}
        />
        <button disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={18} aria-hidden="true" />
          Elegir archivo
        </button>
        {fileName && <span className="muted">{fileName}</span>}
      </div>
      {error && <p className="error">{error}</p>}

      {file && !report && target && (
        <>
          <p>
            Se cargará en la carrera <strong>{target.name}</strong>
            {target.id === null && ' (nueva)'}.
          </p>
          {file.notes.map((n) => <p key={n} className="warn">{n}</p>)}

          {file.carrera && (
            <Section title="Carrera" count={1} errors={file.carrera.errors.length}>
              <tr className={file.carrera.errors.length > 0 ? 'bad' : undefined}>
                <td>{file.carrera.name || '—'}</td>
                <td>{file.carrera.maxMinutes ? `${file.carrera.maxMinutes} min` : 'sin cambio'}</td>
                <td>{file.carrera.errors.length === 0 ? <Ok /> : file.carrera.errors.join(' ')}</td>
              </tr>
            </Section>
          )}
          {file.grupos.length > 0 && (
            <Section title="Grupos" count={file.grupos.length} errors={file.grupos.filter((r) => r.errors.length).length}>
              {file.grupos.map((r) => <Row key={r.line} errors={r.errors} cells={[r.name || '—']} />)}
            </Section>
          )}
          {file.bases.length > 0 && (
            <Section title="Bases" count={file.bases.length} errors={file.bases.filter((r) => r.errors.length).length}>
              {file.bases.map((r) => (
                <Row key={r.line} errors={r.errors} cells={[r.name || '—', `${r.questions.length} preguntas (mínimo 5)${r.info ? ' · con información' : ''}${r.lat !== null ? ' · en el mapa' : ''}`]} />
              ))}
            </Section>
          )}
          {file.personas.length > 0 && (
            <Section title="Personas" count={file.personas.length} errors={file.personas.filter((r) => r.errors.length).length}>
              {file.personas.map((r) => (
                <Row key={r.line} errors={r.errors} cells={[r.fullName || '—', `${r.role ? ROLE_LABEL[r.role] : '—'} · ${r.assignment || '—'}${r.gps ? ' · GPS' : ''}`, r.username]} mono={2} />
              ))}
            </Section>
          )}
          {file.cruces.length > 0 && (
            <Section title="Cruces" count={file.cruces.length} errors={file.cruces.filter((r) => r.errors.length).length}>
              {file.cruces.map((r) => <Row key={r.line} errors={r.errors} cells={[`Ronda ${r.round || '?'} · ${r.base || '—'}`, `${r.teamA || '—'} vs ${r.teamB || '—'}`]} />)}
            </Section>
          )}
          {file.tiempos.length > 0 && (
            <Section title="Tiempos entre bases" count={file.tiempos.length} errors={file.tiempos.filter((r) => r.errors.length).length}>
              {file.tiempos.map((r) => <Row key={r.line} errors={r.errors} cells={[`${r.from || '—'} → ${r.to || '—'}`, `${r.minutes || '?'} min`]} />)}
            </Section>
          )}

          {problems > 0 && (
            <p className="warn">Corrige las filas con errores en el archivo y vuelve a subirlo. Solo se crea cuando todo está bien.</p>
          )}
          <div className="row">
            <button disabled={busy || problems > 0} onClick={() => void run()}>
              {busy ? `Cargando… ${phase}` : 'Cargar todo'}
            </button>
          </div>
        </>
      )}

      {report && (
        <>
          {report.done.length > 0 && (
            <div className="ok-box">
              <strong>Listo:</strong>
              <ul>{report.done.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          )}
          {(report.problems.length > 0 || report.users.some((u) => !u.ok)) && (
            <div className="fail-box">
              <strong>Requieren revisión:</strong>
              <ul>
                {report.problems.map((p) => <li key={p}>{p}</li>)}
                {report.users.filter((u) => !u.ok).map((u) => <li key={u.line}>{u.name}: {u.note}</li>)}
              </ul>
            </div>
          )}
          <p className="muted">Faltan las fotos de los grupos y de las bases: súbelas en las pestañas Grupos y Bases.</p>
          {credentials.length > 0 && (
            <>
              <h3>Usuarios y contraseñas</h3>
              <p className="muted">Guárdalas ahora: no se pueden consultar después.</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Nombre</th><th>Rol</th><th>Grupo o base</th><th>Usuario</th><th>Contraseña</th></tr></thead>
                  <tbody>
                    {credentials.map((u) => (
                      <tr key={u.line}>
                        <td>{u.name}</td><td>{u.role}</td><td>{u.assignment}</td>
                        <td className="mono">{u.username}</td><td className="mono">{u.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row">
                <button onClick={() => void navigator.clipboard?.writeText(copyText)}>
                  <Copy size={18} aria-hidden="true" /> Copiar todo
                </button>
                <button className="ghost" onClick={downloadCsv}>
                  <Download size={18} aria-hidden="true" /> Descargar CSV
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

const Ok = () => <span className="badge ok">Correcta</span>

function Section({ title, count, errors, children }: { title: string; count: number; errors: number; children: ReactNode }) {
  return (
    <details className="bulk-section" open={errors > 0}>
      <summary>
        {title} · {count}
        {errors > 0 ? <span className="chip lose">{errors} con errores</span> : <span className="chip win">correctas</span>}
      </summary>
      <div className="table-wrap">
        <table className="data-table">
          <tbody>{children}</tbody>
        </table>
      </div>
    </details>
  )
}

function Row({ errors, cells, mono }: { errors: string[]; cells: string[]; mono?: number }) {
  return (
    <tr className={errors.length > 0 ? 'bad' : undefined}>
      {cells.map((c, i) => <td key={i} className={i === mono ? 'mono' : undefined}>{c}</td>)}
      <td>{errors.length === 0 ? <Ok /> : errors.join(' ')}</td>
    </tr>
  )
}
