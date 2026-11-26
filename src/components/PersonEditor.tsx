import { Camera, CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { MAX_PRIOR_INDUCTIONS, entryOf, inductionsLabel, priorOf, profileChanges, secondCareerProblem, type IdentityPatch } from '../lib/inductors'
import type { PassportPerson } from '../lib/passports'
import type { PassportSong } from '../lib/songs'
import { USERNAME_PATTERN } from '../lib/username'
import AddLink from './AddLink'
import Avatar from './Avatar'
import GenerationPicker from './GenerationPicker'
import SecondCareerField from './SecondCareerField'
import SongCell from './SongCell'

// The profile of an inductor, edited in place: name, @, career, generation (the entry follows it), nickname, song and photo.
// Nothing is saved until «Guardar».
export default function PersonEditor({
  person,
  career,
  careers,
  usernames,
  busy,
  error,
  onSave,
  onPhoto,
  onClose,
}: {
  person: PassportPerson
  career: string | null
  careers: string[]
  usernames?: Set<string> // every @ in use, to refuse a repeated one
  busy: boolean
  error?: string | null // what went wrong when saving
  onSave: (patch: IdentityPatch) => void
  onPhoto: (file: File) => void
  onClose: () => void
}) {
  const [fullName, setFullName] = useState(person.full_name)
  const [username, setUsername] = useState(person.username)
  const [careerDraft, setCareerDraft] = useState(career ?? '')
  const [secondDraft, setSecondDraft] = useState(person.second_career ?? '')
  const [priorDraft, setPriorDraft] = useState(String(person.prior_inductions ?? 0))
  const [generation, setGeneration] = useState(person.generation ?? '')
  const [nickname, setNickname] = useState(person.nickname ?? '')
  const [song, setSong] = useState<PassportSong | null>(person.song ?? null)
  const [problem, setProblem] = useState<string | null>(null)
  const changes = profileChanges(person, career, { fullName, username, career: careerDraft, secondCareer: secondDraft, priorInductions: priorOf(priorDraft) ?? undefined, generation, nickname, song })
  const entry = entryOf(generation)
  const options = careers.includes(careerDraft) || !careerDraft ? careers : [careerDraft, ...careers]
  const handle = username.trim().toLowerCase().replace(/^@/, '')
  const handleProblem = handle === person.username ? null : !USERNAME_PATTERN.test(handle) ? 'De 3 a 30 letras minúsculas, números, punto, guion o guion bajo.' : usernames?.has(handle) ? 'Ese @ ya existe.' : null

  function save() {
    if (fullName.trim().length < 3) return setProblem('Escribe el nombre completo.')
    if (handleProblem) return setProblem(handleProblem)
    if (!nickname.trim()) return setProblem('Escribe el apodo.')
    if (!careerDraft) return setProblem('Elige la carrera.')
    if (secondDraft.trim() && secondDraft.trim() === careerDraft) return setProblem('La otra carrera es la misma que la primera.')
    const secondProblem = secondCareerProblem(secondDraft)
    if (secondProblem) return setProblem(secondProblem)
    if (!generation) return setProblem('Toda persona pertenece a una generación: elige una.')
    if (priorOf(priorDraft) === null) return setProblem(`Las inducciones que ya llevaba son un número de 0 a ${MAX_PRIOR_INDUCTIONS}.`)
    setProblem(null)
    onSave(changes)
  }

  return (
    <form className="person-editor" onSubmit={(e) => { e.preventDefault(); save() }} aria-label={`Editar el perfil de ${person.full_name}`}>
      <div className="editor-head">
        <Avatar name={fullName || person.full_name} photoPath={person.photo_path} size={56} />
        <span className="grow">
          <strong>Editar perfil</strong>
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
          <span>Usuario (@)</span>
          <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={31} required disabled={busy} autoCapitalize="none" spellCheck={false} aria-invalid={Boolean(handleProblem)} />
          {handleProblem ? <small className="error-note">{handleProblem}</small> : handle !== person.username && <small className="muted">Es con lo que entra: avísale el cambio.</small>}
        </label>
        <label className="inline-field"><span>Apodo</span><input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} required disabled={busy} /></label>
        <div className="inline-field">
          <div className="field-head"><label htmlFor={`career-${person.id}`}>Carrera</label><AddLink to="/admin/programas">Agregar carrera</AddLink></div>
          <select id={`career-${person.id}`} value={careerDraft} onChange={(e) => setCareerDraft(e.target.value)} disabled={busy} required>
            <option value="" disabled>Elige la carrera…</option>
            {options.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="inline-field">
          <div className="field-head"><label htmlFor={`second-${person.id}`}>Otra carrera <small className="muted">(doble programa)</small></label></div>
          <SecondCareerField id={`second-${person.id}`} careers={careers} value={secondDraft} disabled={busy} label={`Otra carrera de ${person.full_name}`} onChange={setSecondDraft} />
        </div>
        <div className="inline-field wide">
          <div className="field-head"><span>Generación</span><AddLink to="/admin/generaciones">Crear generación</AddLink></div>
          <GenerationPicker key={person.generation ?? ''} value={person.generation} label={`Generación de ${person.full_name}`} disabled={busy} required onChange={setGeneration} />
          {(entry || person.joined_term) && <span className="gen-hint"><CalendarCheck size={15} aria-hidden="true" /> Ingresó en <strong>{entry ?? person.joined_term}</strong></span>}
        </div>
        <label className="inline-field wide">
          <span>Inducciones que ya llevaba</span>
          <input type="number" inputMode="numeric" min={0} max={MAX_PRIOR_INDUCTIONS} step={1} value={priorDraft} onChange={(e) => setPriorDraft(e.target.value)} disabled={busy} aria-invalid={priorOf(priorDraft) === null} />
          <small className="muted">Las de antes de CarreApp; queda fija y cada carrera en que participa suma una.{person.inductions != null && <> Hoy lleva <strong>{inductionsLabel(person.inductions)}</strong> en total.</>}</small>
        </label>
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
