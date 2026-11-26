// Migration 0042: the song of each person in their passport (a 30 second preview from Apple Music).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type TestDb } from './harness'
import { addUser, getAdmin } from './seed'

let db: TestDb
beforeAll(async () => {
  db = await createDb()
})
afterAll(async () => {
  await db.close()
})

let n = 0
const person = async () => {
  const name = `cantante.${++n}`
  const id = await addUser(db, name, 'runner')
  await db.sql(`delete from public.profiles where id = $1`, [id])
  await db.sql(`insert into public.passports (id, username, full_name) values ($1, $2, $2)`, [id, name])
  return id
}
const SONG = {
  id: 1600575365,
  title: 'Mujeriego',
  artist: 'Ryan Castro',
  preview: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/aa/bb/mzaf_1.plus.aac.p.m4a',
  cover: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/29/73/62/a.jpg/100x100bb.jpg',
  url: 'https://music.apple.com/co/album/mujeriego/1600575035?i=1600575365',
}
const set = (as: string, id: string, song: unknown) => db.asUser(as).sql(`update public.passports set song = $2::jsonb where id = $1`, [id, JSON.stringify(song)])

describe('the song of a passport (0042)', () => {
  it('the coordi sets it and clears it', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await set(admin, id, SONG)
    expect((await db.sql<{ song: typeof SONG }>(`select song from public.passports where id = $1`, [id]))[0].song.title).toBe('Mujeriego')
    await db.asUser(admin).sql(`update public.passports set song = null where id = $1`, [id])
    expect((await db.sql<{ song: unknown }>(`select song from public.passports where id = $1`, [id]))[0].song).toBeNull()
  })

  it('nobody sets their own song (nor anybody else\'s)', async () => {
    const a = await person()
    const b = await person()
    expect(await db.asUser(a).affected(`update public.passports set song = $2::jsonb where id = $1`, [a, JSON.stringify(SONG)])).toBe(0)
    expect(await db.asUser(a).affected(`update public.passports set song = $2::jsonb where id = $1`, [b, JSON.stringify(SONG)])).toBe(0)
  })

  it('only the data of a song, and only from Apple: the audio, the cover and the link cannot point anywhere else', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await expect(set(admin, id, { ...SONG, preview: 'https://evil.example.com/a.m4a' })).rejects.toThrow(/Apple Music/)
    await expect(set(admin, id, { ...SONG, preview: 'http://audio-ssl.itunes.apple.com/a.m4a' })).rejects.toThrow(/Apple Music/) // not https
    await expect(set(admin, id, { ...SONG, preview: 'https://apple.com.evil.example.com/a.m4a' })).rejects.toThrow(/Apple Music/)
    await expect(set(admin, id, { ...SONG, cover: 'https://evil.example.com/c.jpg' })).rejects.toThrow(/carátula/)
    await expect(set(admin, id, { ...SONG, url: 'https://evil.example.com/s' })).rejects.toThrow(/enlace/)
    await expect(set(admin, id, { ...SONG, extra: 'x' })).rejects.toThrow(/solo puede tener/)
    await expect(set(admin, id, 'una canción')).rejects.toThrow()
  })

  it('needs a title and an artist, and the cover and link are optional', async () => {
    const admin = await getAdmin(db)
    const id = await person()
    await expect(set(admin, id, { ...SONG, title: '  ' })).rejects.toThrow(/título/)
    await expect(set(admin, id, { ...SONG, artist: '' })).rejects.toThrow(/artista/)
    await expect(set(admin, id, { ...SONG, title: 'x'.repeat(151) })).rejects.toThrow(/título/)
    await set(admin, id, { title: 'Canción', artist: 'Alguien', preview: SONG.preview })
  })
})
