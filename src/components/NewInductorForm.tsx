import { CalendarCheck, Music, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { createInductor, entryOf } from '../lib/inductors'
import { nameKey, passportUsername, type PassportPerson } from '../lib/passports'
import type { PassportSong } from '../lib/songs'
import { USERNAME_PATTERN } from '../lib/username'
import AddLink from './AddLink'
import GenerationPicker from './GenerationPicker'
import SongCell from './SongCell'

export interface Created {
  username: string
  password: string
  label: string
}

// Registers ONE inductor: who they are (name, @, career, generation, nickname) and the song that sounds when they walk in. It is the only form
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
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [typedUsername, setTypedUsername] = useState(false) // once the coordi writes the @, it stops following the name
  const [generation, setGeneration] = useState('')
  const [song, setSong] = useState<PassportSong | null>(null)
  const entry = entryOf(generation)
  const suggestion = name.trim().length >= 3 ? passportUsername(name, new Set(usernames)) : ''
  const handle = typedUsername ? username : suggestion
  const handleProblem = !handle ? null : !USERNAME_PATTERN.test(handle) ? 'De 3 a 30 letras minúsculas, números, punto, guion o guion bajo.' : usernames.has(handle) ? 'Ese @ ya existe.' : null

  async function submit(form: HTMLFormElement) {
    const f = new FormData(form)
    const fullName = name.trim().replace(/\s+/g, ' ')
    const career = String(f.get('career') ?? '')
    const secondCareer = String(f.get('second_career') ?? '')
    const nickname = String(f.get('nickname') ?? '').trim()
    if (fullName.length < 3) return onError('Escribe el nombre completo.')
    if (!handle || handleProblem) return onError(handleProblem ?? 'Escribe el @ del inductor.')
    if (!career) return onError('Elige la carrera.')
    if (secondCareer && secondCareer === career) return onError('La otra carrera es la misma que la primera.')
    if (!nickname) return onError('Escribe el apodo.')
    if (!generation) return onError('Elige la generación: toda persona entra en una.')
    const known = people.find((x) => nameKey(x.full_name) === nameKey(fullName))
    if (known) return onError(`${known.full_name} ya existe (@${known.username}). Agrégala a una carrera desde la pestaña Inductores de esa carrera.`)
    await run(async () => {
      const made = await createInductor({ fullName, career, secondCareer: secondCareer || null, generation, nickname, song, username: handle }, usernames)
      setRound((n) => n + 1)
      setName('')
      setUsername('')
      setTypedUsername(false)
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
          <label className="inline-field wide"><span>Nombre completo</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={80} placeholder="Nombre Apellido" autoComplete="off" /></label>
          <label className="inline-field">
            <span>Usuario (@)</span>
            <input value={handle} onChange={(e) => { setTypedUsername(true); setUsername(e.target.value.toLowerCase().replace(/^@/, '')) }} required maxLength={30} placeholder="nombre.apellido" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(handleProblem)} />
            {handleProblem && <small className="error-note">{handleProblem}</small>}
          </label>
          <label className="inline-field"><span>Apodo</span><input name="nickname" required maxLength={24} autoComplete="off" /></label>
          <div className="inline-field">
            <div className="field-head"><label htmlFor="new-career">Carrera</label><AddLink to="/admin/programas">Agregar carrera</AddLink></div>
            {careers.length > 0 ? (
              <select id="new-career" name="career" required defaultValue="">
                <option value="" disabled>Elige la carrera…</option>
                {careers.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <span className="field-note">Todavía no hay carreras.</span>
            )}
          </div>
          <div className="inline-field">
            <div className="field-head"><label htmlFor="new-second-career">Otra carrera <small className="muted">(doble programa)</small></label></div>
            <select id="new-second-career" name="second_career" defaultValue="" disabled={careers.length === 0}>
              <option value="">Ninguna</option>
              {careers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="inline-field wide">
            <div className="field-head"><span>Generación</span><AddLink to="/admin/generaciones">Crear generación</AddLink></div>
            <GenerationPicker value="" name="generation" label="Generación" disabled={busy} required onChange={setGeneration} />
            {entry && <span className="gen-hint"><CalendarCheck size={15} aria-hidden="true" /> Ingresó en <strong>{entry}</strong></span>}
          </div>
        </div>
      </div>
      <div className="form-block">
        <h3><Music size={16} aria-hidden="true" /> Su canción <small className="muted">(opcional)</small></h3>
        <SongCell song={song} name="este inductor" disabled={busy} onChange={setSong} />
      </div>
      <div className="row form-actions">
        <button disabled={busy || careers.length === 0}><UserPlus size={18} aria-hidden="true" /> {busy ? 'Registrando…' : 'Registrar inductor/a'}</button>
      </div>
    </form>
  )
}
