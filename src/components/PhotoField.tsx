import { Camera, ImageOff } from 'lucide-react'
import { photoUrl } from '../lib/storage'

// Photo preview plus a button to pick a file (camera or gallery on phones).
export default function PhotoField({
  path,
  label,
  busy,
  onPick,
}: {
  path: string | null
  label: string
  busy: boolean
  onPick: (file: File) => void
}) {
  const url = photoUrl(path)
  return (
    <div className="photo-field">
      <div className="photo-box">
        {url ? (
          <img src={url} alt={label} />
        ) : (
          <>
            <ImageOff size={26} aria-hidden="true" />
            <span>Sin foto</span>
          </>
        )}
      </div>
      <label className={`btn-like${busy ? ' disabled' : ''}`}>
        <Camera size={18} aria-hidden="true" />
        {busy ? 'Subiendo…' : path ? 'Cambiar foto' : 'Subir foto'}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPick(file)
          }}
        />
      </label>
    </div>
  )
}
