import { CalendarCheck, Music, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createInductor, entryOf } from '../lib/inductors'
import { nameKey, type PassportPerson } from '../lib/passports'
import type { PassportSong } from '../lib/songs'
import GenerationPicker from './GenerationPicker'
import SongCell from './SongCell'

export interface Created {
  username: string
  password: string
  label: string
}

// Registers ONE inductor: who they are (name, career, generation, nickname) and the song that sounds when they walk in. It is the only form
// that creates a person (the Excel next to it creates many at once); inside a carrera people only join it.
export default function NewInductorForm({
  careers,
  people,
  usernames,
  busy,
  run,
  onError,
  onCreated,
}: {
  careers: string[]
  people: PassportPerson[]
  usernames: Set<string>
  busy: boolean
  run: (action: () => Promise<void>) => Promise<void>
  onError: (message: string) => void
  onCreated: (created: Created) => void
}) {
  const [round, setRound] = useState(0) // a new key empties the form after each registration
  const [generation, setGeneration] = useState('')
  const [song, setSong] = useState<PassportSong | null>(null)
  const entry = entryOf(generation)

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form)
    const fullName = String(f.get('name') ?? '').trim().replace(/\s+/g, ' ')
    const career = String(f.get('career') ?? '')
    const nickname = String(f.get('nickname') ?? '').trim()
    if (fullName.length < 3) return onError('Escribe el nombre completo.')
    if (!career) return onError('Elige la carrera.')
    if (!generation) return onError('Elige la generación: toda persona entra en una.')
    const known = people.find((x) => nameKey(x.full_name) === nameKey(fullName))
    if (known) return onError(`${known.full_name} ya existe (@${known.username}). Agrégala a una carrera desde la pestaña Inductores de esa carrera.`)
    await run(async () => {
      const made = await createInductor({ fullName, career, generation, nickname, song }, usernames)
      setRound((n) => n + 1)
      setGeneration('')
      setSong(null)
      onCreated({ username: made.username, password: made.password, label: `Usuario nuevo de ${fullName}` })
    })
  }

  return (
    <form key={round} className="new-inductor" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget) }}>
      <div className="form-block">
        <h3>Quién es</h3>
        <div className="grid2">
          <label className="inline-field wide"><span>Nombre completo</span><input name="name" required minLength={3} maxLength={80} placeholder="Nombre Apellido" autoComplete="off" /></label>
          <label className="inline-field">
            <span>Carrera</span>
            {careers.length > 0 ? (
              <select name="career" required defaultValue="">
                <option value="" disabled>Elige la carrera…</option>
                {careers.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <span className="muted field-note">Todavía no hay carreras: agrégalas en <Link to="/admin/programas">Programas académicos</Link>.</span>
            )}
          </label>
          <label className="inline-field"><span>Apodo <small className="muted">(opcional)</small></span><input name="nickname" maxLength={24} autoComplete="off" /></label>
          <div className="inline-field wide">
            <span>Generación</span>
            <GenerationPicker value="" name="generation" label="Generación" disabled={busy} required onChange={setGeneration} />
            <span className="gen-hint">
              {entry ? <><CalendarCheck size={15} aria-hidden="true" /> Ingresó en <strong>{entry}</strong> (sale de la generación)</> : generation ? 'Esta generación no tiene semestre: no se llena el ingreso.' : 'El ingreso se llena solo con la generación.'}
              <Link to="/admin/generaciones">¿No está? Crea la generación</Link>
            </span>
          </div>
        </div>
      </div>
      <div className="form-block">
        <h3><Music size={16} aria-hidden="true" /> Su canción <small className="muted">(opcional)</small></h3>
        <p className="muted">La que sonaría cada vez que entrara a un lugar. Busca por título y artista, o pega el enlace de Apple Music. Suena en su pasaporte.</p>
        <SongCell song={song} name="este inductor" disabled={busy} onChange={setSong} />
      </div>
      <div className="row form-actions">
        <button disabled={busy || careers.length === 0}><UserPlus size={18} aria-hidden="true" /> {busy ? 'Registrando…' : 'Registrar inductor/a'}</button>
        <span className="muted">Se crea su usuario y la contraseña se muestra una sola vez.</span>
      </div>
    </form>
  )
}
