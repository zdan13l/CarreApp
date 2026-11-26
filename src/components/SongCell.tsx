import { Music, Pause, Play, Search, X } from 'lucide-react'
import { useState } from 'react'
import { toggleSong, useSongPlayer } from '../lib/songPlayer'
import { cleanSongQuery, searchSongs, type PassportSong } from '../lib/songs'

// The play button to listen to a preview before choosing it
export function Audition({ song }: { song: PassportSong }) {
  const player = useSongPlayer()
  const playing = player.playing && player.src === song.preview
  return (
    <button type="button" className="ghost icon-btn" aria-label={playing ? `Pausar ${song.title}` : `Escuchar ${song.title}`} onClick={() => toggleSong(song.preview)}>
      {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
    </button>
  )
}

// The song of a person, in the list of Inductores: the current one (to listen to) and a search in the Apple Music catalogue to change it.
export default function SongCell({ song, name, disabled, onChange }: { song: PassportSong | null | undefined; name: string; disabled?: boolean; onChange: (song: PassportSong | null) => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PassportSong[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    setBusy(true)
    setError(null)
    try {
      const found = await searchSongs(cleanSongQuery(term) || term, 6)
      setResults(found)
      if (found.length === 0) setError('No encontré esa canción: prueba con el título y el artista.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="song-cell">
      {song ? (
        <span className="song-current">
          {song.cover ? <img src={song.cover} alt="" width={32} height={32} /> : <Music size={18} aria-hidden="true" />}
          <span className="grow"><strong>{song.title}</strong> <small className="muted">{song.artist}</small></span>
          <Audition song={song} />
        </span>
      ) : (
        <small className="muted">Sin canción</small>
      )}
      <button type="button" className="ghost" disabled={disabled} onClick={() => setOpen(!open)} aria-expanded={open}>{song ? 'Cambiar canción' : 'Elegir canción'}</button>
      {song && <button type="button" className="ghost danger icon-btn" disabled={disabled} aria-label={`Quitar la canción de ${name}`} onClick={() => onChange(null)}><X size={16} aria-hidden="true" /></button>}
      {open && (
        <span className="song-search">
          <form onSubmit={(e) => { e.preventDefault(); void search() }}>
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Título y artista" aria-label={`Buscar la canción de ${name}`} maxLength={120} />
            <button disabled={busy || !term.trim()}><Search size={16} aria-hidden="true" /> {busy ? 'Buscando…' : 'Buscar'}</button>
          </form>
          {error && <span className="error">{error}</span>}
          <ul className="song-results">
            {(results ?? []).map((r) => (
              <li key={`${r.id}-${r.preview}`}>
                {r.cover && <img src={r.cover} alt="" width={36} height={36} />}
                <span className="grow"><strong>{r.title}</strong> <small className="muted">{r.artist}</small></span>
                <Audition song={r} />
                <button type="button" disabled={disabled} onClick={() => { onChange(r); setOpen(false); setResults(null); setTerm('') }}>Elegir</button>
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  )
}
