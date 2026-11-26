// The song of each person: a 30 second preview from the Apple Music (iTunes) catalogue, found with its public search (no account, no key) and
// saved in `passports.song` (migration 0042). Everything pure lives here so it can be tested without the network.
export interface PassportSong {
  id?: number | string
  title: string
  artist: string
  preview: string // the audio of 30 s
  cover?: string | null
  url?: string | null // the whole song, in Apple Music
}

interface ITunesResult {
  trackId?: number
  trackName?: string
  artistName?: string
  previewUrl?: string
  artworkUrl100?: string
  trackViewUrl?: string
}

const SEARCH = 'https://itunes.apple.com/search'

export const toSong = (r: ITunesResult): PassportSong | null =>
  r.previewUrl && r.trackName && r.artistName
    ? { id: r.trackId, title: r.trackName.slice(0, 150), artist: r.artistName.slice(0, 150), preview: r.previewUrl, cover: r.artworkUrl100 ?? null, url: r.trackViewUrl ?? null }
    : null

/** Looks a song up in the catalogue. The Apple search limits each IP to about twenty a minute: callers that search many wait between calls. */
export async function searchSongs(term: string, limit = 6, signal?: AbortSignal): Promise<PassportSong[]> {
  const q = term.trim()
  if (!q) return []
  const params = new URLSearchParams({ term: q, media: 'music', entity: 'song', limit: String(limit), country: 'CO' })
  const res = await fetch(`${SEARCH}?${params}`, { signal })
  if (!res.ok) throw new Error('No se pudo buscar la canción: Apple Music no respondió. Espera un minuto y prueba de nuevo.')
  const data = (await res.json()) as { results?: ITunesResult[] }
  return (data.results ?? []).map(toSong).filter((s): s is PassportSong => s !== null)
}

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const flat = (t: string) => fold(t).replace(/[^a-z0-9]/g, '')

export const isSongLink = (text: string) => /https?:\/\//i.test(text)

/** What somebody wrote in a form («Animals Maroon 5 (3:00)», «faded alan walker porque es música electrónica» with an emoji) cleaned up to search it. */
export function cleanSongQuery(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, ' ')
    .replace(/\(?\b(?:min\.?\s*)?\d{1,2}:\d{2}\)?/gi, ' ')
    .replace(/\bporque\b.*$/i, ' ')
    .replace(/\b(?:(?:je){2,}j?|(?:ja){2,}j?|xd)\b/gi, ' ')
    .replace(/\s[:;][a-z)(]\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Is the first result plausibly what they wrote? True when what they wrote contains the title of the song (a human still listens to it). */
export function looksRight(wrote: string, song: PassportSong): boolean {
  const title = flat(song.title.replace(/\(.*?\)|\[.*?\]/g, ''))
  return title.length >= 3 && flat(wrote).includes(title)
}

export interface SongAnswer {
  line: number
  name: string
  wrote: string
}

/** Finds the name and the song of each row of a form (Microsoft Forms, Google Forms…) by the titles of its columns. */
export function parseSongRows(tables: string[][][]): { rows: SongAnswer[]; error: string | null } {
  for (const table of tables) {
    const [head, ...body] = table
    if (!head) continue
    const heads = head.map((h) => fold(String(h ?? '')).replace(/[^a-z0-9? ]/g, ' ').trim())
    const song = heads.findIndex((h) => h.includes('cancion'))
    const name = heads.findIndex((h) => h === 'nombre') >= 0 ? heads.findIndex((h) => h === 'nombre') : heads.findIndex((h) => h.startsWith('nombre'))
    if (song < 0 || name < 0) continue
    const rows: SongAnswer[] = []
    body.forEach((r, i) => {
      const n = String(r[name] ?? '').replace(/\s+/g, ' ').trim()
      const w = String(r[song] ?? '').replace(/\s+/g, ' ').trim()
      if (n && w) rows.push({ line: i + 2, name: n, wrote: w })
    })
    return { rows, error: null }
  }
  return { rows: [], error: 'No encontré las columnas «Nombre» y la de la canción (¿Qué canción sonaría…?) en el archivo.' }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
/** The pause between two searches so the catalogue does not refuse them. */
export const SEARCH_GAP_MS = 3200
