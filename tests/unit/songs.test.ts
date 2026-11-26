// The songs of the passports: the search term cleaned from what people wrote in a form, the proposal check, the form reader and the catalogue result.
import { describe, expect, it } from 'vitest'
import { cleanSongQuery, isSongLink, looksRight, parseSongRows, toSong, type PassportSong } from '../../src/lib/songs'

const song = (title: string, artist = 'Alguien'): PassportSong => ({ title, artist, preview: 'https://audio-ssl.itunes.apple.com/a.m4a' })

describe('what people wrote becomes a search', () => {
  it('drops times, links, emojis and the jokes after the title, and keeps the title and the artist', () => {
    expect(cleanSongQuery('Animals Maroon 5 (3:00)')).toBe('Animals Maroon 5')
    expect(cleanSongQuery('disparate youth min 4:01')).toBe('disparate youth')
    expect(cleanSongQuery('faded alan walker porque es música electrónica \u{1F4A1}\u{1F4A1}\u{1F90F}')).toBe('faded alan walker')
    expect(cleanSongQuery('Flow cabron jejeje')).toBe('Flow cabron')
    expect(cleanSongQuery('All caps - MF DOOM \u{1F5E3}️')).toBe('All caps - MF DOOM')
    expect(cleanSongQuery('https://open.spotify.com/track/2K9vpqu9?si=abc')).toBe('')
  })
  it('knows a link when it sees one', () => {
    expect(isSongLink('https://open.spotify.com/track/2K9vpqu9?si=abc')).toBe(true)
    expect(isSongLink('Mujeriego')).toBe(false)
  })
})

describe('is the first result what they wrote?', () => {
  it('yes when what they wrote contains the title, with or without accents, symbols and the artist around it', () => {
    expect(looksRight('Comernos - bad gyal/ousi', song('Comernos'))).toBe(true)
    expect(looksRight('Is it a crime de Sade', song('Is It a Crime'))).toBe(true)
    expect(looksRight('PURE/HONEY de Beyonce', song('PURE/HONEY'))).toBe(true)
    expect(looksRight('Danza kuduro', song('Danza Kuduro (feat. Lucenzo)'))).toBe(true)
  })
  it('no when the title is not in it (a human has to listen and decide), or it is too short to mean anything', () => {
    expect(looksRight('la de jaws', song('Jaws Theme'))).toBe(false)
    expect(looksRight('No se', song('Se'))).toBe(false)
  })
})

describe('the form of the induction', () => {
  const table = [
    [
      ['ID', 'Name', 'Nombre', 'Carrera', '¿Qué canción sonaría cada vez que entraras a un lugar?', 'Apodo'],
      ['1', 'cuenta@x', 'Ana María Pérez', 'Sistemas', 'Mujeriego', 'Anita'],
      ['2', 'cuenta@y', 'Luis Ruiz', 'Civil', '', 'Lucho'],
      ['3', 'cuenta@z', '', 'Civil', 'Algo', ''],
      ['4', 'cuenta@w', 'Eva Paz', 'Redes', 'Comernos - bad gyal', 'Eva'],
    ],
  ]
  it('finds the name and the song by the titles of the columns (not the account «Name»), and skips the empty rows', () => {
    const { rows, error } = parseSongRows(table)
    expect(error).toBeNull()
    expect(rows).toEqual([
      { line: 2, name: 'Ana María Pérez', wrote: 'Mujeriego' },
      { line: 5, name: 'Eva Paz', wrote: 'Comernos - bad gyal' },
    ])
  })
  it('explains a file that has no such columns', () => {
    expect(parseSongRows([[['A', 'B'], ['1', '2']]]).error).toMatch(/Nombre/)
  })
})

describe('the song of the catalogue', () => {
  it('keeps only what the passport needs, and drops a result without a preview', () => {
    const ok = toSong({ trackId: 7, trackName: 'Mujeriego', artistName: 'Ryan Castro', previewUrl: 'https://audio-ssl.itunes.apple.com/a.m4a', artworkUrl100: 'https://is1-ssl.mzstatic.com/c.jpg', trackViewUrl: 'https://music.apple.com/x' })
    expect(ok).toEqual({ id: 7, title: 'Mujeriego', artist: 'Ryan Castro', preview: 'https://audio-ssl.itunes.apple.com/a.m4a', cover: 'https://is1-ssl.mzstatic.com/c.jpg', url: 'https://music.apple.com/x' })
    expect(toSong({ trackName: 'Sin audio', artistName: 'X' })).toBeNull()
  })
})
