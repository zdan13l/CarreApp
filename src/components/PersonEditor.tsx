import { Camera, CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { entryOf, profileChanges, type IdentityPatch } from '../lib/inductors'
import type { PassportPerson } from '../lib/passports'
import type { PassportSong } from '../lib/songs'
import Avatar from './Avatar'
import GenerationPicker from './GenerationPicker'
import SongCell from './SongCell'

// The profile of an inductor, edited in place: name, career, generation (the entry follows it), nickname, song and photo. Nothing is saved until «Guardar».
export default function PersonEditor({
  person,
  career,
  careers,
  busy,
  error,
  onSave,
  onPhoto,
  onClose,
}: {
  person: PassportPerson
  career: string | null
  careers: string[]
  busy: boolean
  error?: string | null // what went wrong when saving
  onSave: (patch: IdentityPatch) => void
  onPhoto: (file: File) => void
  onClose: () => void
}) {
  const [fullName, setFullName] = useState(person.full_name)
  const [careerDraft, setCareerDraft] = useState(career ?? '')
  const [generation, setGeneration] = useState(person.generation ?? '')
  const [nickname, setNickname] = useState(person.nickname ?? '')
  const [song, setSong] = useState<PassportSong | null>(person.song ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  const changes = profileChanges(person, career, { fullName, career: careerDraft, generation, nickname, song })
  const entry = entryOf(generation)
  const options = careers.includes(careerDraft) || !careerDraft ? careers : [careerDraft, ...careers]

  function save() {
    if (fullName.trim().length < 3) return setProblem('Escribe el nombre completo.')
    if (!careerDraft) return setProblem('Elige la carrera.')
    if (!generation) return setProblem('Toda persona pertenece a una generación: elige una.')
    setProblem(null)
    onSave(changes)
  }

  return (
    <form className="person-editor" onSubmit={(e) => { e.preventDefault(); save() }} aria-label={`Editar el perfil de ${person.full_name}`}>
      <div className="editor-head">
        <Avatar name={fullName || person.full_name} photoPath={person.photo_path} size={56} />
        <span className="grow">
          <strong>Editar perfil</strong>
          <small className="muted mono">@{person.username} · el usuario no cambia</small>
        </span>
        <label className={`btn-like${busy ? ' disabled' : ''}`}>
          <Camera size={18} aria-hidden="true" />
          {person.photo_path ? 'Cambiar foto' : 'Agregar foto'}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(f) }} />
        </label>
      </div>
      <div className="grid2">
        <label className="inline-field wide"><span>Nombre completo</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={3} maxLength={80} required disabled={busy} /></label>
        <label className="inline-field">
          <span>Carrera</span>
          <select value={careerDraft} onChange={(e) => setCareerDraft(e.target.value)} disabled={busy} required>
            <option value="" disabled>Elige la carrera…</option>
            {options.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="inline-field"><span>Apodo <small className="muted">(opcional)</small></span><input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} disabled={busy} /></label>
        <div className="inline-field wide">
          <span>Generación</span>
          <GenerationPicker key={person.generation ?? ''} value={person.generation} label={`Generación de ${person.full_name}`} disabled={busy} required onChange={setGeneration} />
          <span className="gen-hint">
            {entry ? <><CalendarCheck size={15} aria-hidden="true" /> Ingresó en <strong>{entry}</strong> (sale de la generación)</> : person.joined_term ? <>Ingresó en <strong>{person.joined_term}</strong></> : null}
            <Link to="/admin/generaciones">¿No está? Crea la generación</Link>
          </span>
        </div>
      </div>
      <div className="form-block">
        <h3>Su canción</h3>
        <SongCell song={song} name={person.full_name} disabled={busy} onChange={setSong} />
      </div>
      {(problem || error) && <p className="error" role="alert">{problem ?? error}</p>}
      <div className="row form-actions">
        <button disabled={busy || Object.keys(changes).length === 0}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        <button type="button" className="ghost" disabled={busy} onClick={onClose}>Cancelar</button>
      </div>
    </form>
  )
}
