import { Copy, Download, FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { completeRows, nameKey, readTableFromFile, rowsFromTable, type BulkRow } from '../../lib/bulk'
import { supabase } from '../../lib/supabase'
import { createUser } from '../../lib/usersApi'
import { ROLE_LABEL } from '../../types'
import { errMsg, useAdmin } from './AdminContext'

interface Existing {
  usernames: Set<string>
  teams: Map<string, string> // nameKey -> id
  bases: Map<string, string>
  teamsWithTracker: Set<string>
}

interface Outcome {
  row: BulkRow
  ok: boolean
  note: string
}

const csvCell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

// Creates many users at once from a Word / Excel / CSV file with a fixed format: shows a preview
// with every problem first, then creates the users, the groups and bases that do not exist yet,
// and the assignments. At the end it lists the usernames and passwords (they cannot be read later).
export default function BulkImport({ onDone }: { onDone: () => Promise<void> }) {
  const { event } = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<BulkRow[]>([])
  const [existing, setExisting] = useState<Existing | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)

  async function loadExisting(eventId: string): Promise<Existing> {
    if (!supabase) throw new Error('Supabase no está configurado.')
    const [p, t, b, tr] = await Promise.all([
      supabase.from('profiles').select('username'),
      supabase.from('teams').select('id, name').eq('event_id', eventId),
      supabase.from('bases').select('id, name').eq('event_id', eventId),
      supabase.from('team_runners').select('team_id, is_gps_tracker, teams!inner(event_id)').eq('teams.event_id', eventId),
    ])
    return {
      usernames: new Set((p.data ?? []).map((x) => x.username)),
      teams: new Map((t.data ?? []).map((x) => [nameKey(x.name), x.id])),
      bases: new Map((b.data ?? []).map((x) => [nameKey(x.name), x.id])),
      teamsWithTracker: new Set((tr.data ?? []).filter((x) => x.is_gps_tracker).map((x) => x.team_id)),
    }
  }

  async function onFile(file: File) {
    setError(null)
    setOutcomes(null)
    setRows([])
    setFileName(file.name)
    if (!event) return
    try {
      const table = await readTableFromFile(file)
      const parsed = rowsFromTable(table)
      if (parsed.error) throw new Error(parsed.error)
      const ex = await loadExisting(event.id)
      setExisting(ex)
      setRows(completeRows(parsed.rows, ex.usernames))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const valid = rows.filter((r) => r.errors.length === 0)
  const invalid = rows.length - valid.length
  const newTeams = existing ? [...new Set(valid.filter((r) => r.role === 'runner').map((r) => r.assignment))].filter((n) => !existing.teams.has(nameKey(n))) : []
  const newBases = existing ? [...new Set(valid.filter((r) => r.role === 'base').map((r) => r.assignment))].filter((n) => !existing.bases.has(nameKey(n))) : []

  async function run() {
    if (!supabase || !event || !existing) return
    setBusy(true)
    setError(null)
    setProgress(0)
    const result: Outcome[] = []
    try {
      // 1) Groups and bases that do not exist yet (photo, info and questions are added later).
      const teamIds = new Map(existing.teams)
      const baseIds = new Map(existing.bases)
      for (const name of newTeams) {
        const { data, error: err } = await supabase
          .from('teams')
          .insert({ event_id: event.id, name, sort_order: teamIds.size })
          .select('id')
          .single()
        if (err) throw new Error(`No se pudo crear el grupo "${name}".`)
        teamIds.set(nameKey(name), data.id)
      }
      for (const name of newBases) {
        const { data, error: err } = await supabase
          .from('bases')
          .insert({ event_id: event.id, name, sort_order: baseIds.size })
          .select('id')
          .single()
        if (err) throw new Error(`No se pudo crear la base "${name}".`)
        baseIds.set(nameKey(name), data.id)
      }

      // 2) Who transmits the GPS of each team: the one marked in the file, otherwise the first one.
      const tracker = new Map<string, number>() // team id -> file line
      for (const r of valid.filter((x) => x.role === 'runner')) {
        const teamId = teamIds.get(nameKey(r.assignment))!
        if (existing.teamsWithTracker.has(teamId)) continue
        if (r.gps && !tracker.has(teamId)) tracker.set(teamId, r.line)
      }
      for (const r of valid.filter((x) => x.role === 'runner')) {
        const teamId = teamIds.get(nameKey(r.assignment))!
        if (!existing.teamsWithTracker.has(teamId) && !tracker.has(teamId)) tracker.set(teamId, r.line)
      }

      // 3) Users, one by one, and their assignment.
      for (const [i, r] of valid.entries()) {
        try {
          const created = await createUser({ username: r.username, password: r.password, full_name: r.fullName, role: r.role! })
          if (!created.id) throw new Error('El servidor no devolvió el usuario creado.')
          if (r.role === 'runner') {
            const teamId = teamIds.get(nameKey(r.assignment))!
            const { error: err } = await supabase
              .from('team_runners')
              .insert({ team_id: teamId, user_id: created.id, is_gps_tracker: tracker.get(teamId) === r.line })
            result.push({ row: r, ok: !err, note: err ? `Creado, pero no se pudo asignar al grupo: ${err.message}` : '' })
          } else {
            const { error: err } = await supabase
              .from('base_staff')
              .insert({ base_id: baseIds.get(nameKey(r.assignment))!, user_id: created.id })
            result.push({ row: r, ok: !err, note: err ? `Creado, pero no se pudo asignar a la base: ${err.message}` : '' })
          }
        } catch (e) {
          result.push({ row: r, ok: false, note: errMsg(e) })
        }
        setProgress(i + 1)
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setOutcomes(result)
      setBusy(false)
      await onDone()
    }
  }

  const credentials = (outcomes ?? []).filter((o) => o.ok || o.note.startsWith('Creado'))
  const copyText = credentials
    .map((o) => `${o.row.fullName}\t${ROLE_LABEL[o.row.role!]}\t${o.row.assignment}\t${o.row.username}\t${o.row.password}`)
    .join('\n')

  function downloadCsv() {
    const lines = [['Nombre', 'Rol', 'Grupo o base', 'Usuario', 'Contraseña'], ...credentials.map((o) => [o.row.fullName, ROLE_LABEL[o.row.role!], o.row.assignment, o.row.username, o.row.password])]
    const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'usuarios-carreapp.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!event) return null

  return (
    <section className="card">
      <h2>Cargar desde un archivo</h2>
      <p className="muted">
        Crea muchos usuarios de una vez con una plantilla de Word, Excel o CSV: una persona por fila, con su rol y su
        grupo o base. Los grupos y bases que no existan se crean. Antes de crear nada ves una vista previa con los
        errores.
      </p>
      <div className="row">
        <a className="btn-like" href="/plantillas/plantilla-usuarios.docx" download>
          <FileText size={18} aria-hidden="true" /> Plantilla Word
        </a>
        <a className="btn-like" href="/plantillas/plantilla-usuarios.xlsx" download>
          <FileSpreadsheet size={18} aria-hidden="true" /> Plantilla Excel
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

      {rows.length > 0 && !outcomes && (
        <>
          <p>
            <strong>{rows.length}</strong> filas leídas: <span className="ok-text">{valid.length} correctas</span>
            {invalid > 0 && <>, <span className="error">{invalid} con errores</span></>}.
          </p>
          {(newTeams.length > 0 || newBases.length > 0) && (
            <p className="muted">
              Se crearán {newTeams.length > 0 && <>los grupos: {newTeams.join(', ')}</>}
              {newTeams.length > 0 && newBases.length > 0 && ' y '}
              {newBases.length > 0 && <>las bases: {newBases.join(', ')}</>} (sin foto: se agrega después).
            </p>
          )}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Nombre</th><th>Rol</th><th>Grupo o base</th><th>Usuario</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className={r.errors.length > 0 ? 'bad' : undefined}>
                    <td>{r.line}</td>
                    <td>{r.fullName || '—'}</td>
                    <td>{r.role ? ROLE_LABEL[r.role] : '—'}</td>
                    <td>{r.assignment || '—'}{r.gps && ' · GPS'}</td>
                    <td className="mono">{r.username}</td>
                    <td>{r.errors.length === 0 ? <span className="badge ok">Correcta</span> : r.errors.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invalid > 0 && <p className="warn">Corrige las filas con errores en el archivo y vuelve a subirlo. Solo se crea si todo está bien.</p>}
          <div className="row">
            <button disabled={busy || invalid > 0 || valid.length === 0} onClick={() => void run()}>
              {busy ? `Creando… ${progress} de ${valid.length}` : `Crear ${valid.length} usuarios`}
            </button>
          </div>
        </>
      )}

      {outcomes && (
        <>
          <p className="ok-box">
            Listo: {outcomes.filter((o) => o.ok).length} de {outcomes.length} usuarios creados y asignados.
          </p>
          {outcomes.some((o) => !o.ok) && (
            <div className="fail-box">
              <strong>Requieren revisión:</strong>
              <ul>
                {outcomes.filter((o) => !o.ok).map((o) => <li key={o.row.line}>{o.row.fullName}: {o.note}</li>)}
              </ul>
            </div>
          )}
          <h3>Usuarios y contraseñas</h3>
          <p className="muted">Guárdalas ahora: no se pueden consultar después.</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Nombre</th><th>Rol</th><th>Grupo o base</th><th>Usuario</th><th>Contraseña</th></tr></thead>
              <tbody>
                {credentials.map((o) => (
                  <tr key={o.row.line}>
                    <td>{o.row.fullName}</td>
                    <td>{ROLE_LABEL[o.row.role!]}</td>
                    <td>{o.row.assignment}</td>
                    <td className="mono">{o.row.username}</td>
                    <td className="mono">{o.row.password}</td>
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
    </section>
  )
}
