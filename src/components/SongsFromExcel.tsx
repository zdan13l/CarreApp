import { FileSpreadsheet, Search, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { nameKey, readTablesFromFile } from '../lib/bulk'
import { appleTrack, cleanSongQuery, findSongs, isSongLink, looksRight, parseSongRows, sleep, SEARCH_GAP_MS, type PassportSong } from '../lib/songs'
import { Audition } from './SongCell'

interface Person {
  id: string
  full_name: string
  song?: PassportSong | null
}
interface Row {
  line: number
  name: string
  wrote: string
  query: string
  person: Person | null
  state: 'pending' | 'link' | 'unknown' | 'searching' | 'found' | 'none' | 'error'
  options: PassportSong[]
  pick: number
  use: boolean
}

// The songs people wrote in a form (a column like «¿Qué canción sonaría cada vez que entraras a un lugar?»), found in the Apple Music catalogue
// and matched to the people already registered by their name. Nothing is saved until the coordi has listened to each proposal and applied it:
// what people write is free text («aura o laura», «canciones del Wii»), so the first result is a proposal, not an answer.
export default function SongsFromExcel({ people, onApply }: { people: Person[]; onApply: (items: { id: string; song: PassportSong }[]) => Promise<string | null> }) {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [done, setDone] = useState(0)
  const [applied, setApplied] = useState<string | null>(null)
  const stop = useRef(false)

  async function load(file: File) {
    setError(null)
    setApplied(null)
    try {
      const { rows: answers, error: err } = parseSongRows(await readTablesFromFile(file))
      if (err) return setError(err)
      const byName = new Map<string, Person[]>()
      for (const p of people) byName.set(nameKey(p.full_name), [...(byName.get(nameKey(p.full_name)) ?? []), p])
      setFileName(file.name)
      setDone(0)
      setRows(
        answers.map((a) => {
          const found = byName.get(nameKey(a.name)) ?? []
          const person = found.length === 1 ? found[0] : null
          const state: Row['state'] = !person ? 'unknown' : isSongLink(a.wrote) && !appleTrack(a.wrote) ? 'link' : 'pending'
          return { ...a, query: cleanSongQuery(a.wrote), person, state, options: [], pick: 0, use: false }
        }),
      )
    } catch {
      setError('No se pudo leer el archivo (usa un .xlsx, .csv o .docx).')
    }
  }

  const todo = rows.filter((r) => r.state === 'pending' || r.state === 'error')
  async function searchAll() {
    stop.current = false
    setSearching(true)
    setError(null)
    let n = 0
    for (const row of rows) {
      if (stop.current) break
      if (row.state !== 'pending' && row.state !== 'error') continue
      setRows((all) => all.map((r) => (r.line === row.line ? { ...r, state: 'searching' } : r)))
      try {
        const options = await findSongs(row.wrote, 5)
        const right = options[0] ? Boolean(appleTrack(row.wrote)) || looksRight(row.wrote, options[0]) : false
        setRows((all) => all.map((r) => (r.line === row.line ? { ...r, state: options.length ? 'found' : 'none', options, pick: 0, use: right && !r.person?.song } : r)))
      } catch (e) {
        setRows((all) => all.map((r) => (r.line === row.line ? { ...r, state: 'error' } : r)))
        setError(e instanceof Error ? e.message : 'No se pudo buscar.')
        break
      }
      n += 1
      setDone((d) => d + 1)
      if (n < todo.length) await sleep(SEARCH_GAP_MS) // the catalogue refuses more than ~20 searches a minute
    }
    setSearching(false)
  }

  const chosen = rows.filter((r) => r.use && r.person && r.options[r.pick])
  async function apply() {
    const items = chosen.map((r) => ({ id: r.person!.id, song: r.options[r.pick] }))
    const err = await onApply(items)
    if (err) setError(err)
    else {
      setApplied(`${items.length} ${items.length === 1 ? 'canción guardada' : 'canciones guardadas'}.`)
      setRows((all) => all.map((r) => (r.use ? { ...r, use: false, person: r.person ? { ...r.person, song: r.options[r.pick] } : null } : r)))
    }
  }

  const minutes = Math.ceil((todo.length * SEARCH_GAP_MS) / 60000)
  return (
    <details className="card songs-excel">
      <summary><FileSpreadsheet size={18} aria-hidden="true" /> Canciones desde un Excel</summary>
      <p className="muted">Sube las respuestas del formulario (con las columnas «Nombre» y la de la canción). Se busca cada canción en Apple Music para las personas que ya están registradas; tú escuchas la propuesta y aplicas las que estén bien.</p>
      <label className="btn-like">
        <Upload size={16} aria-hidden="true" /> {fileName || 'Elegir archivo'}
        <input type="file" accept=".xlsx,.csv,.txt,.docx" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void load(f) }} />
      </label>
      {error && <p className="error">{error}</p>}
      {rows.length > 0 && (
        <>
          <p className="muted">
            {rows.length} respuestas · {rows.filter((r) => r.person).length} personas registradas · {rows.filter((r) => !r.person).length} sin registrar (no se buscan).
            {todo.length > 0 && ` Buscar las ${todo.length} que faltan tarda unos ${Math.max(1, minutes)} min (Apple limita las búsquedas).`}
          </p>
          <div className="row">
            <button type="button" disabled={searching || todo.length === 0} onClick={() => void searchAll()}><Search size={16} aria-hidden="true" /> {searching ? `Buscando… ${done}/${done + todo.length}` : 'Buscar canciones'}</button>
            {searching && <button type="button" className="ghost" onClick={() => { stop.current = true }}>Parar</button>}
            <button type="button" disabled={chosen.length === 0} onClick={() => void apply()}>Aplicar {chosen.length} {chosen.length === 1 ? 'canción' : 'canciones'}</button>
          </div>
          {applied && <p className="ok-text">{applied}</p>}
          <ul className="song-review">
            {rows.map((r) => (
              <li key={r.line} className={`song-row ${r.state}`}>
                <span className="song-who"><strong>{r.name}</strong><small className="muted">escribió: «{r.wrote}»</small></span>
                {r.state === 'unknown' && <small className="muted">No está registrado en Inductores.</small>}
                {r.state === 'link' && <small className="muted">Escribió un enlace que no es de Apple Music: búscala a mano en su fila.</small>}
                {r.state === 'pending' && <small className="muted">Por buscar</small>}
                {r.state === 'searching' && <small className="muted">Buscando…</small>}
                {r.state === 'none' && <small className="muted">Sin resultados: búscala a mano.</small>}
                {r.state === 'error' && <small className="muted">Falló la búsqueda.</small>}
                {r.state === 'found' && r.options[r.pick] && (
                  <span className="song-choice">
                    {r.options[r.pick].cover && <img src={r.options[r.pick].cover ?? ''} alt="" width={36} height={36} />}
                    <select value={r.pick} aria-label={`Canción propuesta para ${r.name}`} onChange={(e) => setRows((all) => all.map((x) => (x.line === r.line ? { ...x, pick: Number(e.target.value), use: false } : x)))}>
                      {r.options.map((o, i) => <option key={`${o.id}-${i}`} value={i}>{o.title} · {o.artist}</option>)}
                    </select>
                    <Audition song={r.options[r.pick]} />
                    <label className="inline-field"><span><input type="checkbox" checked={r.use} onChange={(e) => setRows((all) => all.map((x) => (x.line === r.line ? { ...x, use: e.target.checked } : x)))} /> Aplicar</span></label>
                    {r.person?.song && <small className="muted">Ya tiene: {r.person.song.title}</small>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  )
}
