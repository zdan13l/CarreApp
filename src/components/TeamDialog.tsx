import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { photoUrl } from '../lib/storage'
import { useScrollLock } from '../lib/scrollLock'

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

// A group seen from another group: its picture big, its name and the @ of its runner(s), so they can be found in the Carrera.
export default function TeamDialog({
  name,
  photoPath,
  usernames,
  onClose,
}: {
  name: string
  photoPath: string | null
  usernames: string[]
  onClose: () => void
}) {
  useScrollLock()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const url = photoUrl(photoPath)
  return createPortal(
    <div className="sheet-backdrop centered" role="presentation" onClick={onClose}>
      <section className="account-sheet team-sheet" role="dialog" aria-modal="true" aria-label={`Equipo ${name}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost icon-btn sheet-x" onClick={onClose} aria-label="Cerrar" title="Cerrar">
          <X size={18} />
        </button>
        <span className="team-photo">{url ? <img src={url} alt={`Foto del equipo ${name}`} /> : <b aria-hidden="true">{initialsOf(name)}</b>}</span>
        <h2>{name}</h2>
        {usernames.length > 0 ? (
          <ul className="team-handles">
            {usernames.map((u) => (
              <li key={u}>@{u}</li>
            ))}
          </ul>
        ) : (
          <p className="account-role">Sin corredor registrado</p>
        )}
      </section>
    </div>,
    document.body,
  )
}
