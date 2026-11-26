import { Music, Pause, Play, Volume2 } from 'lucide-react'
import { useState } from 'react'
import { canSetVolume, setSongVolume, toggleSong, useSongPlayer } from '../lib/songPlayer'
import type { PassportSong } from '../lib/songs'

// The song of a person in their passport: the cover, the title and the artist, play / pause and a volume slider (a phone that ignores the volume
// of a web page, like an iPhone, has no slider: its buttons are the volume), and a link to the whole song. The preview lasts 30 s and loops.
export default function SongPlayer({ song }: { song: PassportSong | null | undefined }) {
  const player = useSongPlayer()
  const [volumeOk] = useState(canSetVolume)
  if (!song) return <p className="song-empty">Sin canción todavía</p>
  const playing = player.playing && player.src === song.preview
  return (
    <div className="song-player">
      {song.cover ? <img className="song-cover" src={song.cover} alt="" width={56} height={56} /> : <span className="song-cover empty" aria-hidden="true"><Music size={22} /></span>}
      <div className="song-info">
        <small className="song-label mono">Canción</small>
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
      </div>
      <button type="button" className="song-play" aria-label={playing ? `Pausar ${song.title}` : `Escuchar ${song.title}`} aria-pressed={playing} onClick={() => toggleSong(song.preview)}>
        {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
      </button>
      {volumeOk && (
        <label className="song-volume">
          <Volume2 size={16} aria-hidden="true" />
          <input type="range" min={0} max={100} value={Math.round(player.volume * 100)} onChange={(e) => setSongVolume(Number(e.target.value) / 100)} aria-label="Volumen de la canción" />
        </label>
      )}
      <p className="song-note">
        Fragmento de 30 s
        {song.url && (
          <>
            {' · '}
            <a href={song.url} target="_blank" rel="noopener noreferrer">Escúchala completa</a>
          </>
        )}
        {player.failed && player.src === song.preview && ' · No se pudo reproducir'}
      </p>
    </div>
  )
}
