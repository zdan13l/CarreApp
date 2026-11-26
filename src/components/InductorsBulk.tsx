import { Download, FileSpreadsheet, Search, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { createInductor, readInductorsFile, rowProblem, songSearchOf, type InductorIn } from '../lib/inductors'
import { credentialsWorkbook, downloadBlob, nameKey, templateWorkbook, type CredentialRow, type PassportPerson } from '../lib/passports'
import { GENERATIONS } from '../lib/seals'
import { appleTrack, findSongs, looksRight, sleep, SEARCH_GAP_MS, type PassportSong } from '../lib/songs'
import { supabase } from '../lib/supabase'
import { errMsg } from '../pages/admin/AdminContext'
import GenerationPicker from './GenerationPicker'
import { Audition } from './SongCell'

interface Row extends InductorIn {
  state: 'idle' | 'searching' | 'found' | 'none' | 'error'
  options: PassportSong[]
  pick: number
  use: boolean // apply the proposed song
}

interface Report {
  created: number
  songs: number
  failed: { name: string; why: string }[]
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// The Excel of a whole induction in one go: names, careers, generations and, if the form asked it, the song each one wrote. The songs are
// searched in Apple Music and the coordi listens to each proposal before anything is saved (what people write is free text). People already
// registered only get their song. One file, one button: it creates the logins and gives back the Excel with the passwords.
export default function InductorsBulk({ careers, people, usernames, onDone, startRows }: { careers: string[]; people: PassportPerson[]; usernames: Set<string>; onDone: () => Promise<void>; startRows?: InductorIn[] }) {
  const [rows, setRows] = useState<Row[] | null>(startRows ? startRows.map((r) => ({ ...r, state: 'idle', options: [], pick: 0, use: false })) : null) // startRows: only for the design preview
  const [fileName, setFileName] = useState('')
  const [generation, setGeneration] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [done, setDone] = useState(0)
  const [creating, setCreating] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [sheet, setSheet] = useState<CredentialRow[] | null>(null)
  const stop = useRef(false)
  const byUser = new Map(people.map((p) => [p.username, p]))

  async function load(file: File) {
    setError(null)
    setReport(null)
    setSheet(null)
    setRows(null)
    try {
      const known = new Map(people.map((p) => [nameKey(p.full_name), p.username]))
      const parsed = await readInductorsFile(file, { careers, usernames, known, defaultGeneration: generation })
      setFileName(file.name)
      setDone(0)
      setRows(parsed.map((r) => ({ ...r, state: 'idle', options: [], pick: 0, use: false })))
    } catch (e) {
      setError(errMsg(e))
    }
  }
  const patch = (line: number, p: Partial<Row>) => setRows((all) => all?.map((r) => (r.line === line ? { ...r, ...p } : r)) ?? null)

  const all = rows ?? []
  const ready = all.filter((r) => !rowProblem(r))
  const fresh = ready.filter((r) => !r.existing)
  const existingSongs = all.filter((r) => r.existing && r.use && r.options[r.pick] && !r.errors.length) // people already registered that only get a song
  const todo = all.filter((r) => (r.state === 'idle' || r.state === 'error') && songSearchOf(r))

  async function searchAll() {
    stop.current = false
    setSearching(true)
    setError(null)
    let n = 0
    for (const row of todo) {
      if (stop.current) break
      patch(row.line, { state: 'searching' })
      try {
        const options = await findSongs(songSearchOf(row), 5)
        const right = options[0] ? Boolean(appleTrack(row.songWritten)) || looksRight(row.songWritten, options[0]) : false
        const already = row.existing ? Boolean(byUser.get(row.username)?.song) : false
        patch(row.line, { state: options.length ? 'found' : 'none', options, pick: 0, use: right && !already })
      } catch (e) {
        patch(row.line, { state: 'error' })
        setError(e instanceof Error ? e.message : 'No se pudo buscar.')
        break
      }
      n += 1
      setDone((d) => d + 1)
      if (n < todo.length) await sleep(SEARCH_GAP_MS) // the catalogue refuses more than ~20 searches a minute
    }
    setSearching(false)
  }

  async function create() {
    if (!supabase) return
    const out: Report = { created: 0, songs: 0, failed: [] }
    const credentials: CredentialRow[] = []
    const queue = [...fresh, ...existingSongs]
    let next = 0
    setError(null)
    const worker = async () => {
      for (;;) {
        const i = next++
        if (i >= queue.length) return
        const r = queue[i]
        setCreating(`Guardando ${i + 1} de ${queue.length}…`)
        const song = r.use ? (r.options[r.pick] ?? null) : null
        try {
          if (r.existing) {
            const who = byUser.get(r.username)
            if (!who || !song) throw new Error('No se encontró a la persona.')
            const { error: err } = await supabase!.from('passports').update({ song }).eq('id', who.id)
            if (err) throw new Error(/song|migraci/i.test(err.message) ? 'Falta aplicar la migración 0042.' : 'No se pudo guardar la canción.')
            out.songs++
          } else {
            const made = await createInductor({ fullName: r.fullName, career: r.career!, generation: r.generation, nickname: r.nickname, song, username: r.username }, usernames)
            out.created++
            if (song) out.songs++
            credentials.push({ fullName: r.fullName, career: r.career!, generation: r.generation, username: made.username, password: made.password })
          }
        } catch (e) {
          out.failed.push({ name: r.fullName, why: errMsg(e) })
        }
      }
    }
    try {
      await Promise.all([worker(), worker(), worker(), worker()])
      credentials.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      setReport(out)
      setRows(null)
      setFileName('')
      if (credentials.length) {
        setSheet(credentials)
        downloadBlob(await credentialsWorkbook(credentials), 'credenciales-inductores.xlsx')
      }
      await onDone()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setCreating('')
    }
  }

  const busy = Boolean(creating)
  const minutes = Math.max(1, Math.ceil((todo.length * SEARCH_GAP_MS) / 60000))
  const generationNames = GENERATIONS.map((g) => g.name)

  return (
    <div className="bulk-inductors">
      <ol className="bulk-steps">
        <li>
          <strong>Descarga la plantilla.</strong> Lleva las columnas <em>Nombre</em>, <em>Carrera</em>, <em>Generación</em>, <em>Apodo</em> y la <em>canción</em> (la pregunta del formulario, tal cual llega). Borra las filas de ejemplo.
          <div className="row"><button type="button" className="ghost" onClick={async () => downloadBlob(await templateWorkbook(careers, generationNames), 'plantilla-inductores.xlsx')}><FileSpreadsheet size={18} aria-hidden="true" /> Descargar plantilla</button></div>
        </li>
        <li>
          <strong>Generación de quienes no la traen.</strong> Todo inductor entra en una generación; si el archivo no la dice, se usa esta.
          <div className="row"><GenerationPicker value={generation} label="Generación para quienes no la traen" onChange={setGeneration} disabled={busy} /></div>
        </li>
        <li>
          <strong>Sube el archivo</strong> (.xlsx, .csv o .docx). Las canciones se buscan en Apple Music y tú las escuchas antes de guardarlas.
          <div className="row">
            <label className={`btn-like${busy ? ' disabled' : ''}`}>
              <Upload size={18} aria-hidden="true" /> {rows ? 'Cambiar archivo' : 'Elegir archivo'}
              <input type="file" accept=".xlsx,.csv,.txt,.docx" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void load(f) }} />
            </label>
            {fileName && rows && <span className="muted">{fileName}</span>}
          </div>
        </li>
      </ol>

      {error && <p className="error" role="alert">{error}</p>}

      {rows && (
        <>
          <p className="muted bulk-summary">
            {plural(all.length, 'fila', 'filas')} · {plural(fresh.length, 'inductor nuevo', 'inductores nuevos')} · {plural(all.filter((r) => r.existing).length, 'ya registrado (solo la canción)', 'ya registrados (solo la canción)')}
            {all.length - ready.length > 0 && ` · ${plural(all.length - ready.length, 'fila por arreglar', 'filas por arreglar')}`}
          </p>
          <div className="row">
            <button type="button" className="ghost" disabled={searching || busy || todo.length === 0} onClick={() => void searchAll()}>
              <Search size={16} aria-hidden="true" /> {searching ? `Buscando… ${done}/${done + todo.length}` : todo.length ? `Buscar ${plural(todo.length, 'canción', 'canciones')} (unos ${minutes} min)` : 'Canciones buscadas'}
            </button>
            {searching && <button type="button" className="ghost" onClick={() => { stop.current = true }}>Parar</button>}
          </div>

          <ul className="bulk-rows">
            {rows.map((r) => {
              const problem = rowProblem(r)
              const proposal = r.options[r.pick]
              return (
                <li key={r.line} className={`bulk-row${problem ? ' bad' : ''}`}>
                  <span className="bulk-who">
                    <strong>{r.fullName}</strong>
                    <small className="muted mono">@{r.username}</small>
                    {r.nickname && <small className="muted">Apodo «{r.nickname}»</small>}
                    {r.errors.length ? <span className="badge warn-tone">{r.errors[0]}</span> : r.existing ? <span className="badge">Ya registrado · solo la canción</span> : problem ? <span className="badge warn-tone">{problem}</span> : <span className="badge ok">Nuevo</span>}
                  </span>
                  {!r.existing && (
                    <span className="bulk-fields">
                      <select value={r.career ?? ''} aria-label={`Carrera de ${r.fullName}`} onChange={(e) => patch(r.line, { career: e.target.value || null })}>
                        <option value="">{r.careerWritten ? `Elegir (decía «${r.careerWritten}»)` : 'Elegir carrera…'}</option>
                        {careers.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <GenerationPicker key={`${r.line}-${r.generation}`} value={r.generation} label={`Generación de ${r.fullName}`} onChange={(g) => patch(r.line, { generation: g, errors: r.errors.filter((x) => !/generación/i.test(x)) })} />
                    </span>
                  )}
                  {r.songWritten && (
                    <span className="bulk-song">
                      <small className="muted">escribió: «{r.songWritten}»</small>
                      {r.state === 'idle' && !songSearchOf(r) && <small className="muted">Es un enlace que no es de Apple Music: elígela a mano en su perfil.</small>}
                      {r.state === 'searching' && <small className="muted">Buscando…</small>}
                      {r.state === 'none' && <small className="muted">Sin resultados: elígela a mano en su perfil.</small>}
                      {r.state === 'error' && <small className="muted">Falló la búsqueda.</small>}
                      {r.state === 'found' && proposal && (
                        <span className="song-choice">
                          {proposal.cover && <img src={proposal.cover} alt="" width={36} height={36} />}
                          <select value={r.pick} aria-label={`Canción propuesta para ${r.fullName}`} onChange={(e) => patch(r.line, { pick: Number(e.target.value), use: false })}>
                            {r.options.map((o, i) => <option key={`${o.id}-${i}`} value={i}>{o.title} · {o.artist}</option>)}
                          </select>
                          <Audition song={proposal} />
                          <label className="check-inline"><input type="checkbox" checked={r.use} onChange={(e) => patch(r.line, { use: e.target.checked })} /> Usar</label>
                          {r.existing && byUser.get(r.username)?.song && <small className="muted">Ya tiene: {byUser.get(r.username)!.song!.title}</small>}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="row">
            <button type="button" disabled={busy || searching || (fresh.length === 0 && existingSongs.length === 0)} onClick={() => void create()}>
              {busy ? creating : fresh.length ? `Crear ${plural(fresh.length, 'inductor', 'inductores')} y descargar las contraseñas` : `Guardar ${plural(existingSongs.length, 'canción', 'canciones')}`}
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => { setRows(null); setFileName('') }}>Cancelar</button>
          </div>
        </>
      )}

      {report && (
        <div className="report">
          <p>
            <strong>{plural(report.created, 'inductor creado', 'inductores creados')}</strong>
            {report.songs > 0 && ` y ${plural(report.songs, 'canción guardada', 'canciones guardadas')}`}.
          </p>
          {sheet && (
            <>
              <p className="muted">El Excel con los usuarios y las contraseñas se descargó solo. Las contraseñas no se pueden consultar después: guárdalo bien.</p>
              <button type="button" className="ghost" onClick={async () => downloadBlob(await credentialsWorkbook(sheet), 'credenciales-inductores.xlsx')}><Download size={18} aria-hidden="true" /> Descargar de nuevo</button>
            </>
          )}
          {report.failed.length > 0 && (
            <ul className="list">
              {report.failed.map((f) => (
                <li key={f.name}><span className="grow">{f.name}</span><span className="badge warn-tone">{f.why}</span></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
