import { useSyncExternalStore } from 'react'

// ONE player for the whole app (a passport never plays two songs at once): the 30 s preview in a loop, with pause and volume.
// The browser only lets sound start after a tap, so `playSong` is called from a tap (opening the cover of the passport, a play button).
interface State {
  src: string | null
  playing: boolean
  volume: number
  failed: boolean
}
const KEY = 'carreapp.songVolume'
const readVolume = () => {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem(KEY) !== null ? v : 0.8
  } catch {
    return 0.8
  }
}

let audio: HTMLAudioElement | null = null
let state: State = { src: null, playing: false, volume: readVolume(), failed: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function ensure(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.loop = true
    audio.preload = 'none'
    audio.volume = state.volume
    audio.addEventListener('play', () => set({ playing: true, failed: false }))
    audio.addEventListener('pause', () => set({ playing: false }))
    audio.addEventListener('error', () => set({ playing: false, failed: true }))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) audio?.pause() // the music stops when the phone is locked or the tab is left
    })
  }
  return audio
}

/** Starts a preview (call it from a tap). Resolves false when the browser refused. */
export async function playSong(src: string): Promise<boolean> {
  const a = ensure()
  if (state.src !== src) {
    a.src = src
    set({ src })
  }
  try {
    await a.play()
    return true
  } catch {
    set({ playing: false, failed: true })
    return false
  }
}

export function toggleSong(src: string) {
  if (state.src === src && state.playing) audio?.pause()
  else void playSong(src)
}

export function stopSong() {
  audio?.pause()
}

export function setSongVolume(v: number) {
  const volume = Math.min(1, Math.max(0, v))
  if (audio) audio.volume = volume
  try {
    localStorage.setItem(KEY, String(volume))
  } catch {
    // the volume is a convenience: it works without saving it
  }
  set({ volume })
}

/** iPhones ignore the volume of a web page (the buttons of the phone are the volume): there the slider is hidden. */
export function canSetVolume(): boolean {
  try {
    const a = ensure()
    const before = a.volume
    a.volume = before > 0.5 ? 0.4 : 0.9
    const ok = Math.abs(a.volume - (before > 0.5 ? 0.4 : 0.9)) < 0.01
    a.volume = state.volume
    return ok
  } catch {
    return false
  }
}

export function useSongPlayer(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
